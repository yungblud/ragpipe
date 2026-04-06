import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import type { SearchResult, VectorStorePlugin } from "ragpipe";

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
	};
}
