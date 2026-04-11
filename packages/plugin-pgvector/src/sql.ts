export function validateIdentifier(name: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error(`Invalid SQL identifier: "${name}"`);
	}

	return name;
}

function generateQualifiedName(schema: string, table: string): string {
	const safeSchema = validateIdentifier(schema);
	const safeTable = validateIdentifier(table);

	return `${safeSchema}.${safeTable}`;
}

function generateIndexName(table: string): string {
	const safeTable = validateIdentifier(table);
	return `${safeTable}_vector_idx`;
}

export function generateSetupSQL(
	schema: string,
	table: string,
	dimensions: number,
): string {
	const qualifiedTable = generateQualifiedName(schema, table);
	const indexName = generateIndexName(table);

	return `CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS ${validateIdentifier(schema)};

CREATE TABLE IF NOT EXISTS ${qualifiedTable} (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT GENERATED ALWAYS AS (md5(content)) STORED,
  vector VECTOR(${dimensions}),
  UNIQUE(source, content_hash)
);

CREATE INDEX IF NOT EXISTS ${indexName}
  ON ${qualifiedTable}
  USING hnsw (vector vector_cosine_ops);`;
}

export function generateRecreateSQL(
	schema: string,
	table: string,
	dimensions: number,
): string {
	const qualifiedTable = generateQualifiedName(schema, table);

	return `DROP TABLE IF EXISTS ${qualifiedTable};

${generateSetupSQL(schema, table, dimensions)}`;
}

export function parseVectorDimension(vector: string): number {
	const trimmed = vector.replace(/^\[|\]$/g, "");

	if (!trimmed) {
		return 0;
	}

	return trimmed.split(",").length;
}
