import { createHash } from "node:crypto";

export const SQLITE_VECTOR_STORE_DEFAULT_TABLE = "documents";
export const SQLITE_VECTOR_STORE_DEFAULT_META_TABLE = "ragpipe_meta";
export const SQLITE_VECTOR_STORE_DIMENSIONS_KEY = "dimensions";

export function validateIdentifier(name: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error(`Invalid SQL identifier: "${name}"`);
	}

	return name;
}

export function formatVector(vector: number[]): string {
	if (vector.length === 0) {
		throw new Error("Vector must not be empty.");
	}

	if (vector.some((value) => !Number.isFinite(value))) {
		throw new Error("Vector must contain only finite numbers.");
	}

	return JSON.stringify(vector);
}

export function parseVector(vector: string): number[] {
	let parsed: unknown;

	try {
		parsed = JSON.parse(vector);
	} catch {
		throw new Error("Stored vector is not valid JSON.");
	}

	if (!Array.isArray(parsed)) {
		throw new Error("Stored vector must be a JSON array.");
	}

	const numeric = parsed.map((value) => {
		if (typeof value !== "number" || !Number.isFinite(value)) {
			throw new Error("Stored vector must contain only finite numbers.");
		}

		return value;
	});

	if (numeric.length === 0) {
		throw new Error("Stored vector must not be empty.");
	}

	return numeric;
}

export function parseVectorDimension(vector: string): number {
	return parseVector(vector).length;
}

export function createContentHash(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

export function cosineSimilarity(left: number[], right: number[]): number {
	if (left.length !== right.length) {
		throw new Error(
			`Vector dimension mismatch: query has ${left.length}, row has ${right.length}.`,
		);
	}

	let dot = 0;
	let leftNorm = 0;
	let rightNorm = 0;

	for (let index = 0; index < left.length; index += 1) {
		const leftValue = left[index];
		const rightValue = right[index];

		dot += leftValue * rightValue;
		leftNorm += leftValue * leftValue;
		rightNorm += rightValue * rightValue;
	}

	if (leftNorm === 0 || rightNorm === 0) {
		return 0;
	}

	return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function generateSetupSQL(table: string, metaTable: string): string {
	const safeTable = validateIdentifier(table);
	const safeMetaTable = validateIdentifier(metaTable);

	return `CREATE TABLE IF NOT EXISTS ${safeTable} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  vector TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, content_hash)
);

CREATE TABLE IF NOT EXISTS ${safeMetaTable} (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;
}

export function generateRecreateSQL(table: string, metaTable: string): string {
	const safeTable = validateIdentifier(table);
	const safeMetaTable = validateIdentifier(metaTable);

	return `DROP TABLE IF EXISTS ${safeTable};
DROP TABLE IF EXISTS ${safeMetaTable};

${generateSetupSQL(safeTable, safeMetaTable)}`;
}

export function generateDocumentsExistsSQL(table: string): string {
	return `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${validateIdentifier(table)}'`;
}

export function generateMetadataExistsSQL(metaTable: string): string {
	return `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${validateIdentifier(metaTable)}'`;
}
