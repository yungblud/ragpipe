import { createRequire } from "node:module";
import type { SearchResult, VectorStorePlugin } from "ragpipe";
import {
	SQLITE_VECTOR_STORE_DEFAULT_META_TABLE,
	SQLITE_VECTOR_STORE_DEFAULT_TABLE,
	SQLITE_VECTOR_STORE_DIMENSIONS_KEY,
	cosineSimilarity,
	createContentHash,
	formatVector,
	generateDocumentsExistsSQL,
	generateMetadataExistsSQL,
	generateRecreateSQL,
	generateSetupSQL,
	parseVector,
	parseVectorDimension,
	validateIdentifier,
} from "./sql.js";

const require = createRequire(`${process.cwd()}/`);

interface SqliteStatement {
	run(...params: unknown[]): unknown;
	get<T = Record<string, unknown>>(...params: unknown[]): T | undefined;
	all<T = Record<string, unknown>>(...params: unknown[]): T[];
}

interface SqliteDatabase {
	pragma(source: string): unknown;
	prepare(source: string): SqliteStatement;
	exec(source: string): void;
	close(): void;
}

type SqliteDatabaseConstructor = new (path: string) => SqliteDatabase;

interface CountRow {
	count: number;
}

interface VectorRow {
	source: string;
	content: string;
	vector: string;
}

interface MetaRow {
	value: string;
}

export interface SqliteVectorStoreOptions {
	path: string;
	tableName?: string;
	metaTableName?: string;
}

function loadDatabaseConstructor(): SqliteDatabaseConstructor {
	try {
		return require("better-sqlite3") as SqliteDatabaseConstructor;
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(
				`Failed to load better-sqlite3. Install it before using @ragpipe/plugin-sqlite-vec: ${error.message}`,
			);
		}

		throw new Error(
			"Failed to load better-sqlite3. Install it before using @ragpipe/plugin-sqlite-vec.",
		);
	}
}

export function sqliteVectorStore(
	options: SqliteVectorStoreOptions,
): VectorStorePlugin {
	const table = validateIdentifier(
		options.tableName ?? SQLITE_VECTOR_STORE_DEFAULT_TABLE,
	);
	const metaTable = validateIdentifier(
		options.metaTableName ?? SQLITE_VECTOR_STORE_DEFAULT_META_TABLE,
	);

	let database: SqliteDatabase | null = null;

	function getDatabase(): SqliteDatabase {
		if (database) {
			return database;
		}

		const Database = loadDatabaseConstructor();
		database = new Database(options.path);
		database.pragma("journal_mode = WAL");
		return database;
	}

	function getRowCount(): number {
		const db = getDatabase();
		const row =
			db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get<CountRow>() ??
			({ count: 0 } as CountRow);

		return Number(row.count ?? 0);
	}

	function getStoredDimensions(): number | null {
		const db = getDatabase();
		const metaRow = db
			.prepare(`SELECT value FROM ${metaTable} WHERE key = ?`)
			.get<MetaRow>(SQLITE_VECTOR_STORE_DIMENSIONS_KEY);

		if (metaRow?.value) {
			return Number(metaRow.value);
		}

		const row = db
			.prepare(`SELECT vector FROM ${table} ORDER BY id ASC LIMIT 1`)
			.get<{ vector: string }>();

		if (!row?.vector) {
			return null;
		}

		return parseVectorDimension(row.vector);
	}

	function setStoredDimensions(dimensions: number): void {
		const db = getDatabase();
		db.prepare(
			`INSERT INTO ${metaTable} (key, value)
VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		).run(SQLITE_VECTOR_STORE_DIMENSIONS_KEY, String(dimensions));
	}

	function ensureQueryDimensions(queryVector: number[]): void {
		if (queryVector.length === 0) {
			throw new Error("Query vector must not be empty.");
		}

		const storedDimensions = getStoredDimensions();

		if (storedDimensions !== null && storedDimensions !== queryVector.length) {
			throw new Error(
				`Dimension mismatch: store is configured for ${storedDimensions}, query has ${queryVector.length}.`,
			);
		}
	}

	return {
		name: "sqlite-vec",

		async search(vector: number[], topK: number): Promise<SearchResult[]> {
			ensureQueryDimensions(vector);

			const rows = getDatabase()
				.prepare(`SELECT source, content, vector FROM ${table}`)
				.all<VectorRow>();

			return rows
				.map((row) => ({
					source: row.source,
					content: row.content,
					score: cosineSimilarity(vector, parseVector(row.vector)),
				}))
				.sort((left, right) => {
					if (right.score !== left.score) {
						return right.score - left.score;
					}

					if (left.source !== right.source) {
						return left.source.localeCompare(right.source);
					}

					return left.content.localeCompare(right.content);
				})
				.slice(0, topK);
		},

		async upsert(
			source: string,
			content: string,
			vector: number[],
		): Promise<void> {
			ensureQueryDimensions(vector);

			getDatabase()
				.prepare(
					`INSERT INTO ${table} (source, content, content_hash, vector)
VALUES (?, ?, ?, ?)
ON CONFLICT(source, content_hash) DO UPDATE SET
  content = excluded.content,
  vector = excluded.vector`,
				)
				.run(source, content, createContentHash(content), formatVector(vector));
		},

		async clear(): Promise<void> {
			const db = getDatabase();
			db.prepare(`DELETE FROM ${table}`).run();
		},

		async disconnect(): Promise<void> {
			database?.close();
			database = null;
		},

		async isReady(): Promise<boolean> {
			try {
				const db = getDatabase();
				const documentsTable = db
					.prepare(generateDocumentsExistsSQL(table))
					.get();
				const metadataTable = db
					.prepare(generateMetadataExistsSQL(metaTable))
					.get();

				return Boolean(documentsTable && metadataTable);
			} catch {
				return false;
			}
		},

		async setup(
			dimensions: number,
			setupOptions?: { force?: boolean },
		): Promise<void> {
			if (!Number.isInteger(dimensions) || dimensions <= 0) {
				throw new Error("Dimensions must be a positive integer.");
			}

			const db = getDatabase();
			const ready = await this.isReady?.();

			if (!ready) {
				db.exec(generateSetupSQL(table, metaTable));
				setStoredDimensions(dimensions);
				return;
			}

			const rowCount = getRowCount();

			if (rowCount === 0 || setupOptions?.force) {
				db.exec(generateRecreateSQL(table, metaTable));
				setStoredDimensions(dimensions);
				return;
			}

			const currentDimensions = getStoredDimensions();

			if (currentDimensions === null) {
				setStoredDimensions(dimensions);
				return;
			}

			if (currentDimensions !== dimensions) {
				throw new Error(
					`Dimension mismatch: table has ${currentDimensions}, config requires ${dimensions}. Use setup --force to recreate (data will be lost).`,
				);
			}
		},
	};
}
