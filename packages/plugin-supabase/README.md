# @ragpipe/plugin-supabase

Supabase pgvector vector store plugin for [ragpipe](https://github.com/yungblud/ragpipe).

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
    databaseUrl: process.env.DATABASE_URL ?? "",
    tableName: "documents", // default
    dimensions: 3072,
  }),
});
```

## API

### `supabaseVectorStore(options)`

Returns a `VectorStorePlugin` backed by Supabase PostgreSQL with pgvector.

| Option | Type | Default | Description |
|---|---|---|---|
| `databaseUrl` | `string` | — | PostgreSQL connection string (required) |
| `tableName` | `string` | `"documents"` | Table to store/query vectors |
| `dimensions` | `number` | — | Vector dimensions (for documentation; table must match) |

### Methods

| Method | Description |
|---|---|
| `search(vector, topK)` | Cosine similarity search, returns top-K results with scores |
| `upsert(source, content, vector)` | Insert a document if it doesn't already exist |
| `clear()` | Truncate the documents table |
| `disconnect()` | Close the PostgreSQL connection |

## Database Setup

Enable pgvector and create the documents table in your Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  vector VECTOR(3072)
);

CREATE INDEX ON documents
  USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);
```

Adjust `VECTOR(3072)` to match your embedding model's dimensions.

## License

MIT
