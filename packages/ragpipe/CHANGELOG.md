# ragpipe

## 0.10.0

### Minor Changes

- [#23](https://github.com/yungblud/ragpipe/pull/23) [`eaf423b`](https://github.com/yungblud/ragpipe/commit/eaf423b83498a61f327043f338d02bf6f975d672) Thanks [@yungblud](https://github.com/yungblud)! - Update `ragpipe init` to support `@ragpipe/plugin-voyage` as an embedding provider.

  The generated config now includes `voyageEmbedding()` with `VOYAGE_API_KEY`, `model`, and required `dimensions` values.

## 0.9.0

### Minor Changes

- [#21](https://github.com/yungblud/ragpipe/pull/21) [`e16b7aa`](https://github.com/yungblud/ragpipe/commit/e16b7aaaf9970397449018010ec5c1e9b83cc70f) Thanks [@yungblud](https://github.com/yungblud)! - Add the new `@ragpipe/plugin-sqlite-vec` package for local SQLite-backed vector storage.

  Update `ragpipe init` so SQLite appears as a VectorStore option and scaffolds `sqliteVectorStore({ path: "./rag.db" })` in generated config.

## 0.8.0

### Minor Changes

- [#19](https://github.com/yungblud/ragpipe/pull/19) [`75fb551`](https://github.com/yungblud/ragpipe/commit/75fb55188d3f40cef5453a5cd69ed6746188e3e3) Thanks [@yungblud](https://github.com/yungblud)! - Add the PostgreSQL pgvector vector-store plugin and expose it through `ragpipe init`.

## 0.7.0

### Minor Changes

- [#17](https://github.com/yungblud/ragpipe/pull/17) [`cc0f15e`](https://github.com/yungblud/ragpipe/commit/cc0f15ee74147648dee3155d09940b73e5da9914) Thanks [@yungblud](https://github.com/yungblud)! - Support plugin-bedrock

## 0.6.0

### Minor Changes

- [#15](https://github.com/yungblud/ragpipe/pull/15) [`b2b29aa`](https://github.com/yungblud/ragpipe/commit/b2b29aa3dac217ea7aacd1111364d156f81eb75e) Thanks [@yungblud](https://github.com/yungblud)! - Support plugin-openai

## 0.5.0

### Minor Changes

- [`3a0aecc`](https://github.com/yungblud/ragpipe/commit/3a0aecc7a3c441131db0767fe8b90c64ab786761) Thanks [@yungblud](https://github.com/yungblud)! - fix support auto load dotenv

## 0.4.0

### Minor Changes

- [#12](https://github.com/yungblud/ragpipe/pull/12) [`b5359f5`](https://github.com/yungblud/ragpipe/commit/b5359f5e028098e0a1e4664c95fb396d7642d3c6) Thanks [@yungblud](https://github.com/yungblud)! - Support plugin-ollama

## 0.3.0

### Minor Changes

- [#7](https://github.com/yungblud/ragpipe/pull/7) [`aa9b535`](https://github.com/yungblud/ragpipe/commit/aa9b535dcc47f8c0b7fb128750d2379576fef82e) Thanks [@yungblud](https://github.com/yungblud)! - Add auto setup vector store

## 0.2.0

### Minor Changes

- [#5](https://github.com/yungblud/ragpipe/pull/5) [`11f54f9`](https://github.com/yungblud/ragpipe/commit/11f54f9d3abb0e4a64135539e63f1a7e9e599eec) Thanks [@yungblud](https://github.com/yungblud)! - ragpipe init CLI에 Cloudflare Workers AI provider 옵션 추가

## 0.1.0

### Minor Changes

- [#2](https://github.com/yungblud/ragpipe/pull/2) [`141cdf2`](https://github.com/yungblud/ragpipe/commit/141cdf2fb80acd221e7025f677ca25bdcb4b9f4b) Thanks [@yungblud](https://github.com/yungblud)! - Add CLI commands (`ragpipe init`, `ragpipe ingest`, `ragpipe ask`) powered by citty and consola
