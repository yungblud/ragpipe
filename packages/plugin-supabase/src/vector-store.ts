import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { consola } from "consola";
import type { SearchResult, VectorStorePlugin } from "ragpipe";
import {
	generateRecreateSQL,
	generateSetupSQL,
	parseVectorDimension,
} from "./sql.js";

export interface SupabaseVectorStoreOptions {
	supabaseUrl: string;
	supabaseKey: string;
	tableName?: string;
	queryName?: string;
}

export function supabaseVectorStore(
	options: SupabaseVectorStoreOptions,
): VectorStorePlugin {
	const table = options.tableName ?? "documents";
	const queryName = options.queryName ?? "match_documents";
	const supabase: SupabaseClient = createClient(
		options.supabaseUrl,
		options.supabaseKey,
	);

	return {
		name: "supabase",

		async search(vector: number[], topK: number): Promise<SearchResult[]> {
			const { data, error } = await supabase.rpc(queryName, {
				query_embedding: vector,
				match_count: topK,
			});

			if (error) {
				throw new Error(`Supabase search error: ${error.message}`);
			}

			return (data ?? []).map(
				(row: { source: string; content: string; similarity: number }) => ({
					source: row.source,
					content: row.content,
					score: row.similarity,
				}),
			);
		},

		async upsert(
			source: string,
			content: string,
			vector: number[],
		): Promise<void> {
			const { error } = await supabase
				.from(table)
				.upsert(
					{ source, content, vector },
					{ onConflict: "source,content_hash" },
				);

			if (error) {
				throw new Error(`Supabase upsert error: ${error.message}`);
			}
		},

		async clear(): Promise<void> {
			const { error } = await supabase.from(table).delete().gte("id", 0);

			if (error) {
				throw new Error(`Supabase clear error: ${error.message}`);
			}
		},

		async disconnect(): Promise<void> {
			// Supabase JS client doesn't require explicit disconnection
		},

		async setup(
			dimensions: number,
			setupOptions?: { force?: boolean },
		): Promise<void> {
			const sqlOptions = { tableName: table, queryName, dimensions };

			// Check if table already exists
			const { data: rows, error: tableError } = await supabase
				.from(table)
				.select("vector")
				.limit(1);

			if (!tableError && rows) {
				if (rows.length === 0) {
					// Table exists but empty — safe to recreate
					consola.info(
						"Table exists but is empty. Recreating with new dimensions...",
					);
					return applyMigration(
						generateRecreateSQL(sqlOptions),
						"ragpipe_recreate",
					);
				}

				// Table has data — check dimension
				const currentDims = parseVectorDimension(rows[0].vector as string);
				if (currentDims === dimensions) {
					consola.success(
						`Vector store is already configured (${dimensions} dimensions).`,
					);
					return;
				}

				// Dimension mismatch with existing data
				if (!setupOptions?.force) {
					consola.error(
						`Dimension mismatch: table has ${currentDims}, config requires ${dimensions}.`,
					);
					consola.info(
						"Run with --force to drop and recreate (existing data will be lost).",
					);
					return;
				}

				consola.warn("Dropping and recreating table with --force...");
				return applyMigration(
					generateRecreateSQL(sqlOptions),
					"ragpipe_recreate",
				);
			}

			// Table doesn't exist — fresh setup
			return applyMigration(generateSetupSQL(sqlOptions), "ragpipe_init");

			function extractProjectRef(supabaseUrl: string): string {
				const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
				if (!match) {
					throw new Error(
						`Cannot extract project ref from URL: ${supabaseUrl}`,
					);
				}
				return match[1];
			}

			function linkProject(): void {
				const projectRef = extractProjectRef(options.supabaseUrl);
				consola.info(`Linking Supabase project: ${projectRef}`);
				try {
					execSync(`npx supabase link --project-ref ${projectRef}`, {
						stdio: "inherit",
						cwd: process.cwd(),
					});
				} catch {
					throw new Error(
						`Failed to link Supabase project. Run manually: npx supabase link --project-ref ${projectRef}`,
					);
				}
			}

			function applyMigration(sql: string, suffix: string): void {
				const migrationsDir = join(process.cwd(), "supabase", "migrations");
				if (!existsSync(migrationsDir)) {
					mkdirSync(migrationsDir, { recursive: true });
				}

				const timestamp = new Date()
					.toISOString()
					.replace(/[-:T]/g, "")
					.slice(0, 14);
				const fileName = `${timestamp}_${suffix}.sql`;
				const filePath = join(migrationsDir, fileName);

				writeFileSync(filePath, sql, "utf-8");
				consola.success(`Generated migration: ${filePath}`);

				linkProject();

				try {
					execSync("npx supabase db push --include-all", {
						stdio: "inherit",
						cwd: process.cwd(),
					});
				} catch {
					consola.warn("supabase db push failed. Run manually:");
					consola.info(`Migration file: ${filePath}`);
					consola.box(sql);
				}
			}
		},

		async isReady(): Promise<boolean> {
			const { error } = await supabase.from(table).select("id").limit(1);
			return !error;
		},
	};
}
