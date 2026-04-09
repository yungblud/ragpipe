export function validateIdentifier(name: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error(`Invalid SQL identifier: "${name}"`);
	}
	return name;
}

interface SetupSQLOptions {
	tableName: string;
	queryName: string;
	dimensions: number;
}

function generateTableAndFunction(
	table: string,
	query: string,
	dims: number,
): string {
	return `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ${table} (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT GENERATED ALWAYS AS (md5(content)) STORED,
  vector VECTOR(${dims}),
  UNIQUE(source, content_hash)
);

CREATE OR REPLACE FUNCTION ${query}(
  query_embedding VECTOR(${dims}),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  source TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.source,
    d.content,
    1 - (d.vector <=> query_embedding) AS similarity
  FROM ${table} d
  ORDER BY d.vector <=> query_embedding
  LIMIT match_count;
END;
$$;`;
}

export function generateSetupSQL(options: SetupSQLOptions): string {
	const table = validateIdentifier(options.tableName);
	const query = validateIdentifier(options.queryName);
	return generateTableAndFunction(table, query, options.dimensions);
}

export function generateRecreateSQL(options: SetupSQLOptions): string {
	const table = validateIdentifier(options.tableName);
	const query = validateIdentifier(options.queryName);

	return `DROP FUNCTION IF EXISTS ${query};
DROP TABLE IF EXISTS ${table};

${generateTableAndFunction(table, query, options.dimensions)}`;
}

export function parseVectorDimension(vector: string): number {
	const trimmed = vector.replace(/^\[|\]$/g, "");
	if (!trimmed) return 0;
	return trimmed.split(",").length;
}
