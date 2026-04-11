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
