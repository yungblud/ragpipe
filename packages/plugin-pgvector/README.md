# @ragpipe/plugin-pgvector

PostgreSQL + pgvector vector store plugin for [ragpipe](https://github.com/yungblud/ragpipe), powered by [`pg`](https://github.com/brianc/node-postgres).

## Install

```bash
pnpm add ragpipe @ragpipe/plugin-pgvector
```

## Usage

```ts
import { defineConfig } from "ragpipe";
import { pgVectorStore } from "@ragpipe/plugin-pgvector";

export default defineConfig({
  // ... embedding, generation
  vectorStore: pgVectorStore({
    connectionString: process.env.DATABASE_URL ?? "",
    tableName: "documents", // default
    schema: "public", // default
    ssl: false, // default
  }),
});
```

## API

### `pgVectorStore(options)`

Returns a `VectorStorePlugin` backed by a direct PostgreSQL connection.

| Option | Type | Default | Description |
|---|---|---|---|
| `connectionString` | `string` | — | PostgreSQL connection string (required) |
| `tableName` | `string` | `"documents"` | Table to store documents |
| `schema` | `string` | `"public"` | PostgreSQL schema for the table |
| `ssl` | `boolean` | `false` | Enables SSL with `rejectUnauthorized: false` |

### Methods

| Method | Description |
|---|---|
| `search(vector, topK)` | Runs cosine similarity search with pgvector `<=>` |
| `upsert(source, content, vector)` | Inserts with `ON CONFLICT (source, content_hash)` dedup |
| `clear()` | Truncates the configured table |
| `disconnect()` | Closes the underlying PostgreSQL pool |
| `isReady()` | Checks whether the configured table already exists |
| `setup(dimensions, options?)` | Creates or recreates the table and HNSW index |

## Database Setup

`setup()` creates the schema automatically:

- `CREATE EXTENSION IF NOT EXISTS vector`
- `CREATE TABLE IF NOT EXISTS {schema}.{table}`
- `CREATE INDEX IF NOT EXISTS {table}_vector_idx USING hnsw`

Your database still needs the pgvector extension package installed at the server level. If the extension is unavailable or permissions are missing, `setup()` will fail with guidance in the error message.

## Examples

### Local Docker / self-hosted PostgreSQL

```ts
pgVectorStore({
  connectionString: "postgresql://ragpipe:ragpipe@localhost:5432/ragpipe",
});
```

### AWS RDS / Cloud SQL with SSL

```ts
pgVectorStore({
  connectionString: process.env.DATABASE_URL ?? "",
  ssl: true,
});
```

### Custom schema and table

```ts
pgVectorStore({
  connectionString: process.env.DATABASE_URL ?? "",
  schema: "rag",
  tableName: "knowledge_base",
});
```

## Notes

- This plugin uses direct SQL instead of a hosted platform SDK.
- `schema` and `tableName` are validated before being interpolated into SQL.
- Vector values and document content are sent via parameterized queries.

## License

MIT
