# ragpipe — Plugin-based TypeScript RAG Toolkit

Created: 2026-04-01

## One-liner

A TypeScript-native RAG framework that composes Embedding, VectorStore, and Generation
through a single `defineConfig()`.

---

## 1. Why Build This

### The Problem

Building RAG from scratch always requires reimplementing the same three steps:

1. Documents → chunks → embeddings → vector DB storage (ingest)
2. Question → embedding → similarity search → Top-K retrieval (search)
3. Question + context → LLM → answer generation (generate)

Provider combinations are numerous (Gemini, OpenAI, Voyage, Ollama, Bedrock × Supabase, Pinecone, pgvector × Claude, GPT, Gemini...),
yet every time you have to write glue code to wire up each provider's SDK and calling conventions.

### Limitations of Existing Alternatives

| Framework | Issue |
|-----------|-------|
| LangChain (Python) | Abstraction is too thick. Chain, Agent, Tool, Memory — too many concepts, steep learning curve |
| LangChain.js | Feels like a Python port. Loose types and heavy bundles |
| LlamaIndex | Python-centric. TS version is immature |
| Vercel AI SDK | Focused on generation (streaming). Embedding/VectorStore pipelines require manual implementation |

### ragpipe's Position

> **"A plugin-based RAG toolkit for TypeScript — 10x smaller than LangChain, hot-updater-style config"**

- Learn 4 functions and you're done: `embed`, `search`, `upsert`, `generate`
- One `defineConfig()` file for the entire setup
- Pick provider plugins from npm and plug them in
- `npx ragpipe ingest ./docs/` — one command to load documents

---

## 2. Design Background

This project extracts a plugin architecture from a production RAG system.
Each component in the original system already follows identical signatures, making the plugin extraction natural.

### Plugin Signatures by Axis

| Role | Signature | Notes |
|------|-----------|-------|
| Embedding | `(text: string) → Promise<number[]>` | Same across providers |
| VectorStore | `search`, `upsert`, `clear` | 3 CRUD operations |
| Generation | `(question, context, history?) → Promise<string>` | LLM call |
| Chunker | `(text, source) → DocumentChunk[]` | Document splitting |
| Rate Limiter | `createRateLimitedEmbedder()` | Absorbed into core |
| Pipeline | `search(query, topK) → SearchResult[]` | Absorbed into core |

**Key insight: every function already follows the plugin signature —
extracting interfaces and splitting packages is all it takes to create a framework.**

---

## 3. Architecture

### 4 Plugin Axes

```
ragpipe
├── embedding     ← text → vector
├── vectorStore   ← vector storage / similarity search
├── generation    ← question + context → answer
└── chunker       ← document → chunk splitting (built-in)
```

Just as hot-updater composes `build × storage × database` across 3 axes,
ragpipe composes `embedding × vectorStore × generation` across 3 axes.
The chunker is built-in by default but can be replaced with a custom implementation.

### User Configuration — `defineConfig`

```ts
// ragpipe.config.ts
import { defineConfig } from "ragpipe";
import { geminiEmbedding } from "@ragpipe/plugin-gemini";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";
import { geminiGeneration } from "@ragpipe/plugin-gemini";

export default defineConfig({
  embedding: geminiEmbedding({
    apiKey: process.env.GEMINI_API_KEY!,
    model: "gemini-embedding-001",
  }),
  vectorStore: supabaseVectorStore({
    databaseUrl: process.env.DATABASE_URL!,
    tableName: "documents",
    dimensions: 3072,
  }),
  generation: geminiGeneration({
    apiKey: process.env.GEMINI_API_KEY!,
    model: "gemini-2.5-flash",
    systemPrompt: "Answer based on the provided context.",
  }),
  chunker: { chunkSize: 400 },
});
```

Other combination examples:

```ts
// Bedrock Claude + Voyage + Supabase
import { voyageEmbedding } from "@ragpipe/plugin-voyage";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";
import { bedrockGeneration } from "@ragpipe/plugin-bedrock";

export default defineConfig({
  embedding: voyageEmbedding({
    apiKey: process.env.VOYAGE_API_KEY!,
    model: "voyage-3-lite",
  }),
  vectorStore: supabaseVectorStore({
    databaseUrl: process.env.DATABASE_URL!,
  }),
  generation: bedrockGeneration({
    region: "us-east-1",
    model: "anthropic.claude-3-5-haiku-20241022-v1:0",
  }),
});
```

```ts
// Fully local stack — Ollama + SQLite
import { ollamaEmbedding } from "@ragpipe/plugin-ollama";
import { sqliteVectorStore } from "@ragpipe/plugin-sqlite-vec";
import { ollamaGeneration } from "@ragpipe/plugin-ollama";

export default defineConfig({
  embedding: ollamaEmbedding({ model: "bge-m3" }),
  vectorStore: sqliteVectorStore({ path: "./rag.db" }),
  generation: ollamaGeneration({ model: "llama3" }),
});
```

---

## 4. Core Interfaces

### `types.ts`

```ts
export interface SearchResult {
  source: string;
  content: string;
  score: number;
}

export interface DocumentChunk {
  source: string;
  content: string;
}

export interface EmbeddingPlugin {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedMany?(texts: string[]): Promise<number[][]>;
  rateLimit?: { delayMs: number };
}

export interface VectorStorePlugin {
  readonly name: string;
  search(vector: number[], topK: number): Promise<SearchResult[]>;
  upsert(source: string, content: string, vector: number[]): Promise<void>;
  clear?(): Promise<void>;
  disconnect?(): Promise<void>;
}

export interface GenerationPlugin {
  readonly name: string;
  generate(
    question: string,
    context: string,
    options?: { history?: string; systemPrompt?: string },
  ): Promise<string>;
  generateStream?(
    question: string,
    context: string,
    options?: { history?: string; systemPrompt?: string },
  ): AsyncIterable<string>;
}

export interface ChunkerPlugin {
  readonly name: string;
  chunk(text: string, source: string): DocumentChunk[];
}

export interface RagpipeConfig {
  embedding: EmbeddingPlugin;
  vectorStore: VectorStorePlugin;
  generation: GenerationPlugin;
  chunker?: ChunkerPlugin;
  systemPrompt?: string;
}
```

### `pipeline.ts` — Core Pipeline

```ts
export function createPipeline(config: RagpipeConfig) {
  const chunker = config.chunker ?? defaultChunker();

  return {
    async ingest(text: string, source: string): Promise<number> {
      const chunks = chunker.chunk(text, source);
      for (const chunk of chunks) {
        const vector = await config.embedding.embed(chunk.content);
        await config.vectorStore.upsert(chunk.source, chunk.content, vector);
      }
      return chunks.length;
    },

    async search(query: string, topK = 5): Promise<SearchResult[]> {
      const vector = await config.embedding.embed(query);
      return config.vectorStore.search(vector, topK);
    },

    async ask(query: string, topK = 5): Promise<AskResult> {
      const chunks = await this.search(query, topK);
      const context = chunks
        .map((c) => `[${c.source}]\n${c.content}`)
        .join("\n\n---\n\n");
      const answer = await config.generation.generate(query, context);
      return { answer, sources: chunks };
    },
  };
}
```

---

## 5. Package Structure

```
ragpipe/
├── packages/
│   ├── ragpipe/                     ← core
│   │   ├── src/
│   │   │   ├── types.ts             ← plugin interfaces
│   │   │   ├── config.ts            ← defineConfig()
│   │   │   ├── pipeline.ts          ← ingest, search, ask
│   │   │   ├── chunker.ts           ← built-in chunker
│   │   │   ├── rate-limiter.ts      ← generic rate limiter
│   │   │   └── cli/
│   │   │       ├── index.ts         ← CLI entry point
│   │   │       ├── ingest.ts        ← ragpipe ingest command
│   │   │       ├── ask.ts           ← ragpipe ask command
│   │   │       └── init.ts          ← ragpipe init command
│   │   └── package.json
│   │
│   │   # ── Embedding plugins ──
│   ├── plugin-gemini/               ← Gemini embedding + generation
│   ├── plugin-voyage/               ← Voyage AI embedding
│   ├── plugin-ollama/               ← Ollama embedding + generation (local)
│   ├── plugin-cloudflare/           ← Cloudflare Workers AI embedding
│   ├── plugin-bedrock/              ← AWS Bedrock embedding + generation
│   ├── plugin-openai/               ← OpenAI embedding + generation
│   │
│   │   # ── VectorStore plugins ──
│   ├── plugin-supabase/             ← Supabase pgvector
│   ├── plugin-pgvector/             ← PostgreSQL + pgvector direct connection
│   └── plugin-sqlite-vec/           ← SQLite + sqlite-vec (local)
│
├── examples/
│   ├── with-gemini-supabase/        ← Gemini + Supabase default combo
│   ├── with-bedrock-supabase/       ← Bedrock Claude + Supabase
│   ├── with-ollama-sqlite/          ← Fully local (no API keys needed)
│   └── with-slack-bot/              ← Slack bot integration example
│
├── docs/                            ← Documentation site (Fumadocs or Starlight)
├── ragpipe.config.ts                ← Root example config
└── package.json                     ← monorepo root
```

### npm Package Naming

| Package | npm Name |
|---------|----------|
| Core | `ragpipe` |
| Gemini | `@ragpipe/plugin-gemini` |
| Voyage | `@ragpipe/plugin-voyage` |
| Ollama | `@ragpipe/plugin-ollama` |
| Cloudflare | `@ragpipe/plugin-cloudflare` |
| Bedrock | `@ragpipe/plugin-bedrock` |
| OpenAI | `@ragpipe/plugin-openai` |
| Supabase | `@ragpipe/plugin-supabase` |
| pgvector | `@ragpipe/plugin-pgvector` |
| SQLite | `@ragpipe/plugin-sqlite-vec` |

---

## 6. CLI

### Commands

```bash
# Initialize project — scaffold ragpipe.config.ts
npx ragpipe init

# Ingest documents
npx ragpipe ingest ./docs/
npx ragpipe ingest ./docs/privacy-policy.md

# Ask questions directly from CLI
npx ragpipe ask "What is the refund policy?"

# Clear vector DB
npx ragpipe clear

# Check status
npx ragpipe status
```

### `ragpipe init` Flow

```
$ npx ragpipe init

? Select an Embedding provider:
  ❯ Gemini (Google)
    OpenAI
    Voyage AI
    Ollama (local)
    Cloudflare Workers AI
    AWS Bedrock

? Select a VectorStore:
  ❯ Supabase (pgvector)
    PostgreSQL (pgvector direct)
    SQLite (local)

? Select a Generation LLM:
  ❯ Gemini
    OpenAI (GPT)
    AWS Bedrock (Claude)
    Ollama (local)

✔ ragpipe.config.ts created
✔ Required packages: @ragpipe/plugin-gemini, @ragpipe/plugin-supabase
✔ pnpm add ragpipe @ragpipe/plugin-gemini @ragpipe/plugin-supabase completed
```

---

## 7. Plugin Implementation Examples

### Gemini Embedding Plugin

A plugin wrapping the Gemini Embedding API:

```ts
// packages/plugin-gemini/src/embedding.ts
import type { EmbeddingPlugin } from "ragpipe";

interface GeminiEmbeddingOptions {
  apiKey: string;
  model?: string;
}

export function geminiEmbedding(options: GeminiEmbeddingOptions): EmbeddingPlugin {
  const model = options.model ?? "gemini-embedding-001";

  return {
    name: "gemini",
    dimensions: 3072,
    rateLimit: { delayMs: 800 },

    async embed(text: string): Promise<number[]> {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${options.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: { parts: [{ text }] } }),
        },
      );

      if (!res.ok) {
        throw new Error(`Gemini embedding error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json() as { embedding: { values: number[] } };
      return data.embedding.values;
    },
  };
}
```

### Supabase VectorStore Plugin

A plugin wrapping Supabase pgvector:

```ts
// packages/plugin-supabase/src/vector-store.ts
import type { VectorStorePlugin, SearchResult } from "ragpipe";
import postgres from "postgres";

interface SupabaseVectorStoreOptions {
  databaseUrl: string;
  tableName?: string;
  dimensions?: number;
}

export function supabaseVectorStore(options: SupabaseVectorStoreOptions): VectorStorePlugin {
  const table = options.tableName ?? "documents";
  const sql = postgres(options.databaseUrl);

  return {
    name: "supabase",

    async search(vector: number[], topK: number): Promise<SearchResult[]> {
      const vectorStr = `[${vector.join(",")}]`;
      const results = await sql`
        SELECT source, content,
          1 - (vector <=> ${vectorStr}::vector) AS score
        FROM ${sql(table)}
        ORDER BY vector <=> ${vectorStr}::vector
        LIMIT ${topK}
      `;
      return results as unknown as SearchResult[];
    },

    async upsert(source: string, content: string, vector: number[]): Promise<void> {
      const vectorStr = `[${vector.join(",")}]`;
      await sql`
        INSERT INTO ${sql(table)} (source, content, vector)
        SELECT ${source}, ${content}, ${vectorStr}::vector
        WHERE NOT EXISTS (
          SELECT 1 FROM ${sql(table)}
          WHERE source = ${source} AND content = ${content}
        )
      `;
    },

    async clear(): Promise<void> {
      await sql`TRUNCATE TABLE ${sql(table)}`;
    },

    async disconnect(): Promise<void> {
      await sql.end();
    },
  };
}
```

---

## 8. Programmatic Usage

Using ragpipe directly in code, beyond the CLI:

```ts
// app.ts
import { loadConfig, createPipeline } from "ragpipe";

const config = await loadConfig(); // auto-loads ragpipe.config.ts
const rag = createPipeline(config);

// Ingest documents
const chunkCount = await rag.ingest(markdownText, "docs/guide.md");
console.log(`${chunkCount} chunks stored`);

// Ask a question
const result = await rag.ask("How does user authentication work?");
console.log(result.answer);
console.log("Sources:", result.sources.map((s) => s.source));
```

### Fastify Route Example

```ts
// routes/ask.ts
import { createPipeline, loadConfig } from "ragpipe";

const rag = createPipeline(await loadConfig());

app.post("/ask", async (req, reply) => {
  const { query } = req.body;
  const result = await rag.ask(query, 5);
  return { answer: result.answer, sources: result.sources.map((s) => s.source) };
});
```

### Slack Bot Example

```ts
// slack.ts
import { createPipeline, loadConfig } from "ragpipe";

const rag = createPipeline(await loadConfig());

slackApp.event("app_mention", async ({ event, client }) => {
  const result = await rag.ask(event.text);
  await client.chat.postMessage({
    channel: event.channel,
    text: result.answer,
  });
});
```

---

## 9. Differentiation — Why Not LangChain

| Criteria | LangChain.js | ragpipe |
|----------|-------------|---------|
| Bundle size | ~2MB+ (with dependencies) | Core <50KB |
| Learning curve | Chain, Agent, Tool, Memory, etc. | 4 functions: `ingest`, `search`, `ask`, `generate` |
| Configuration | Assemble in code | Declarative `defineConfig()` |
| CLI | None | `npx ragpipe ingest/ask/init` |
| TypeScript | Loose types in many places | Strict types from day one |
| Abstraction level | General-purpose AI framework | **RAG only** — does one thing well |
| Plugin discovery | Read docs and assemble manually | Interactive selection via `ragpipe init` |
| Inspiration | — | hot-updater's `defineConfig` pattern |

Core philosophy:

> **"RAG is a composition of 3 functions: embed → search → generate.
> Everything else is just a plugin choice."**

---

## 10. Roadmap

### Phase 0 — Repository Init (1 day)

- [x] Monorepo setup (pnpm workspace + turborepo)
- [x] Core package scaffolding (`ragpipe`)
- [x] `types.ts` — finalize plugin interfaces
- [x] `config.ts` — `defineConfig()` + `loadConfig()`
- [x] `pipeline.ts` — `createPipeline()`
- [x] `chunker.ts` — built-in chunker (paragraph-based, size-limited)
- [x] `rate-limiter.ts` — generic rate-limited embedder

### Phase 1 — First 3 Plugins (2–3 days)

MVP with the minimum viable combination:

- [ ] `@ragpipe/plugin-gemini` — embedding + generation
- [ ] `@ragpipe/plugin-supabase` — vectorStore
- [ ] Core CLI (`init`, `ingest`, `ask`)
- [ ] `examples/with-gemini-supabase/` — default example

At the end of Phase 1, the following should work:

```bash
npx ragpipe init          # → generate config
npx ragpipe ingest ./docs # → load documents
npx ragpipe ask "query"   # → return answer
```

### Phase 2 — Plugin Expansion (1–2 weeks)

- [ ] `@ragpipe/plugin-voyage` — Voyage AI embedding
- [ ] `@ragpipe/plugin-ollama` — local embedding + generation
- [ ] `@ragpipe/plugin-cloudflare` — Cloudflare Workers AI embedding
- [ ] `@ragpipe/plugin-bedrock` — AWS Bedrock embedding + generation
- [ ] `@ragpipe/plugin-openai` — OpenAI embedding + generation
- [ ] `@ragpipe/plugin-pgvector` — PostgreSQL direct connection
- [ ] `@ragpipe/plugin-sqlite-vec` — SQLite local vector DB

### Phase 3 — Advanced Features (2–4 weeks)

- [ ] Streaming responses (`generateStream`)
- [ ] Batch embeddings (`embedMany`) — automatic rate limit handling
- [ ] Documentation site (Fumadocs or Starlight)
- [ ] GitHub Actions CI/CD + automated npm publishing
- [ ] `ragpipe dev` — local web UI for ingest/search testing
- [ ] Custom chunker plugin support (Markdown header-based, code block-aware, etc.)

### Phase 4 — Ecosystem (long-term)

- [ ] Community plugin support (third-party plugin registry)
- [ ] `ragpipe deploy` — one-click deploy to Vercel/Cloudflare Workers
- [ ] Multimodal embedding (images, PDF)
- [ ] Re-ranker plugin axis (Cohere Rerank, etc.)

---

## 11. Tech Stack

| Area | Choice | Rationale |
|------|--------|-----------|
| Language | TypeScript 5.x (strict) | Target users are TS/JS developers |
| Monorepo | pnpm workspace + turborepo | Same proven setup as hot-updater |
| Build | tsup | Fast, ESM/CJS dual output |
| CLI | citty or commander | Lightweight CLI framework |
| Config loader | jiti or c12 | Runtime TS config file loading |
| Linter | Biome | Fast, minimal configuration |
| Testing | Vitest | TS-native, fast execution |
| Docs | Fumadocs or Starlight | MDX-based, built-in search |

---

## 12. Risks & Considerations

### Naming — Confirmed: `ragpipe`

Both the npm package name `ragpipe` and org scope `@ragpipe` confirmed available (2026-04-06).
The original candidate `rag-kit` was dropped because the npm org `@rag-kit` was already claimed by a third party.
`ragkit` was also taken by an existing LangChain-based RAG framework.

"pipe" intuitively conveys the pipeline architecture (embed → search → generate)
and aligns with the Unix pipe philosophy ("do one thing well and compose").

### Maintenance Burden

As plugin count grows, maintenance costs increase due to provider API changes.
Phase 1 starts with Gemini + Supabase only — encouraging community contributions for the rest is the realistic strategy.

### Provider API Stability

- Gemini API: still `v1beta` — subject to change
- Bedrock: stable, but model availability varies by region
- Voyage: relatively stable

### Vector Dimension Alignment

Embedding dimensions vary by provider (Gemini: 3072, OpenAI: 1536, Titan: 1024, Voyage: 1024).
VectorStore plugins must accept a `dimensions` setting,
and the core should validate dimension mismatch between embedding and vectorStore.

### Security

Since the architecture passes API keys to plugins,
`ragpipe.config.ts` should be included in `.gitignore` — this needs clear documentation.
The recommended default pattern is reading from `.env`.

---

## 13. Conclusion

The essence of RAG is the composition of 3 functions: `embed → search → generate`.
The structure where each provider follows identical signatures is already proven,
and extracting interfaces + splitting packages creates a framework anyone can use.

**Phase 1 goal: a working MVP where `npx ragpipe init` → `npx ragpipe ingest ./docs/` → `npx ragpipe ask "query"` just works.**

Start with a single Gemini + Supabase combination,
then add plugins in validated order (Ollama → Voyage → Bedrock → OpenAI).
