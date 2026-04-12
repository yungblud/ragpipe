---
"@ragpipe/plugin-sqlite-vec": minor
"ragpipe": minor
---

Add the new `@ragpipe/plugin-sqlite-vec` package for local SQLite-backed vector storage.

Update `ragpipe init` so SQLite appears as a VectorStore option and scaffolds `sqliteVectorStore({ path: "./rag.db" })` in generated config.
