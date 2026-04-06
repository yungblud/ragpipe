# @ragpipe/plugin-gemini

Google Gemini embedding and generation plugin for [ragpipe](https://github.com/yungblud/ragpipe).

## Install

```bash
pnpm add ragpipe @ragpipe/plugin-gemini
```

## Usage

```ts
import { defineConfig } from "ragpipe";
import { geminiEmbedding, geminiGeneration } from "@ragpipe/plugin-gemini";

export default defineConfig({
  embedding: geminiEmbedding({
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: "gemini-embedding-001", // default
  }),
  generation: geminiGeneration({
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: "gemini-2.5-flash", // default
    systemPrompt: "Answer based on the provided context.",
  }),
  // ... vectorStore
});
```

## API

### `geminiEmbedding(options)`

Returns an `EmbeddingPlugin` that calls the Gemini Embedding API.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | Google AI API key (required) |
| `model` | `string` | `"gemini-embedding-001"` | Embedding model name |

- **Dimensions**: 3072
- **Rate limit**: 800ms between calls (built-in)
- **Batch support**: `embedMany()` uses `batchEmbedContents` for efficient bulk embedding

### `geminiGeneration(options)`

Returns a `GenerationPlugin` that calls the Gemini Content Generation API.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | Google AI API key (required) |
| `model` | `string` | `"gemini-2.5-flash"` | Generation model name |
| `systemPrompt` | `string` | `"Answer based on the provided context."` | Default system instruction |

- **Streaming**: `generateStream()` returns an `AsyncIterable<string>` via SSE
- **History**: Pass `{ history }` to include conversation context
- **Per-call override**: Pass `{ systemPrompt }` at call time to override the default

## Get an API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Set it as `GEMINI_API_KEY` in your environment

## License

MIT
