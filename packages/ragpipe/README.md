# ragpipe

Pluggable TypeScript RAG toolkit — `defineConfig()` one file, embed → search → generate.

## Install

```bash
pnpm add ragpipe
```

## Quick Start

### CLI

```bash
# Scaffold a ragpipe.config.ts
npx ragpipe init

# Set up vector store schema
npx ragpipe setup

# Ingest documents
npx ragpipe ingest ./docs

# Ask a question
npx ragpipe ask "What is the refund policy?"
```

### Programmatic

```ts
import { loadConfig, createPipeline } from "ragpipe";

const config = await loadConfig();
const rag = createPipeline(config);

await rag.ingest(markdownText, "docs/guide.md");

const result = await rag.ask("How does authentication work?");
console.log(result.answer);
console.log(result.sources.map((s) => s.source));
```

## Configuration

Create a `ragpipe.config.ts` at your project root:

```ts
import { defineConfig } from "ragpipe";
import { geminiEmbedding, geminiGeneration } from "@ragpipe/plugin-gemini";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";

export default defineConfig({
  embedding: geminiEmbedding({
    apiKey: process.env.GEMINI_API_KEY ?? "",
  }),
  vectorStore: supabaseVectorStore({
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  }),
  generation: geminiGeneration({
    apiKey: process.env.GEMINI_API_KEY ?? "",
  }),
});
```

## API

### `defineConfig(config)`

Identity helper that provides type-safe autocompletion for your config file.

### `loadConfig(overrides?)`

Loads `ragpipe.config.ts` from the project root using [c12](https://github.com/unjs/c12). Validates that `embedding`, `vectorStore`, and `generation` plugins are present.

### `createPipeline(config)`

Returns a pipeline with three methods:

| Method | Description |
|---|---|
| `ingest(text, source)` | Chunk text, embed each chunk, and store vectors. Returns chunk count. |
| `search(query, topK?)` | Embed the query and return the top-K matching documents. |
| `ask(query, topK?)` | Search for context, then generate an answer. Returns `{ answer, sources }`. |

### `defaultChunker(options?)`

Built-in paragraph-based chunker. Options: `chunkSize` (default 500), `overlap` (default 50).

### `createRateLimitedEmbedder(plugin)`

Wraps an `EmbeddingPlugin` with throttling based on its `rateLimit.delayMs`.

## Plugin Interfaces

Implement any of these to create a custom plugin:

- **`EmbeddingPlugin`** — `embed(text)`, optional `embedMany(texts)`, `rateLimit`
- **`VectorStorePlugin`** — `search(vector, topK)`, `upsert(source, content, vector)`, optional `clear()`, `disconnect()`
- **`GenerationPlugin`** — `generate(question, context, options?)`, optional `generateStream()`
- **`ChunkerPlugin`** — `chunk(text, source)`

## Official Plugins

| Package | Description |
|---|---|
| [`@ragpipe/plugin-gemini`](https://www.npmjs.com/package/@ragpipe/plugin-gemini) | Google Gemini embedding + generation |
| [`@ragpipe/plugin-supabase`](https://www.npmjs.com/package/@ragpipe/plugin-supabase) | Supabase pgvector store |

## License

MIT
