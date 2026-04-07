# Example: Gemini + Supabase

Default ragpipe example using Google Gemini for embedding/generation and Supabase for vector storage.

## Prerequisites

- A Google AI API key ([Get one here](https://makersuite.google.com/app/apikey))
- A Supabase project with pgvector enabled

## Setup

1. Create a `.env` file:

```bash
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

2. Run the following SQL in the Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  vector VECTOR(3072),
  UNIQUE(source, content)
);

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

CREATE INDEX ON documents
  USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);
```

3. Install dependencies:

```bash
pnpm install
```

## Usage

```bash
# Ingest the sample docs
pnpm run ingest

# Ask a question
pnpm run ask "How do I get started with ragpipe?"
```
