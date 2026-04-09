# @ragpipe/plugin-cloudflare

Cloudflare Workers AI embedding and generation plugin for [ragpipe](https://github.com/yungblud/ragpipe).

## Install

```bash
pnpm add ragpipe @ragpipe/plugin-cloudflare
```

## Usage

```ts
import { defineConfig } from "ragpipe";
import { cloudflareEmbedding, cloudflareGeneration } from "@ragpipe/plugin-cloudflare";

export default defineConfig({
  embedding: cloudflareEmbedding({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    model: "@cf/qwen/qwen3-embedding-0.6b",
  }),
  generation: cloudflareGeneration({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    model: "@cf/openai/gpt-oss-20b",
    systemPrompt: "Answer based on the provided context.",
  }),
  // ... vectorStore
});
```

## API

### `cloudflareEmbedding(options)`

Returns an `EmbeddingPlugin` that calls the Cloudflare Workers AI Embedding API.

| Option | Type | Default | Description |
|---|---|---|---|
| `accountId` | `string` | — | Cloudflare account ID (required) |
| `apiToken` | `string` | — | Cloudflare API token (required) |
| `model` | `string` | — | Embedding model name (required) |

- **Batch support**: `embedMany()` sends an array of texts in a single API call

### `cloudflareGeneration(options)`

Returns a `GenerationPlugin` that calls the Cloudflare Workers AI Generation API.

| Option | Type | Default | Description |
|---|---|---|---|
| `accountId` | `string` | — | Cloudflare account ID (required) |
| `apiToken` | `string` | — | Cloudflare API token (required) |
| `model` | `string` | — | Generation model name (required) |
| `systemPrompt` | `string` | `"Answer based on the provided context."` | Default system instruction |

- **Streaming**: `generateStream()` returns an `AsyncIterable<string>` via SSE
- **History**: Pass `{ history }` to include conversation context
- **Per-call override**: Pass `{ systemPrompt }` at call time to override the default

## Get an API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Create a token with **Workers AI** read permission
3. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in your environment

## License

MIT
