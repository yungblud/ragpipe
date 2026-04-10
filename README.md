# ragpipe

Pluggable TypeScript RAG toolkit — `defineConfig()` one file, embed → search → generate.

> **RAG is a composition of 3 functions: embed → search → generate.
> Everything else is just a plugin choice.**

## Features

- **4 functions to learn** — `ingest`, `search`, `ask`, `generate`. That's it.
- **`defineConfig()` driven** — One config file to wire up your entire RAG pipeline.
- **Plugin architecture** — Mix and match embedding, vector store, and generation providers.
- **CLI included** — `npx ragpipe ingest ./docs/` and you're done.
- **TypeScript-first** — Strict types from day one. No loose `any`.
- **Tiny core** — <50KB. 10x smaller than LangChain.js.

## Quick Start

```bash
# Scaffold a config file interactively
npx ragpipe init

# Set up vector store schema (creates tables, indexes, etc.)
npx ragpipe setup

# Ingest your documents
npx ragpipe ingest ./docs/

# Ask questions
npx ragpipe ask "What is the refund policy?"
```

## Configuration

Create a `ragpipe.config.ts` and pick your providers:

```ts
import { defineConfig } from "ragpipe";
import { geminiEmbedding, geminiGeneration } from "@ragpipe/plugin-gemini";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";

export default defineConfig({
  embedding: geminiEmbedding({
    apiKey: process.env.GEMINI_API_KEY!,
    model: "gemini-embedding-001",
  }),
  vectorStore: supabaseVectorStore({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    tableName: "documents",
  }),
  generation: geminiGeneration({
    apiKey: process.env.GEMINI_API_KEY!,
    model: "gemini-2.5-flash",
  }),
});
```

### Other Combinations

<details>
<summary>Bedrock Claude + Voyage + Supabase</summary>

```ts
import { defineConfig } from "ragpipe";
import { voyageEmbedding } from "@ragpipe/plugin-voyage";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";
import { bedrockGeneration } from "@ragpipe/plugin-bedrock";

export default defineConfig({
  embedding: voyageEmbedding({
    apiKey: process.env.VOYAGE_API_KEY!,
    model: "voyage-3-lite",
  }),
  vectorStore: supabaseVectorStore({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  generation: bedrockGeneration({
    region: "us-east-1",
    model: "anthropic.claude-3-haiku-20240307-v1:0",
  }),
});
```

</details>

<details>
<summary>Fully Local — Ollama + SQLite (no API keys needed)</summary>

```ts
import { defineConfig } from "ragpipe";
import { ollamaEmbedding, ollamaGeneration } from "@ragpipe/plugin-ollama";
import { sqliteVectorStore } from "@ragpipe/plugin-sqlite-vec";

export default defineConfig({
  embedding: ollamaEmbedding({ model: "bge-m3" }),
  vectorStore: sqliteVectorStore({ path: "./rag.db" }),
  generation: ollamaGeneration({ model: "llama3" }),
});
```

</details>

## Programmatic Usage

```ts
import { loadConfig, createPipeline } from "ragpipe";

const config = await loadConfig();
const rag = createPipeline(config);

// Ingest documents
await rag.ingest(markdownText, "docs/guide.md");

// Ask questions with source attribution
const { answer, sources } = await rag.ask("How does authentication work?");
```

## Plugins

### Embedding

| Provider | Package | Status |
|----------|---------|--------|
| Gemini | `@ragpipe/plugin-gemini` | stable |
| OpenAI | `@ragpipe/plugin-openai` | stable |
| Voyage AI | `@ragpipe/plugin-voyage` | planned |
| Ollama | `@ragpipe/plugin-ollama` | stable |
| Cloudflare Workers AI | `@ragpipe/plugin-cloudflare` | stable |
| AWS Bedrock | `@ragpipe/plugin-bedrock` | stable |

### Vector Store

| Provider | Package | Status |
|----------|---------|--------|
| Supabase (pgvector) | `@ragpipe/plugin-supabase` | stable |
| PostgreSQL (pgvector) | `@ragpipe/plugin-pgvector` | planned |
| SQLite (sqlite-vec) | `@ragpipe/plugin-sqlite-vec` | planned |

### Generation

| Provider | Package | Status |
|----------|---------|--------|
| Gemini | `@ragpipe/plugin-gemini` | stable |
| OpenAI | `@ragpipe/plugin-openai` | stable |
| AWS Bedrock (Claude) | `@ragpipe/plugin-bedrock` | stable |
| Ollama | `@ragpipe/plugin-ollama` | stable |

## How It Works

ragpipe has 3 plugin axes — just like [hot-updater](https://github.com/gronxb/hot-updater) composes `build × storage × database`, ragpipe composes **embedding × vectorStore × generation**.

```
ragpipe
├── embedding     ← text → vector
├── vectorStore   ← vector storage / similarity search
├── generation    ← question + context → answer
└── chunker       ← document → chunks (built-in, replaceable)
```

The core pipeline is simple:

1. **Setup** — create vector store tables and indexes based on your config
2. **Ingest** — chunk documents → embed each chunk → store vectors
3. **Search** — embed query → find similar chunks
4. **Ask** — search → build context → generate answer with LLM

### CLI Commands

| Command | Description |
|---------|-------------|
| `npx ragpipe init` | Scaffold a `ragpipe.config.ts` interactively |
| `npx ragpipe setup` | Set up vector store schema (tables, indexes). Use `--force` to recreate from scratch |
| `npx ragpipe ingest <dir>` | Chunk, embed, and store documents |
| `npx ragpipe ask "<question>"` | Search context and generate an answer |

## Why ragpipe?

| | LangChain.js | ragpipe |
|---|---|---|
| Bundle size | ~2MB+ | <50KB core |
| Learning curve | Chain, Agent, Tool, Memory... | 4 functions |
| Config | Assemble in code | Declarative `defineConfig()` |
| CLI | None | `npx ragpipe init/setup/ingest/ask` |
| TypeScript | Loose types | Strict from day one |
| Scope | General-purpose AI framework | **RAG only** — does one thing well |

## Contributing

Contributions are welcome! See the [spec document](./specs/rag-kit-spec.md) for architecture details and roadmap.

## License

MIT
