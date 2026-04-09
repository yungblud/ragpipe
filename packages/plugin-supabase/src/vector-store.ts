import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { consola } from "consola";
import type { SearchResult, VectorStorePlugin } from "ragpipe";
import { generateSetupSQL } from "./sql.js";

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
				.upsert({ source, content, vector }, { onConflict: "source,content" });

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

		async setup(dimensions: number): Promise<void> {
			const sql = generateSetupSQL({
				tableName: table,
				queryName: queryName,
				dimensions,
			});

			const migrationsDir = join(process.cwd(), "supabase", "migrations");
			if (!existsSync(migrationsDir)) {
				mkdirSync(migrationsDir, { recursive: true });
			}

			const timestamp = new Date()
				.toISOString()
				.replace(/[-:T]/g, "")
				.slice(0, 14);
			const fileName = `${timestamp}_ragpipe_init.sql`;
			const filePath = join(migrationsDir, fileName);

			writeFileSync(filePath, sql, "utf-8");
			consola.success(`Generated migration: ${filePath}`);

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
		},

		async isReady(): Promise<boolean> {
			const { error } = await supabase.from(table).select("id").limit(1);
			return !error;
		},
	};
}
