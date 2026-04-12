# @ragpipe/plugin-voyage

Voyage AI embedding plugin for [ragpipe](https://github.com/yungblud/ragpipe).

This package provides the embedding axis only. Pair it with any ragpipe vector store and generation plugin.

## Install

```bash
pnpm add ragpipe @ragpipe/plugin-voyage
```

## Usage

```ts
import { defineConfig } from "ragpipe";
import { voyageEmbedding } from "@ragpipe/plugin-voyage";

export default defineConfig({
  embedding: voyageEmbedding({
    apiKey: process.env.VOYAGE_API_KEY!,
    model: "voyage-4-lite",
    dimensions: 1024,
    inputType: "document",
  }),
  // vectorStore, generation ...
});
```

## API

### `voyageEmbedding(options)`

Returns an `EmbeddingPlugin` that calls the Voyage embeddings API.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | Voyage API key (required) |
| `model` | `string` | — | Embedding model name (required) |
| `dimensions` | `number` | — | Output dimension (required) |
| `baseUrl` | `string` | `"https://api.voyageai.com/v1"` | API base URL |
| `inputType` | `"query" \| "document"` | — | Retrieval-oriented input type hint |

- **Rate limit**: 200ms between calls
- **Batch support**: `embedMany()` sends an array input in one API call
- **Ordering**: responses are sorted by `index` before returning

## Supported Models

Common Voyage embedding model/dimension pairs:

| Model | Dimensions |
|---|---|
| `voyage-4-large` | 1024 |
| `voyage-4` | 1024 |
| `voyage-4-lite` | 1024 |
| `voyage-4-nano` | 1024 |
| `voyage-3-large` | 1024 |
| `voyage-3.5` | 1024 |
| `voyage-3.5-lite` | 1024 |
| `voyage-code-3` | 1024 |
| `voyage-code-2` | 1536 |
| `voyage-finance-2` | 1024 |
| `voyage-law-2` | 1024 |
| `voyage-large-2-instruct` | 1024 |
| `voyage-multilingual-2` | 1024 |

## Notes

- Uses native `fetch`; no Voyage SDK dependency is required.
- Sends `output_dimension` on every request because `dimensions` is required.
- Sends `input_type` only when `inputType` is explicitly configured.
- Throws explicit errors for HTTP failures, malformed payloads, and empty embedding responses.

## Get an API Key

1. Sign in to Voyage AI
2. Create an API key
3. Set `VOYAGE_API_KEY` in your environment

## License

MIT
