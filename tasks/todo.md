# Todo

## Step 6 - Plugin Sqlite Vec Branch Setup

- [x] Review `specs/rag-kit-spec.md` and current branch conventions for `@ragpipe/plugin-sqlite-vec`
- [x] Switch to the implementation branch for `@ragpipe/plugin-sqlite-vec`
- [x] Verify current workspace changes are preserved after switching

## Review

- Chose `feat/plugin-sqlite-vec` to match existing branch naming such as `feat/plugin-pgvector` and `feat/plugin-bedrock`
- Switched from `main` to `feat/plugin-sqlite-vec`
- Verified existing workspace changes in `README.md` and `specs/rag-kit-spec.md` remained intact after switching

## Step 7 - Plugin Sqlite Vec Detailed Plan

- [x] Confirm implementation target from `specs/rag-kit-spec.md` and align API with existing VectorStore plugins
- [x] Decide package shape and dependency strategy for `packages/plugin-sqlite-vec/`
- [x] Define the sqlite schema, vector storage format, and retrieval query strategy
- [x] Scaffold `packages/plugin-sqlite-vec/` with `package.json`, `tsconfig.json`, `tsup.config.ts`, and `src/index.ts`
- [ ] Implement vector formatting/parsing and any SQL helper utilities in `src/sql.ts` if needed
- [ ] Implement `sqliteVectorStore(options)` in `src/vector-store.ts`
- [ ] Support `search(vector, topK)` with deterministic similarity ordering and `SearchResult` mapping
- [ ] Support `upsert(source, content, vector)` with stable conflict handling matching other stores
- [ ] Support `clear()` and `disconnect()` for local database lifecycle management
- [ ] Support `setup(dimensions, { force? })` and `isReady()` if core/CLI currently depends on them
- [ ] Validate dimension mismatch behavior against the spec's vector dimension guidance
- [ ] Add unit tests for schema/setup, search ordering, upsert semantics, clear/disconnect, and dimension mismatch
- [ ] Verify package-level `test`, `typecheck`, and `build`
- [ ] Add `@ragpipe/plugin-sqlite-vec` to `packages/ragpipe/src/cli/init.ts`
- [ ] Ensure generated `ragpipe.config.ts` uses `sqliteVectorStore({ path: "./rag.db" })`
- [ ] Add package README with install, local setup expectations, API, and example usage
- [ ] Add or update `examples/with-ollama-sqlite/` if the example is missing or stale
- [ ] Add a changeset covering the new package and any CLI/example updates
- [ ] Run affected verification for `@ragpipe/plugin-sqlite-vec` and `ragpipe`

## Step 7 Spec Notes

- Package name: `@ragpipe/plugin-sqlite-vec`
- Primary constructor: `sqliteVectorStore({ path: "./rag.db" })`
- Behavior target: local VectorStore plugin for the fully local Ollama + SQLite stack
- API parity target: follow `plugin-pgvector` shape where practical so CLI/core integration stays predictable
- Verification target: prove the package builds, typechecks, and its local search/upsert behavior is covered by tests

## Step 7 Open Design Decisions

- [x] Choose sqlite driver and extension strategy:
- Decision: MVP will avoid a hard dependency on the `sqlite-vec` extension and use a simpler local sqlite storage/search strategy first
- [ ] Choose the concrete sqlite driver package that best fits local file-based usage and bundling constraints
- [x] Decide how vectors are stored:
- Decision: store vectors in sqlite rows using a simple serialized format suitable for local retrieval in MVP, then compute similarity in plugin code after loading candidate rows
- [ ] Decide setup responsibility:
- Plugin-local automatic table creation is preferred over external migration steps because this is a local-first store
- [ ] Decide dimension validation source:
- Reuse stored row data or metadata table to detect incompatible dimensions during `setup()`

## Step 7 MVP Strategy

- Use sqlite as the persistence layer only for the first pass
- Persist `source`, `content`, `content_hash`, and serialized `vector` in a local table
- Perform similarity scoring in plugin code for MVP after reading rows from sqlite
- Keep the public API named `sqliteVectorStore` so a future true `sqlite-vec` backend can preserve consumer-facing config
- Treat this as the simplest path to a working fully local stack, not the final optimized implementation

## Step 7 Progress Notes

- Added `packages/plugin-sqlite-vec/` package scaffolding matching other vector store plugins
- Captured the MVP schema and retrieval strategy in `src/index.ts` as exported constants for follow-up implementation
- Kept the public constructor as `sqliteVectorStore(options)` so the next step can move logic into `src/vector-store.ts` without changing consumer API

## Step 1 - Plugin Pgvector Scaffolding

- [x] Review `specs/plugin-pgvector.md` and existing plugin package conventions
- [x] Define Step 1 implementation scope for scaffolding only
- [x] Create `packages/plugin-pgvector/`
- [x] Add `package.json`, `tsconfig.json`, and `tsup.config.ts`
- [x] Add `src/index.ts` and a build-safe `src/vector-store.ts` scaffold
- [x] Verify workspace/build wiring

## Review

- Created a new workspace package at `packages/plugin-pgvector/`
- Added package metadata, build config, and a minimal entrypoint scaffold
- Ran `pnpm install --force` to wire workspace dependencies and update `pnpm-lock.yaml`
- Verified `pnpm --filter @ragpipe/plugin-pgvector typecheck`
- Verified `pnpm --filter @ragpipe/plugin-pgvector build`

## Step 2 - SQL Helpers

- [x] Confirm Step 2 scope from `specs/plugin-pgvector.md`
- [x] Add `packages/plugin-pgvector/src/sql.ts`
- [x] Add `packages/plugin-pgvector/src/__tests__/sql.test.ts`
- [x] Export SQL helpers from package entrypoint
- [x] Verify `test`, `typecheck`, and `build`

- Added identifier validation, setup SQL generation, recreate SQL generation, and vector dimension parsing
- Added SQL unit tests covering valid/invalid identifiers, DDL generation, and vector parsing
- Verified `pnpm --filter @ragpipe/plugin-pgvector test`
- Verified `pnpm --filter @ragpipe/plugin-pgvector typecheck`
- Verified `pnpm --filter @ragpipe/plugin-pgvector build`

## Step 3 - Vector Store

- [x] Confirm Step 3 scope from `specs/plugin-pgvector.md`
- [x] Implement `packages/plugin-pgvector/src/vector-store.ts`
- [x] Add `packages/plugin-pgvector/src/__tests__/vector-store.test.ts`
- [x] Verify `test`, `typecheck`, and `build`

- Implemented `pg.Pool`-backed `search`, `upsert`, `clear`, `disconnect`, `isReady`, and `setup`
- Added setup logic for fresh table creation, empty-table recreate, force recreate, and dimension mismatch checks
- Added unit tests for query payloads, setup branching, connection options, and setup error guidance
- Verified `pnpm --filter @ragpipe/plugin-pgvector test`
- Verified `pnpm --filter @ragpipe/plugin-pgvector typecheck`
- Verified `pnpm --filter @ragpipe/plugin-pgvector build`

## Step 4 - Test Hardening

- [x] Compare current coverage against `specs/plugin-pgvector.md`
- [x] Add missing unit tests for custom schema/table coverage
- [x] Add missing unit tests for query error propagation
- [x] Verify `test`, `typecheck`, and `build`

- Added explicit test coverage for custom `schema` and `tableName` in `search()` and `setup()`
- Added explicit error propagation tests for `search()`, `upsert()`, and `clear()`
- Verified `pnpm --filter @ragpipe/plugin-pgvector test`
- Verified `pnpm --filter @ragpipe/plugin-pgvector typecheck`
- Verified `pnpm --filter @ragpipe/plugin-pgvector build`

## Step 5 - CLI And Docs

- [x] Confirm Step 5 scope from `specs/plugin-pgvector.md`
- [x] Add pgvector provider support to `packages/ragpipe/src/cli/init.ts`
- [x] Replace placeholder `packages/plugin-pgvector/README.md`
- [x] Add a changeset for the new package and CLI update
- [x] Verify affected packages

- Added `PostgreSQL (pgvector direct)` as a VectorStore option in `ragpipe init`
- Updated generated config so pgvector uses `connectionString: process.env.DATABASE_URL!`
- Replaced the placeholder pgvector README with install, usage, API, setup, and example documentation
- Added `.changeset/forty-bees-whisper.md` covering the new plugin and `ragpipe init` update
- Verified `pnpm --filter @ragpipe/plugin-pgvector test`
- Verified `pnpm --filter @ragpipe/plugin-pgvector typecheck`
- Verified `pnpm --filter @ragpipe/plugin-pgvector build`
- Verified `pnpm --filter ragpipe test`
- Verified `pnpm --filter ragpipe typecheck`
- Verified `pnpm --filter ragpipe build`
