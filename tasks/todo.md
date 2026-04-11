# Todo

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
