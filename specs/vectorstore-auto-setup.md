# VectorStore Auto Setup — 동적 차원 + 스키마 자동화

Created: 2026-04-09
Updated: 2026-04-09

## Overview

VectorStore 스키마(테이블, 함수)를 embedding plugin의 `dimensions`에 맞춰 자동 생성한다.
수동 SQL 실행 제거. `ragpipe setup` 명령어로 migration 파일 생성 + `supabase db push` 자동 실행.

> **참고**: [hot-updater](https://github.com/gronxb/hot-updater)의 Supabase plugin이 동일한 패턴 사용.
> `runInit()` → migration SQL 생성 → `supabase db push --include-all` 호출.

---

## 1. 문제

### 현재 상태

```sql
-- 하드코딩된 3072 차원
CREATE TABLE documents (
  vector VECTOR(3072)
);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(3072), ...
);
```

### 왜 문제인가

| Embedding Provider | dimensions |
|-------------------|-----------|
| Gemini (gemini-embedding-001) | 3072 |
| Cloudflare (bge-base-en-v1.5) | 768 |
| Ollama (bge-m3) | 1024 |
| OpenAI (text-embedding-3-small) | 1536 |
| Voyage (voyage-3-lite) | 1024 |

차원 불일치 시 `upsert` 에러 발생. 사용자가 직접 SQL 수정 + 실행해야 함.

---

## 2. 설계

### 2-1. VectorStorePlugin 인터페이스 확장

```ts
export interface VectorStorePlugin {
  readonly name: string;
  search(vector: number[], topK: number): Promise<SearchResult[]>;
  upsert(source: string, content: string, vector: number[]): Promise<void>;
  clear?(): Promise<void>;
  disconnect?(): Promise<void>;

  // NEW
  setup?(dimensions: number): Promise<void>;
  isReady?(): Promise<boolean>;
}
```

| 메서드 | 역할 |
|--------|------|
| `setup(dimensions)` | 테이블 + 함수 생성. dimensions 동적 주입 |
| `isReady()` | 테이블 존재 여부 확인. lazy setup 판단용 |

둘 다 optional — 이미 스키마 있는 환경이나 sqlite-vec 같은 self-contained store는 구현 불필요.

### 2-2. Supabase plugin의 `setup()` 구현 — Supabase CLI 위임 방식

hot-updater 패턴 채택. Supabase JS client로 raw SQL 실행하지 않음.
대신 migration 파일 생성 → `supabase db push` CLI에 위임.

```ts
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export function supabaseVectorStore(options: SupabaseVectorStoreOptions): VectorStorePlugin {
  const table = options.tableName ?? "documents";
  const queryName = options.queryName ?? "match_documents";
  const supabase = createClient(options.supabaseUrl, options.supabaseKey);

  return {
    name: "supabase",

    async setup(dimensions: number): Promise<void> {
      const sql = generateSetupSQL({
        tableName: table,
        queryName: queryName,
        dimensions,
      });

      // 1. Write migration file
      const migrationsDir = join(process.cwd(), "supabase", "migrations");
      if (!existsSync(migrationsDir)) {
        mkdirSync(migrationsDir, { recursive: true });
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T]/g, "")
        .slice(0, 14);
      const fileName = `${timestamp}_ragpipe_init.sql`;
      const filePath = join(migrationsDir, fileName);

      writeFileSync(filePath, sql, "utf-8");

      // 2. Push via Supabase CLI
      try {
        execSync("npx supabase db push --include-all", {
          stdio: "inherit",
          cwd: process.cwd(),
        });
      } catch {
        // CLI 실패 시 fallback: SQL 직접 출력
        consola.warn("supabase db push failed. Run manually:");
        consola.info(`Migration file: ${filePath}`);
        consola.box(sql);
      }
    },

    async isReady(): Promise<boolean> {
      const { error } = await supabase
        .from(table)
        .select("id")
        .limit(1);
      return !error;
    },

    // ... existing search, upsert, clear, disconnect
  };
}
```

#### 왜 Supabase CLI 위임인가

| 방법 | 판정 | 이유 |
|------|------|------|
| `exec_sql` RPC | ✗ | 닭-달걀 문제 (RPC 함수를 먼저 만들어야 함) |
| Supabase Management API | ✗ | service_role key로 불가, 별도 API token 필요 |
| `pg` 직접 연결 | ✗ | `pg` dependency 추가, connection string 노출 |
| **`supabase db push`** | **✓** | **hot-updater 검증 패턴. 추가 dependency 없음. Supabase 사용자라면 CLI 이미 설치** |
| SQL 출력 (fallback) | ✓ | CLI 실패 시 수동 실행 안내 |

### 2-3. SupabaseVectorStoreOptions

기존 옵션 유지. `databaseUrl` 불필요 — Supabase CLI가 `supabase link`로 연결 관리.

```ts
export interface SupabaseVectorStoreOptions {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  queryName?: string;
}
```

---

## 3. CLI 명령어

### `ragpipe setup`

새 CLI 명령어. Config에서 embedding dimensions 읽어서 vectorStore setup 호출.

```bash
$ npx ragpipe setup

✔ Loaded config (embedding: gemini, dimensions: 3072)
✔ Generated migration: supabase/migrations/20260409120000_ragpipe_init.sql
✔ Running supabase db push...
✔ Setup complete!
```

Supabase CLI 미설치 또는 `supabase link` 미완료 시 fallback:

```bash
$ npx ragpipe setup

✔ Loaded config (embedding: gemini, dimensions: 3072)
✔ Generated migration: supabase/migrations/20260409120000_ragpipe_init.sql
⚠ supabase db push failed.

ℹ Option 1: Link and push
  npx supabase link --project-ref <your-project-ref>
  npx supabase db push --include-all

ℹ Option 2: Copy SQL from the migration file and run in Supabase Dashboard → SQL Editor
```

### 전제 조건

`ragpipe setup` (Supabase) 실행 전 필요:

1. `npx supabase init` — `supabase/` 디렉토리 생성 (없으면 `ragpipe setup`이 자동 생성)
2. `npx supabase link --project-ref <ref>` — 원격 프로젝트 연결
3. DB password 입력 (첫 push 시)

### `ragpipe setup` 구현

```ts
export const setupCommand = defineCommand({
  meta: {
    name: "setup",
    description: "Set up vector store schema",
  },
  async run() {
    const config = await loadConfig();
    const { embedding, vectorStore } = config;

    consola.info(
      `Embedding: ${embedding.name}, dimensions: ${embedding.dimensions}`
    );

    if (!vectorStore.setup) {
      consola.warn(
        `${vectorStore.name} does not support auto-setup. Manual configuration required.`
      );
      return;
    }

    await vectorStore.setup(embedding.dimensions);
    consola.success("Vector store setup complete!");
  },
});
```

### `ingest` 시점 lazy setup

```ts
// pipeline.ts — createPipeline 내부
async ingest(text: string, source: string): Promise<number> {
  // lazy setup: 첫 ingest 시 테이블 없으면 자동 생성
  if (config.vectorStore.isReady && config.vectorStore.setup) {
    const ready = await config.vectorStore.isReady();
    if (!ready) {
      consola.info("Vector store not ready. Running setup...");
      await config.vectorStore.setup(config.embedding.dimensions);
    }
  }

  const chunks = chunker.chunk(text, source);
  // ... existing logic
}
```

---

## 4. 기존 migration SQL 파일 처리

### Before (하드코딩)

```
packages/plugin-supabase/sql/migrations/20260406164614_init.sql
```

### After

정적 SQL 파일 → **템플릿 함수**로 전환.

```ts
// packages/plugin-supabase/src/sql.ts
export function generateSetupSQL(options: {
  tableName: string;
  queryName: string;
  dimensions: number;
}): string {
  return `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ${options.tableName} (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  vector VECTOR(${options.dimensions}),
  UNIQUE(source, content)
);

CREATE OR REPLACE FUNCTION ${options.queryName}(
  query_embedding VECTOR(${options.dimensions}),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  source TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.source,
    d.content,
    1 - (d.vector <=> query_embedding) AS similarity
  FROM ${options.tableName} d
  ORDER BY d.vector <=> query_embedding
  LIMIT match_count;
END;
$$;
  `.trim();
}
```

기존 `sql/migrations/` 디렉토리는 참조용으로 유지하되, 실제 setup은 `generateSetupSQL()` 사용.

---

## 5. init 시점 통합

`ragpipe init` 완료 후 안내 메시지에 setup 단계 추가:

```
✔ ragpipe.config.ts created
ℹ Required packages: ragpipe, @ragpipe/plugin-gemini, @ragpipe/plugin-supabase
ℹ Run: pnpm add ragpipe @ragpipe/plugin-gemini @ragpipe/plugin-supabase

Next steps:
  1. pnpm add ragpipe @ragpipe/plugin-gemini @ragpipe/plugin-supabase
  2. npx ragpipe setup     ← NEW: 벡터 스토어 스키마 생성
  3. npx ragpipe ingest ./docs/
  4. npx ragpipe ask "your question"
```

---

## 6. 구현 단계

### Step 1 — VectorStorePlugin 인터페이스 확장
- [x] `types.ts`에 `setup?(dimensions: number): Promise<void>`, `isReady?(): Promise<boolean>` 추가

### Step 2 — SQL 템플릿 함수
- [x] `plugin-supabase/src/sql.ts` — `generateSetupSQL()` 작성
- [x] `validateIdentifier()` SQL injection 방지 함수
- [x] 기존 `sql/migrations/20260406164614_init.sql`은 참조용 유지

### Step 3 — Supabase plugin setup 구현
- [x] `setup()` — migration 파일 생성 + `supabase db push` 실행
- [x] `isReady()` — 테이블 존재 여부 확인
- [x] CLI 실패 시 fallback: SQL 출력 + 수동 실행 안내

### Step 4 — CLI `ragpipe setup` 명령어
- [x] `cli/setup.ts` 작성
- [x] `cli.ts`에 명령어 등록
- [x] `--force` 옵션 (drop + recreate)

### Step 5 — ingest lazy setup
- [x] `pipeline.ts`에 lazy setup 로직 추가
- [x] 첫 ingest 시 `isReady()` → `setup()` 자동 호출

### Step 6 — init 안내 메시지 개선
- [x] `cli/init.ts`에 "Next steps" 출력 추가 (setup 단계 포함)

### Step 7 — 테스트/빌드
- [ ] 단위 테스트 (`generateSetupSQL`, setup flow)
- [ ] `pnpm biome check --write`
- [ ] `pnpm turbo check:type`

---

## 7. 고려 사항

### Supabase CLI 의존성

`supabase db push` 사용 시 Supabase CLI 필요. 하지만:

- Supabase vectorStore 선택한 사용자는 이미 CLI 사용 중일 가능성 높음
- `npx supabase` 로 실행 → 글로벌 설치 불필요
- CLI 없어도 migration SQL 파일은 생성됨 → 수동 실행 가능 (fallback)

### SQL Injection 방지

`tableName`, `queryName`은 사용자 입력. SQL identifier로 사용되므로:

- 영숫자 + 언더스코어만 허용하는 validation 필수
- parameterized query는 DDL에 적용 불가 → identifier sanitization으로 처리

```ts
function validateIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return name;
}
```

### 차원 변경 시 (re-setup)

Embedding provider 변경 → 차원 변경 시, 기존 테이블 drop 필요.
`setup`은 `CREATE TABLE IF NOT EXISTS`이므로 기존 테이블 유지.

별도 `ragpipe reset` 또는 `ragpipe setup --force` 옵션으로 처리:

```bash
$ npx ragpipe setup --force
⚠ This will drop and recreate table "documents". All data will be lost.
? Continue? (y/N)
```

### sqlite-vec 플러그인

sqlite-vec는 파일 기반이므로 `setup()`에서 테이블 자동 생성 가능.
`better-sqlite3`가 DDL 직접 실행 — Supabase CLI 같은 외부 도구 불필요.

---

## 8. hot-updater 참고 사항

### 검증된 패턴

[hot-updater/plugins/supabase](https://github.com/gronxb/hot-updater/tree/main/plugins/supabase)에서 동일 구조 사용:

| hot-updater | ragpipe (계획) |
|-------------|---------------|
| `supabase/scaffold/migrations/*.sql` | `generateSetupSQL()` 동적 생성 |
| `runInit()` → `supabase link` + `supabase db push` | `ragpipe setup` → migration 생성 + `supabase db push` |
| 런타임은 Supabase JS client CRUD만 | 동일 — `search`, `upsert`, `clear` only |
| `make-migrations.ts` 스크립트로 버전별 migration 생성 | 향후 버전 업그레이드 시 동일 패턴 도입 가능 |

### 차이점

- hot-updater: 정적 SQL 파일 (scaffold에서 복사)
- ragpipe: **동적 SQL 생성** — `dimensions` 파라미터에 따라 `VECTOR(N)` 변동
- hot-updater: bucket name 템플릿 치환
- ragpipe: tableName, queryName, dimensions 템플릿 치환
