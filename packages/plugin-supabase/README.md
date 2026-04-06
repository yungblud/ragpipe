# @ragpipe/plugin-supabase

Supabase vector store plugin for [ragpipe](https://github.com/yungblud/ragpipe), powered by [`@supabase/supabase-js`](https://github.com/supabase/supabase-js).

## Install

```bash
pnpm add ragpipe @ragpipe/plugin-supabase
```

## Usage

```ts
import { defineConfig } from "ragpipe";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";

export default defineConfig({
  // ... embedding, generation
  vectorStore: supabaseVectorStore({
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    tableName: "documents",   // default
    queryName: "match_documents", // default RPC function name
  }),
});
```

## API

### `supabaseVectorStore(options)`

Returns a `VectorStorePlugin` backed by Supabase using the official JS SDK.

| Option | Type | Default | Description |
|---|---|---|---|
| `supabaseUrl` | `string` | — | Supabase project URL (required) |
| `supabaseKey` | `string` | — | Service role key (required) |
| `tableName` | `string` | `"documents"` | Table to store documents |
| `queryName` | `string` | `"match_documents"` | PostgreSQL function for vector search |

### Methods

| Method | Description |
|---|---|
| `search(vector, topK)` | Calls `supabase.rpc()` for cosine similarity search |
| `upsert(source, content, vector)` | Inserts via `supabase.from().upsert()` with dedup on `source,content` |
| `clear()` | Deletes all rows from the documents table |
| `disconnect()` | No-op (Supabase JS client manages connections automatically) |

## Database Setup

Run the following in your Supabase SQL editor:

```sql
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

-- 4. Create an index for faster search
CREATE INDEX ON documents
  USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);
```

Adjust `VECTOR(3072)` to match your embedding model's dimensions.

## License

MIT
