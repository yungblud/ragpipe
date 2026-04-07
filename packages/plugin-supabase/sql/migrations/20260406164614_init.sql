-- ragpipe/plugin-supabase initial schema

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the documents table
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  vector VECTOR(3072),
  UNIQUE(source, content)
);

-- 3. Create the similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(3072),
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
  FROM documents d
  ORDER BY d.vector <=> query_embedding
  LIMIT match_count;
END;
$$;
