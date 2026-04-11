import { Pool } from "pg";
import type { SearchResult, VectorStorePlugin } from "ragpipe";
import {
	generateRecreateSQL,
	generateSetupSQL,
	parseVectorDimension,
	validateIdentifier,
} from "./sql.js";

export interface PgVectorStoreOptions {
	connectionString: string;
	tableName?: string;
	schema?: string;
	ssl?: boolean;
}

export function pgVectorStore(
	options: PgVectorStoreOptions,
): VectorStorePlugin {
	const table = validateIdentifier(options.tableName ?? "documents");
	const schema = validateIdentifier(options.schema ?? "public");
	const qualifiedTable = `${schema}.${table}`;
	const pool = new Pool({
		connectionString: options.connectionString,
		ssl: options.ssl ? { rejectUnauthorized: false } : undefined,
	});

	function formatVector(vector: number[]): string {
		return `[${vector.join(",")}]`;
	}

	function wrapSetupError(error: unknown): Error {
		if (error instanceof Error) {
			if (
				error.message.includes('extension "vector"') ||
				error.message.includes("permission denied")
			) {
				return new Error(
					`Failed to setup pgvector store: ${error.message}. Install the pgvector extension on the database first.`,
				);
			}

			return error;
		}

		return new Error("Failed to setup pgvector store.");
	}

	return {
		name: "pgvector",

		async search(vector: number[], topK: number): Promise<SearchResult[]> {
			const { rows } = await pool.query(
				`SELECT source, content, 1 - (vector <=> $1::vector) AS similarity
FROM ${qualifiedTable}
ORDER BY vector <=> $1::vector
LIMIT $2`,
				[formatVector(vector), topK],
			);

			return rows.map((row) => ({
				source: row.source as string,
				content: row.content as string,
				score: Number(row.similarity),
			}));
		},

		async upsert(
			source: string,
			content: string,
			vector: number[],
		): Promise<void> {
			const vectorString = formatVector(vector);

			await pool.query(
				`INSERT INTO ${qualifiedTable} (source, content, vector)
VALUES ($1, $2, $3::vector)
ON CONFLICT (source, content_hash) DO UPDATE SET vector = $3::vector`,
				[source, content, vectorString],
			);
		},

		async clear(): Promise<void> {
			await pool.query(`TRUNCATE ${qualifiedTable}`);
		},

		async disconnect(): Promise<void> {
			await pool.end();
		},

		async isReady(): Promise<boolean> {
			try {
				await pool.query(`SELECT 1 FROM ${qualifiedTable} LIMIT 1`);
				return true;
			} catch {
				return false;
			}
		},

		async setup(
			dimensions: number,
			setupOptions?: { force?: boolean },
		): Promise<void> {
			try {
				const ready = await this.isReady?.();

				if (!ready) {
					await pool.query(generateSetupSQL(schema, table, dimensions));
					return;
				}

				const countResult = await pool.query(
					`SELECT COUNT(*)::int AS count FROM ${qualifiedTable}`,
				);
				const count = Number(countResult.rows[0]?.count ?? 0);

				if (count === 0 || setupOptions?.force) {
					await pool.query(generateRecreateSQL(schema, table, dimensions));
					return;
				}

				const dimensionResult = await pool.query(
					`SELECT vector FROM ${qualifiedTable} LIMIT 1`,
				);
				const existingVector = dimensionResult.rows[0]?.vector;
				const existingDimensions =
					typeof existingVector === "string"
						? parseVectorDimension(existingVector)
						: dimensions;

				if (existingDimensions !== dimensions) {
					throw new Error(
						`Dimension mismatch: table has ${existingDimensions}, config requires ${dimensions}. Use setup --force to recreate (data will be lost).`,
					);
				}
			} catch (error) {
				throw wrapSetupError(error);
			}
		},
	};
}
