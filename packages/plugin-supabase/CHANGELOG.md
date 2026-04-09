# @ragpipe/plugin-supabase

## 0.3.0

### Minor Changes

- [`bc7c4ea`](https://github.com/yungblud/ragpipe/commit/bc7c4eadd11cbaeb260e95768211e401fa39f6f5) Thanks [@yungblud](https://github.com/yungblud)! - - sql.ts: content_hash TEXT GENERATED ALWAYS AS (md5(content)) STORED 컬럼 추가. unique 제약을 UNIQUE(source, content) →
  UNIQUE(source, content_hash)로 변경
  - vector-store.ts: upsert의 onConflict를 "source,content_hash"로 변경

## 0.2.0

### Minor Changes

- [#7](https://github.com/yungblud/ragpipe/pull/7) [`aa9b535`](https://github.com/yungblud/ragpipe/commit/aa9b535dcc47f8c0b7fb128750d2379576fef82e) Thanks [@yungblud](https://github.com/yungblud)! - Add auto setup vector store

### Patch Changes

- Updated dependencies [[`aa9b535`](https://github.com/yungblud/ragpipe/commit/aa9b535dcc47f8c0b7fb128750d2379576fef82e)]:
  - ragpipe@0.3.0

## 0.1.0

### Minor Changes

- [#2](https://github.com/yungblud/ragpipe/pull/2) [`141cdf2`](https://github.com/yungblud/ragpipe/commit/141cdf2fb80acd221e7025f677ca25bdcb4b9f4b) Thanks [@yungblud](https://github.com/yungblud)! - Add Supabase vector store plugin using @supabase/supabase-js SDK with rpc-based search and initial SQL migration

### Patch Changes

- Updated dependencies [[`141cdf2`](https://github.com/yungblud/ragpipe/commit/141cdf2fb80acd221e7025f677ca25bdcb4b9f4b)]:
  - ragpipe@0.1.0
