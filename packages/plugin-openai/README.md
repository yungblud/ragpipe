# @ragpipe/plugin-openai

OpenAI embedding and generation plugin for [ragpipe](https://github.com/yungblud/ragpipe).

## Install

```bash
pnpm add ragpipe @ragpipe/plugin-openai
```

## Usage

```ts
import { defineConfig } from "ragpipe";
import { openaiEmbedding, openaiGeneration } from "@ragpipe/plugin-openai";

export default defineConfig({
  embedding: openaiEmbedding({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: "text-embedding-3-small",
  }),
  generation: openaiGeneration({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: "gpt-4o-mini",
    systemPrompt: "Answer based on the provided context.",
  }),
  // ... vectorStore
});
```

## API

### `openaiEmbedding(options)`

Returns an `EmbeddingPlugin` that calls the OpenAI Embeddings API.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | OpenAI API key (required) |
| `model` | `string` | `"text-embedding-3-small"` | Embedding model name |
| `dimensions` | `number` | model default (1536 / 3072) | Output dimensions (`text-embedding-3-*` only) |
| `baseUrl` | `string` | `"https://api.openai.com/v1"` | API base URL |

- **Rate limit**: 200ms between calls (built-in)
- **Batch support**: `embedMany()` sends array input in a single API call
- **Dimension reduction**: `text-embedding-3-small/large` support custom `dimensions` to reduce output size
- **Compatible APIs**: Set `baseUrl` to use OpenRouter, Azure OpenAI, or other OpenAI-compatible endpoints

### `openaiGeneration(options)`

Returns a `GenerationPlugin` that calls the OpenAI Chat Completions API.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | OpenAI API key (required) |
| `model` | `string` | `"gpt-4o-mini"` | Chat model name |
| `systemPrompt` | `string` | `"Answer based on the provided context."` | Default system instruction |
| `baseUrl` | `string` | `"https://api.openai.com/v1"` | API base URL |

- **Streaming**: `generateStream()` returns an `AsyncIterable<string>` via SSE
- **History**: Pass `{ history }` to include conversation context
- **Per-call override**: Pass `{ systemPrompt }` at call time to override the default
- **Compatible APIs**: Set `baseUrl` to use OpenRouter, Azure OpenAI, or other OpenAI-compatible endpoints

## Supported Models

### Embedding

| Model | Dimensions | Notes |
|---|---|---|
| `text-embedding-3-small` | 1536 | Default, cost-efficient |
| `text-embedding-3-large` | 3072 | High precision |
| `text-embedding-ada-002` | 1536 | Legacy |

### Generation

| Model | Notes |
|---|---|
| `gpt-4o-mini` | Default, cost-efficient |
| `gpt-4o` | Flagship |
| `o1` | Reasoning |
| `o3-mini` | Reasoning (lightweight) |

## Get an API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an API key
3. Set it as `OPENAI_API_KEY` in your environment

## License

MIT
