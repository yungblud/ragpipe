# Getting Started with ragpipe

ragpipe is a pluggable TypeScript RAG toolkit.

## Installation

```bash
pnpm add ragpipe @ragpipe/plugin-gemini @ragpipe/plugin-supabase
```

## Quick Start

1. Run `npx ragpipe init` to scaffold your config file.
2. Set your environment variables (`GEMINI_API_KEY`, `DATABASE_URL`).
3. Ingest documents: `npx ragpipe ingest ./docs`
4. Ask questions: `npx ragpipe ask "How do I get started?"`

## Configuration

ragpipe uses a `ragpipe.config.ts` file with the `defineConfig()` pattern.
You wire up your embedding, vector store, and generation plugins in one place.

## Plugins

- **@ragpipe/plugin-gemini** — Google Gemini for embedding and text generation
- **@ragpipe/plugin-supabase** — Supabase with pgvector for vector storage
