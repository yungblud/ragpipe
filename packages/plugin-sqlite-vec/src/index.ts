import type { VectorStorePlugin } from "ragpipe";

export interface SqliteVectorStoreOptions {
	path: string;
	tableName?: string;
	metaTableName?: string;
}

export const SQLITE_VECTOR_STORE_DEFAULT_TABLE = "documents";
export const SQLITE_VECTOR_STORE_DEFAULT_META_TABLE = "ragpipe_meta";

export const SQLITE_VECTOR_STORE_MVP_STRATEGY = {
	driver: "sqlite-driver-to-be-finalized",
	vectorEncoding: "json",
	retrieval: "full-table scan in sqlite, similarity scoring in plugin code",
	deduplication: "UNIQUE(source, content_hash)",
	dimensionTracking: "metadata table",
} as const;

export const SQLITE_VECTOR_STORE_SCHEMA = {
	documentsTable: {
		name: SQLITE_VECTOR_STORE_DEFAULT_TABLE,
		columns: {
			id: "INTEGER PRIMARY KEY AUTOINCREMENT",
			source: "TEXT NOT NULL",
			content: "TEXT NOT NULL",
			content_hash: "TEXT NOT NULL",
			vector: "TEXT NOT NULL",
			created_at: "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
		},
		unique: ["source", "content_hash"],
	},
	metadataTable: {
		name: SQLITE_VECTOR_STORE_DEFAULT_META_TABLE,
		columns: {
			key: "TEXT PRIMARY KEY",
			value: "TEXT NOT NULL",
		},
	},
} as const;

export function sqliteVectorStore(
	_options: SqliteVectorStoreOptions,
): VectorStorePlugin {
	throw new Error(
		"@ragpipe/plugin-sqlite-vec is scaffolded but not implemented yet.",
	);
}
