import postgres from "postgres";
import type { SearchResult, VectorStorePlugin } from "ragpipe";

export interface SupabaseVectorStoreOptions {
	databaseUrl: string;
	tableName?: string;
	dimensions?: number;
}

export function supabaseVectorStore(
	options: SupabaseVectorStoreOptions,
): VectorStorePlugin {
	const table = options.tableName ?? "documents";
	const sql = postgres(options.databaseUrl);

	return {
		name: "supabase",

		async search(vector: number[], topK: number): Promise<SearchResult[]> {
			const vectorStr = `[${vector.join(",")}]`;
			const results = await sql`
				SELECT source, content,
					1 - (vector <=> ${vectorStr}::vector) AS score
				FROM ${sql(table)}
				ORDER BY vector <=> ${vectorStr}::vector
				LIMIT ${topK}
			`;
			return results as unknown as SearchResult[];
		},

		async upsert(
			source: string,
			content: string,
			vector: number[],
		): Promise<void> {
			const vectorStr = `[${vector.join(",")}]`;
			await sql`
				INSERT INTO ${sql(table)} (source, content, vector)
				SELECT ${source}, ${content}, ${vectorStr}::vector
				WHERE NOT EXISTS (
					SELECT 1 FROM ${sql(table)}
					WHERE source = ${source} AND content = ${content}
				)
			`;
		},

		async clear(): Promise<void> {
			await sql`TRUNCATE TABLE ${sql(table)}`;
		},

		async disconnect(): Promise<void> {
			await sql.end();
		},
	};
}
