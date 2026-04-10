# @ragpipe/plugin-ollama

Ollama local embedding and generation plugin for [ragpipe](https://github.com/yungblud/ragpipe).

No API key required. Pair with `@ragpipe/plugin-sqlite-vec` for a fully local RAG setup.

## Prerequisites

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama server
ollama serve

# Pull models
ollama pull bge-m3
ollama pull llama3
```

## Install

```bash
pnpm add ragpipe @ragpipe/plugin-ollama
```

## Usage

```ts
import { defineConfig } from "ragpipe";
import { ollamaEmbedding, ollamaGeneration } from "@ragpipe/plugin-ollama";

export default defineConfig({
  embedding: ollamaEmbedding({
    model: "bge-m3",
    dimensions: 1024,
  }),
  generation: ollamaGeneration({
    model: "llama3",
  }),
  // ... vectorStore
});
```

### Remote Ollama server

```ts
ollamaEmbedding({
  model: "bge-m3",
  dimensions: 1024,
  baseUrl: "http://gpu-server.local:11434",
});
```

## API

### `ollamaEmbedding(options)`

Returns an `EmbeddingPlugin` that calls Ollama's `/api/embed` endpoint.

| Option | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | — | Embedding model name (required) |
| `dimensions` | `number` | — | Vector dimensions (required) |
| `baseUrl` | `string` | `"http://localhost:11434"` | Ollama server URL |

- **Batch support**: `embedMany()` sends an array of texts in a single API call

### `ollamaGeneration(options)`

Returns a `GenerationPlugin` that calls Ollama's `/api/chat` endpoint.

| Option | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | — | Generation model name (required) |
| `baseUrl` | `string` | `"http://localhost:11434"` | Ollama server URL |
| `systemPrompt` | `string` | `"Answer based on the provided context."` | Default system instruction |

- **Streaming**: `generateStream()` returns an `AsyncIterable<string>` via NDJSON
- **History**: Pass `{ history }` to include conversation context
- **Per-call override**: Pass `{ systemPrompt }` at call time to override the default

### Supported models

#### Embedding

| Model | Dimensions |
|---|---|
| `bge-m3` | 1024 |
| `nomic-embed-text` | 768 |
| `mxbai-embed-large` | 1024 |
| `all-minilm` | 384 |

#### Generation

`llama3`, `llama3.1`, `mistral`, `gemma2`, `phi3`, `qwen2`, and any model available via `ollama pull`.

## License

MIT
