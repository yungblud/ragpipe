# @ragpipe/plugin-sqlite-vec

SQLite local vector store plugin for [ragpipe](https://github.com/yungblud/ragpipe).

This plugin is designed for local-first RAG setups. It stores vectors in a SQLite file and performs similarity scoring in plugin code, so you can run a fully local stack without a separate vector database server.

Pair it with `@ragpipe/plugin-ollama` for an all-local workflow.

## Install

```bash
pnpm add ragpipe @ragpipe/plugin-sqlite-vec
```

If you use `pnpm`, you may also need to approve the native build for `better-sqlite3`:

```bash
pnpm approve-builds
```

Approve `better-sqlite3`, then reinstall or rebuild if needed:

```bash
pnpm rebuild better-sqlite3
```

## Usage

```ts
import { defineConfig } from "ragpipe";
import { sqliteVectorStore } from "@ragpipe/plugin-sqlite-vec";

export default defineConfig({
  // ... embedding, generation
  vectorStore: sqliteVectorStore({
    path: "./rag.db",
    tableName: "documents", // default
    metaTableName: "ragpipe_meta", // default
  }),
});
```

### Fully local example

```ts
import { defineConfig } from "ragpipe";
import {
  ollamaEmbedding,
  ollamaGeneration,
} from "@ragpipe/plugin-ollama";
import { sqliteVectorStore } from "@ragpipe/plugin-sqlite-vec";

export default defineConfig({
  embedding: ollamaEmbedding({
    model: "bge-m3",
    dimensions: 1024,
  }),
  vectorStore: sqliteVectorStore({
    path: "./rag.db",
  }),
  generation: ollamaGeneration({
    model: "llama3",
  }),
});
```

## API

### `sqliteVectorStore(options)`

Returns a `VectorStorePlugin` backed by a local SQLite database file.

| Option | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | — | SQLite database file path (required) |
| `tableName` | `string` | `"documents"` | Table that stores documents and vectors |
| `metaTableName` | `string` | `"ragpipe_meta"` | Table that stores plugin metadata such as embedding dimensions |

### Methods

| Method | Description |
|---|---|
| `search(vector, topK)` | Loads rows from SQLite, scores cosine similarity in plugin code, and returns top matches |
| `upsert(source, content, vector)` | Inserts or updates by `UNIQUE(source, content_hash)` |
| `clear()` | Deletes all rows from the configured documents table |
| `disconnect()` | Closes the underlying SQLite connection |
| `isReady()` | Checks whether the documents table and metadata table already exist |
| `setup(dimensions, options?)` | Creates or recreates the local schema and stores the configured embedding dimensions |

## Database Setup

`setup()` creates two tables automatically:

- documents table: stores `source`, `content`, `content_hash`, and serialized `vector`
- metadata table: stores plugin metadata including the configured embedding dimensions

If the store already has data and the configured embedding dimensions change, `setup()` throws a dimension mismatch error unless you pass `{ force: true }`.

## How Search Works

Current implementation behavior:

- vectors are stored as serialized JSON in SQLite
- similarity is computed with cosine similarity in plugin code
- retrieval uses a full-table scan and then sorts results in memory

This is intentional for the first local MVP. It keeps setup simple and avoids requiring a separate vector extension or hosted service.

## Notes

- This plugin is best suited for local development, demos, and smaller datasets.
- `tableName` and `metaTableName` are validated before being interpolated into SQL.
- `better-sqlite3` is used under the hood and is loaded at runtime by the plugin.
- In `pnpm` projects, `better-sqlite3` may require `pnpm approve-builds` before the native binding is available.
- Dimension metadata is persisted so mismatched embedding models fail fast instead of silently returning bad search results.

## License

MIT
