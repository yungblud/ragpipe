export function validateIdentifier(name: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error(`Invalid SQL identifier: "${name}"`);
	}
	return name;
}

export function generateSetupSQL(options: {
	tableName: string;
	queryName: string;
	dimensions: number;
}): string {
	const table = validateIdentifier(options.tableName);
	const query = validateIdentifier(options.queryName);
	const dims = options.dimensions;

	return `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ${table} (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  vector VECTOR(${dims}),
  UNIQUE(source, content)
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
