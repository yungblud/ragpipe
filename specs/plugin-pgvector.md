# @ragpipe/plugin-pgvector — PostgreSQL + pgvector Direct Connection Plugin

Created: 2026-04-11

## Overview

PostgreSQL + pgvector를 Supabase 없이 직접 연결하는 ragpipe VectorStore 플러그인.

Supabase 플러그인은 `@supabase/supabase-js` SDK를 경유하므로 Supabase 프로젝트가 전제된다.
이 플러그인은 표준 PostgreSQL connection string만으로 동작하며,
자체 호스팅 PostgreSQL, AWS RDS, Cloud SQL, Docker local 등 모든 pgvector 환경을 지원한다.

---

## 1. Scope

| 기능 | 포함 여부 | 비고 |
|------|-----------|------|
| Cosine similarity search | O | `<=>` operator |
| Upsert (dedup) | O | `ON CONFLICT (source, content_hash)` |
| Auto setup (table + index) | O | `setup()` with HNSW index |
| isReady check | O | table existence check |
| Clear | O | TRUNCATE |
| Disconnect | O | pool.end() |
| L2 / Inner Product distance | X | MVP는 cosine only |
| Partitioning | X | 후속 범위 |
| Custom index params | X | 후속 범위 |

---

## 2. Why Direct Connection

| 비교 | plugin-supabase | plugin-pgvector |
|------|----------------|-----------------|
| 인증 | Supabase anon/service key | PostgreSQL connection string |
| 의존성 | `@supabase/supabase-js` | `pg` (node-postgres) |
| 쿼리 | Supabase RPC (match function) | 직접 SQL |
| 대상 | Supabase 프로젝트 | 모든 PostgreSQL + pgvector |
| Setup | Supabase migration | 직접 DDL 실행 |

핵심 차이: Supabase 없이도 pgvector를 쓸 수 있어야 한다.
Self-hosted PostgreSQL, Docker compose, AWS RDS 등에서 ragpipe를 사용하는 시나리오를 커버한다.

---

## 3. Dependencies

```json
{
  "dependencies": {
    "pg": "^8.x"
  },
  "devDependencies": {
    "@types/pg": "^8.x"
  }
}
```

`pg`는 Node.js PostgreSQL 클라이언트의 de facto standard.
connection pooling 내장, SSL 지원, parameterized query 기본 제공.

> pgvector 확장은 DB 서버에 설치되어 있어야 한다. 플러그인에서 `CREATE EXTENSION` 시도.

---

## 4. Plugin Interface

### 4.1 Options

```ts
interface PgVectorStoreOptions {
  connectionString: string;
  tableName?: string;    // default: "documents"
  schema?: string;       // default: "public"
  ssl?: boolean;         // default: false
}
```

설명:

- `connectionString`: 표준 PostgreSQL URI (`postgresql://user:pass@host:5432/dbname`)
- `tableName`: vector 저장 테이블명
- `schema`: PostgreSQL schema (multi-tenant 환경 지원)
- `ssl`: RDS 등 SSL 필수 환경용

### 4.2 Factory Function

```ts
function pgVectorStore(options: PgVectorStoreOptions): VectorStorePlugin;
```

| 필드 | 값 |
|------|----|
| `name` | `"pgvector"` |

---

## 5. Database Schema

### 5.1 Table

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS {schema}.{table} (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT GENERATED ALWAYS AS (md5(content)) STORED,
  vector VECTOR({dimensions}),
  UNIQUE(source, content_hash)
);
```

Supabase 플러그인과 동일한 스키마를 사용하여 마이그레이션 호환성 유지.

### 5.2 HNSW Index

```sql
CREATE INDEX IF NOT EXISTS {table}_vector_idx
  ON {schema}.{table}
  USING hnsw (vector vector_cosine_ops);
```

IVFFlat 대비 장점:
- 빌드 후 INSERT에도 인덱스 품질 유지
- recall이 더 안정적
- pgvector 0.5.0+ 기본 권장

### 5.3 Search Query

```sql
SELECT source, content, 1 - (vector <=> $1::vector) AS similarity
FROM {schema}.{table}
ORDER BY vector <=> $1::vector
LIMIT $2;
```

`<=>` = cosine distance. `1 - distance` = similarity (0~1).

---

## 6. Package Structure

```
packages/plugin-pgvector/
├── src/
│   ├── index.ts          ← re-export
│   ├── vector-store.ts   ← pgVectorStore()
│   ├── sql.ts            ← SQL generation helpers
│   └── __tests__/
│       ├── vector-store.test.ts
│       └── sql.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

### package.json 핵심

```json
{
  "name": "@ragpipe/plugin-pgvector",
  "peerDependencies": {
    "ragpipe": ">=0.6.0"
  },
  "dependencies": {
    "pg": "^8.16.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  }
}
```

---

## 7. Implementation Details

### 7.1 `sql.ts` — SQL generation helpers

```ts
export function validateIdentifier(name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
}

export function generateSetupSQL(
  schema: string,
  table: string,
  dimensions: number,
): string {
  validateIdentifier(schema);
  validateIdentifier(table);
  // CREATE EXTENSION + CREATE TABLE + HNSW INDEX
}

export function generateRecreateSQL(
  schema: string,
  table: string,
  dimensions: number,
): string {
  validateIdentifier(schema);
  validateIdentifier(table);
  // DROP TABLE + generateSetupSQL
}
```

### 7.2 `vector-store.ts` — 핵심 구현

```ts
import { Pool } from "pg";
import type { VectorStorePlugin, SearchResult } from "ragpipe";

export function pgVectorStore(options: PgVectorStoreOptions): VectorStorePlugin {
  const table = options.tableName ?? "documents";
  const schema = options.schema ?? "public";
  const pool = new Pool({
    connectionString: options.connectionString,
    ssl: options.ssl ? { rejectUnauthorized: false } : undefined,
  });

  return {
    name: "pgvector",

    async search(vector, topK): Promise<SearchResult[]> {
      const vectorStr = `[${vector.join(",")}]`;
      const { rows } = await pool.query(
        `SELECT source, content, 1 - (vector <=> $1::vector) AS similarity
         FROM ${schema}.${table}
         ORDER BY vector <=> $1::vector
         LIMIT $2`,
        [vectorStr, topK],
      );
      return rows.map((r) => ({
        source: r.source,
        content: r.content,
        score: r.similarity,
      }));
    },

    async upsert(source, content, vector) {
      const vectorStr = `[${vector.join(",")}]`;
      await pool.query(
        `INSERT INTO ${schema}.${table} (source, content, vector)
         VALUES ($1, $2, $3::vector)
         ON CONFLICT (source, content_hash) DO UPDATE SET vector = $3::vector`,
        [source, content, vectorStr],
      );
    },

    async clear() {
      await pool.query(`TRUNCATE ${schema}.${table}`);
    },

    async disconnect() {
      await pool.end();
    },

    async isReady() {
      try {
        await pool.query(
          `SELECT 1 FROM ${schema}.${table} LIMIT 1`,
        );
        return true;
      } catch {
        return false;
      }
    },

    async setup(dimensions, opts) {
      const ready = await this.isReady!();

      if (!ready) {
        await pool.query(generateSetupSQL(schema, table, dimensions));
        return;
      }

      // table exists — check if empty
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ${schema}.${table}`,
      );
      const count = rows[0].count;

      if (count === 0) {
        // empty table — safe to recreate
        await pool.query(generateRecreateSQL(schema, table, dimensions));
        return;
      }

      if (opts?.force) {
        await pool.query(generateRecreateSQL(schema, table, dimensions));
        return;
      }

      // check dimension match
      const dimResult = await pool.query(
        `SELECT vector FROM ${schema}.${table} LIMIT 1`,
      );
      const existingDims = dimResult.rows[0]?.vector
        ? parseVectorDimension(dimResult.rows[0].vector)
        : dimensions;

      if (existingDims !== dimensions) {
        throw new Error(
          `Dimension mismatch: table has ${existingDims}, config requires ${dimensions}. ` +
          `Use setup --force to recreate (data will be lost).`,
        );
      }
    },
  };
}
```

핵심 결정:

1. **Connection pooling**: `pg.Pool` 사용. 매 쿼리마다 connection 생성하지 않음
2. **Vector string format**: pgvector는 `[0.1,0.2,0.3]` 문자열 형식 + `::vector` cast
3. **Dedup**: `ON CONFLICT (source, content_hash)` — content 변경 시 vector 업데이트
4. **TRUNCATE vs DELETE**: `clear()`는 TRUNCATE 사용 (빠르고 vacuum 불필요)
5. **Setup 3-way logic**: Supabase 플러그인과 동일한 fresh/empty/populated 분기

### 7.3 SQL Injection 방지

- `schema`, `tableName`은 `validateIdentifier()`로 사전 검증
- vector, source, content는 parameterized query (`$1`, `$2`) 사용
- 동적 SQL에 사용자 입력이 직접 들어가지 않음

---

## 8. Test Plan

테스트는 실제 PostgreSQL 없이 `pg.Pool` mocking으로 작성한다.

### 8.1 `sql.test.ts`

- [ ] `validateIdentifier()`가 유효한 식별자를 통과시키는지 검증
- [ ] SQL injection 패턴을 거부하는지 검증 (`'; DROP TABLE--` 등)
- [ ] `generateSetupSQL()`이 올바른 dimensions로 SQL을 생성하는지 검증
- [ ] `generateRecreateSQL()`이 DROP TABLE을 포함하는지 검증
- [ ] HNSW index 생성 SQL이 포함되는지 검증

### 8.2 `vector-store.test.ts`

- [ ] plugin metadata 검증 (`name`)
- [ ] `search()` — pool.query 호출 payload 검증 (vector string, topK)
- [ ] `search()` — rows를 SearchResult[]로 매핑하는지 검증
- [ ] `upsert()` — INSERT ON CONFLICT 쿼리 검증
- [ ] `upsert()` — vector를 `[n,n,n]` 형식으로 변환하는지 검증
- [ ] `clear()` — TRUNCATE 호출 검증
- [ ] `disconnect()` — pool.end() 호출 검증
- [ ] `isReady()` — 성공 시 true, 에러 시 false 반환
- [ ] `setup()` — table 없으면 generateSetupSQL 실행
- [ ] `setup()` — empty table이면 recreate
- [ ] `setup()` — 데이터 있고 force 없으면 dimension 체크
- [ ] `setup()` — dimension mismatch 시 에러
- [ ] `setup()` — force: true면 recreate
- [ ] custom schema/tableName 반영 검증
- [ ] pool.query 에러 시 에러 전파 검증

---

## 9. Implementation Steps

### Step 1 — 패키지 스캐폴딩

- [x] `packages/plugin-pgvector/` 생성
- [x] `package.json`, `tsconfig.json`, `tsup.config.ts` 설정
- [x] `src/index.ts` 엔트리 포인트 작성
- [x] `pnpm install`로 workspace 연결

### Step 2 — SQL helpers 작성

- [x] `sql.ts` 작성 (validateIdentifier, generateSetupSQL, generateRecreateSQL, parseVectorDimension)
- [x] `sql.test.ts` 작성

### Step 3 — VectorStore 구현

- [x] `PgVectorStoreOptions` 타입 정의
- [x] `pgVectorStore()` 팩토리 함수 작성
- [x] `search()`, `upsert()`, `clear()`, `disconnect()` 구현
- [x] `isReady()`, `setup()` 구현

### Step 4 — 테스트

- [ ] `vector-store.test.ts` 작성
- [ ] `pnpm turbo run build --filter=@ragpipe/plugin-pgvector`
- [ ] `pnpm turbo run typecheck --filter=@ragpipe/plugin-pgvector`
- [ ] `pnpm turbo run test --filter=@ragpipe/plugin-pgvector`

### Step 5 — CLI init 연동 + 문서

- [ ] `packages/ragpipe/src/cli/init.ts`에 pgvector provider 추가
- [ ] `packages/plugin-pgvector/README.md` 작성
- [ ] changeset 파일 작성

---

## 10. Considerations

### pgvector 확장 필수

이 플러그인은 PostgreSQL에 pgvector 확장이 설치되어 있어야 한다.
`setup()`에서 `CREATE EXTENSION IF NOT EXISTS vector`를 실행하지만,
superuser 권한이 없으면 실패할 수 있다.

에러 메시지에 "pgvector 확장을 먼저 설치해야 합니다"를 명시한다.

### Connection String Security

connection string에 password가 포함되므로 `ragpipe.config.ts`에 하드코딩하지 않도록
사용 예제에서 항상 `process.env.DATABASE_URL`을 권장한다.

### SSL

AWS RDS, Cloud SQL 등은 SSL을 필수로 요구한다.
`ssl: true` 옵션 시 `{ rejectUnauthorized: false }`로 설정.
프로덕션에서는 CA certificate를 별도 지정할 수 있도록 향후 확장 가능.

### Pool Size

MVP에서는 `pg.Pool` 기본 설정 (max 10 connections)을 사용한다.
고부하 ingest 시나리오에서는 사용자가 `connectionString`에 query parameter로 조절하거나,
향후 `poolSize` 옵션을 추가할 수 있다.

### Supabase 플러그인과의 호환성

동일한 테이블 스키마 (`source`, `content`, `content_hash`, `vector`)를 사용하므로,
Supabase에서 셀프호스팅으로 전환하거나 그 반대로 전환할 때 데이터 마이그레이션이 최소화된다.

---

## 11. Usage Examples

### Basic Setup

```ts
import { defineConfig } from "ragpipe";
import { geminiEmbedding, geminiGeneration } from "@ragpipe/plugin-gemini";
import { pgVectorStore } from "@ragpipe/plugin-pgvector";

export default defineConfig({
  embedding: geminiEmbedding({
    apiKey: process.env.GEMINI_API_KEY!,
    model: "gemini-embedding-001",
    dimensions: 3072,
  }),
  vectorStore: pgVectorStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  generation: geminiGeneration({
    apiKey: process.env.GEMINI_API_KEY!,
    model: "gemini-2.5-flash",
  }),
});
```

### Docker Local Development

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: ragpipe
      POSTGRES_USER: ragpipe
      POSTGRES_PASSWORD: ragpipe
    ports:
      - "5432:5432"
```

```ts
pgVectorStore({
  connectionString: "postgresql://ragpipe:ragpipe@localhost:5432/ragpipe",
});
```

### AWS RDS with SSL

```ts
pgVectorStore({
  connectionString: process.env.RDS_DATABASE_URL!,
  ssl: true,
});
```

### Custom Schema

```ts
pgVectorStore({
  connectionString: process.env.DATABASE_URL!,
  schema: "rag",
  tableName: "knowledge_base",
});
```

---

## 12. Out of Scope for MVP

- L2 distance / inner product distance 옵션
- Custom HNSW index parameters (m, ef_construction)
- Table partitioning
- Read replica 지원
- Batch upsert (single INSERT ... VALUES (...), (...))
- Connection pool size 옵션
- CA certificate 직접 지정

MVP 완료 기준:

1. `connectionString`만으로 PostgreSQL + pgvector에 연결된다.
2. `setup()`으로 테이블 + HNSW 인덱스가 자동 생성된다.
3. `upsert()`, `search()`, `clear()`가 정상 동작한다.
4. Supabase 플러그인과 동일한 스키마로 호환성이 유지된다.
