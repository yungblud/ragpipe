---
"@ragpipe/plugin-supabase": minor
---

- sql.ts: content_hash TEXT GENERATED ALWAYS AS (md5(content)) STORED 컬럼 추가. unique 제약을 UNIQUE(source, content) →
   UNIQUE(source, content_hash)로 변경
- vector-store.ts: upsert의 onConflict를 "source,content_hash"로 변경
