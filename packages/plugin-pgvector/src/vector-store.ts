import type { VectorStorePlugin } from "ragpipe";

export interface PgVectorStoreOptions {
	connectionString: string;
	tableName?: string;
	schema?: string;
	ssl?: boolean;
}

export function pgVectorStore(
	_options: PgVectorStoreOptions,
): VectorStorePlugin {
	throw new Error(
		"@ragpipe/plugin-pgvector is scaffolded but not implemented yet. Continue with Step 2 and Step 3.",
	);
}
