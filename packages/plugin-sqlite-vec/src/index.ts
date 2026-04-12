export { sqliteVectorStore } from "./vector-store.js";
export type { SqliteVectorStoreOptions } from "./vector-store.js";
export {
	SQLITE_VECTOR_STORE_DEFAULT_META_TABLE,
	SQLITE_VECTOR_STORE_DEFAULT_TABLE,
	SQLITE_VECTOR_STORE_DIMENSIONS_KEY,
	cosineSimilarity,
	createContentHash,
	formatVector,
	generateRecreateSQL,
	generateSetupSQL,
	parseVector,
	parseVectorDimension,
	validateIdentifier,
} from "./sql.js";
