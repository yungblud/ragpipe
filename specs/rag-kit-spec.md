# ragpipe — 플러그인 기반 TypeScript RAG 툴킷

작성일: 2026-04-01

## 한 줄 요약

`defineConfig()` 하나로 Embedding, VectorStore, Generation을 조합하는
TypeScript 네이티브 RAG 프레임워크.

---

## 1. 왜 만드는가

### 문제

RAG를 직접 구축하려면 항상 같은 세 가지를 반복 구현한다:

1. 문서 → 청크 → 임베딩 → 벡터 DB 저장 (ingest)
2. 질문 → 임베딩 → 유사도 검색 → Top-K 추출 (search)
3. 질문 + 컨텍스트 → LLM → 답변 생성 (generate)

프로바이더 조합은 다양한데 (Gemini, OpenAI, Voyage, Ollama, Bedrock × Supabase, Pinecone, pgvector × Claude, GPT, Gemini…)
매번 프로바이더별 SDK와 호출 방식을 직접 연결하는 글루 코드를 작성해야 한다.

### 기존 대안의 한계

| 프레임워크 | 문제 |
|-----------|------|
| LangChain (Python) | 추상화가 너무 두꺼움. Chain, Agent, Tool, Memory 등 개념이 많아 학습 곡선이 높음 |
| LangChain.js | Python 포팅 느낌. 타입이 느슨하고 번들이 무거움 |
| LlamaIndex | Python 중심. TS 버전은 미성숙 |
| Vercel AI SDK | 생성(streaming) 중심. Embedding/VectorStore 파이프라인은 직접 구현 필요 |

### ragpipe의 포지션

> **"TypeScript로 된, LangChain보다 10배 작은, hot-updater 스타일의 플러그인 RAG 툴킷"**

- 함수 4개 이해하면 끝: `embed`, `search`, `upsert`, `generate`
- `defineConfig()` 한 파일로 전체 구성
- 프로바이더 플러그인을 npm에서 골라 끼우면 동작
- CLI로 `npx ragpipe ingest ./docs/` 한 줄이면 문서 적재 완료

---

## 2. 설계 배경

이 프로젝트는 프로덕션에서 동작 중인 RAG 시스템을 플러그인 구조로 추출한 것이다.
원형 시스템의 각 컴포넌트가 이미 동일 시그니처로 분리되어 있어 플러그인화가 자연스럽다.

### 플러그인 축별 시그니처

| 역할 | 시그니처 | 비고 |
|------|----------|------|
| Embedding | `(text: string) → Promise<number[]>` | 프로바이더별 동일 |
| VectorStore | `search`, `upsert`, `clear` | CRUD 3개 |
| Generation | `(question, context, history?) → Promise<string>` | LLM 호출 |
| Chunker | `(text, source) → DocumentChunk[]` | 문서 분할 |
| Rate Limiter | `createRateLimitedEmbedder()` | 코어로 흡수 |
| Pipeline | `search(query, topK) → SearchResult[]` | 코어로 흡수 |

**핵심: 각 함수가 이미 플러그인 시그니처를 따르고 있어,
인터페이스 추출 + 패키지 분리만 하면 프레임워크가 된다.**

---

## 3. 아키텍처

### 플러그인 4축

```
ragpipe
├── embedding     ← 텍스트 → 벡터 변환
├── vectorStore   ← 벡터 저장 / 유사도 검색
├── generation    ← 질문 + 컨텍스트 → 답변 생성
└── chunker       ← 문서 → 청크 분할 (기본 내장)
```

hot-updater가 `build × storage × database` 3축을 조합하듯,
ragpipe은 `embedding × vectorStore × generation` 3축을 조합한다.
chunker는 기본 내장이되 커스텀 교체 가능.

### 사용자 설정 — `defineConfig`

```ts
// ragpipe.config.ts
import { defineConfig } from "ragpipe";
import { geminiEmbedding } from "@ragpipe/gemini";
import { supabaseVectorStore } from "@ragpipe/supabase";
import { geminiGeneration } from "@ragpipe/gemini";

export default defineConfig({
  embedding: geminiEmbedding({
    apiKey: process.env.GEMINI_API_KEY!,
    model: "gemini-embedding-001",
  }),
  vectorStore: supabaseVectorStore({
    databaseUrl: process.env.DATABASE_URL!,
    tableName: "documents",
    dimensions: 3072,
  }),
  generation: geminiGeneration({
    apiKey: process.env.GEMINI_API_KEY!,
    model: "gemini-2.5-flash",
    systemPrompt: "컨텍스트 기반으로 답변하세요.",
  }),
  chunker: { chunkSize: 400 },
});
```

다른 조합 예시:

```ts
// Bedrock Claude + Voyage + Supabase
import { voyageEmbedding } from "@ragpipe/voyage";
import { supabaseVectorStore } from "@ragpipe/supabase";
import { bedrockGeneration } from "@ragpipe/bedrock";

export default defineConfig({
  embedding: voyageEmbedding({
    apiKey: process.env.VOYAGE_API_KEY!,
    model: "voyage-3-lite",
  }),
  vectorStore: supabaseVectorStore({
    databaseUrl: process.env.DATABASE_URL!,
  }),
  generation: bedrockGeneration({
    region: "us-east-1",
    model: "anthropic.claude-3-5-haiku-20241022-v1:0",
  }),
});
```

```ts
// 로컬 풀스택 — Ollama + SQLite
import { ollamaEmbedding } from "@ragpipe/ollama";
import { sqliteVectorStore } from "@ragpipe/sqlite";
import { ollamaGeneration } from "@ragpipe/ollama";

export default defineConfig({
  embedding: ollamaEmbedding({ model: "bge-m3" }),
  vectorStore: sqliteVectorStore({ path: "./rag.db" }),
  generation: ollamaGeneration({ model: "llama3" }),
});
```

---

## 4. 핵심 인터페이스

### `types.ts`

```ts
export interface SearchResult {
  source: string;
  content: string;
  score: number;
}

export interface DocumentChunk {
  source: string;
  content: string;
}

export interface EmbeddingPlugin {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedMany?(texts: string[]): Promise<number[][]>;
  rateLimit?: { delayMs: number };
}

export interface VectorStorePlugin {
  readonly name: string;
  search(vector: number[], topK: number): Promise<SearchResult[]>;
  upsert(source: string, content: string, vector: number[]): Promise<void>;
  clear?(): Promise<void>;
  disconnect?(): Promise<void>;
}

export interface GenerationPlugin {
  readonly name: string;
  generate(
    question: string,
    context: string,
    options?: { history?: string; systemPrompt?: string },
  ): Promise<string>;
  generateStream?(
    question: string,
    context: string,
    options?: { history?: string; systemPrompt?: string },
  ): AsyncIterable<string>;
}

export interface ChunkerPlugin {
  readonly name: string;
  chunk(text: string, source: string): DocumentChunk[];
}

export interface RagpipeConfig {
  embedding: EmbeddingPlugin;
  vectorStore: VectorStorePlugin;
  generation: GenerationPlugin;
  chunker?: ChunkerPlugin;
  systemPrompt?: string;
}
```

### `pipeline.ts` — 코어 파이프라인

```ts
export function createPipeline(config: RagpipeConfig) {
  const chunker = config.chunker ?? defaultChunker();

  return {
    /** 문서를 청크 → 임베딩 → 벡터 DB에 저장 */
    async ingest(text: string, source: string): Promise<number> {
      const chunks = chunker.chunk(text, source);
      for (const chunk of chunks) {
        const vector = await config.embedding.embed(chunk.content);
        await config.vectorStore.upsert(chunk.source, chunk.content, vector);
      }
      return chunks.length;
    },

    /** 질문 → 임베딩 → 유사도 검색 */
    async search(query: string, topK = 5): Promise<SearchResult[]> {
      const vector = await config.embedding.embed(query);
      return config.vectorStore.search(vector, topK);
    },

    /** 질문 → 검색 → 컨텍스트 조합 → LLM 답변 생성 */
    async ask(query: string, topK = 5): Promise<AskResult> {
      const chunks = await this.search(query, topK);
      const context = chunks
        .map((c) => `[${c.source}]\n${c.content}`)
        .join("\n\n---\n\n");
      const answer = await config.generation.generate(query, context);
      return { answer, sources: chunks };
    },
  };
}
```

---

## 5. 패키지 구조

```
ragpipe/
├── packages/
│   ├── ragpipe/                     ← 코어
│   │   ├── src/
│   │   │   ├── types.ts             ← 플러그인 인터페이스
│   │   │   ├── config.ts            ← defineConfig()
│   │   │   ├── pipeline.ts          ← ingest, search, ask
│   │   │   ├── chunker.ts           ← 기본 내장 chunker
│   │   │   ├── rate-limiter.ts      ← 범용 rate limiter
│   │   │   └── cli/
│   │   │       ├── index.ts         ← CLI 진입점
│   │   │       ├── ingest.ts        ← ragpipe ingest 명령
│   │   │       ├── ask.ts           ← ragpipe ask 명령
│   │   │       └── init.ts          ← ragpipe init 명령
│   │   └── package.json
│   │
│   │   # ── Embedding 플러그인 ──
│   ├── plugin-gemini/               ← Gemini embedding + generation
│   ├── plugin-voyage/               ← Voyage AI embedding
│   ├── plugin-ollama/               ← Ollama embedding + generation (로컬)
│   ├── plugin-cloudflare/           ← Cloudflare Workers AI embedding
│   ├── plugin-bedrock/              ← AWS Bedrock embedding + generation
│   ├── plugin-openai/               ← OpenAI embedding + generation
│   │
│   │   # ── VectorStore 플러그인 ──
│   ├── plugin-supabase/             ← Supabase pgvector
│   ├── plugin-pgvector/             ← PostgreSQL + pgvector 직접 연결
│   └── plugin-sqlite-vec/           ← SQLite + sqlite-vec (로컬)
│
├── examples/
│   ├── with-gemini-supabase/        ← Gemini + Supabase 기본 조합
│   ├── with-bedrock-supabase/       ← Bedrock Claude + Supabase
│   ├── with-ollama-sqlite/          ← 완전 로컬 (API 키 불필요)
│   └── with-slack-bot/              ← Slack 봇 연동 예시
│
├── docs/                            ← 문서 사이트 (Fumadocs 또는 Starlight)
├── ragpipe.config.ts                ← 루트 예시 설정
└── package.json                     ← monorepo 루트
```

### npm 패키지 네이밍

| 패키지 | npm 이름 |
|--------|---------|
| 코어 | `ragpipe` |
| Gemini | `@ragpipe/plugin-gemini` |
| Voyage | `@ragpipe/plugin-voyage` |
| Ollama | `@ragpipe/plugin-ollama` |
| Cloudflare | `@ragpipe/plugin-cloudflare` |
| Bedrock | `@ragpipe/plugin-bedrock` |
| OpenAI | `@ragpipe/plugin-openai` |
| Supabase | `@ragpipe/plugin-supabase` |
| pgvector | `@ragpipe/plugin-pgvector` |
| SQLite | `@ragpipe/plugin-sqlite-vec` |

---

## 6. CLI

### 명령어

```bash
# 프로젝트 초기화 — ragpipe.config.ts 스캐폴딩
npx ragpipe init

# 문서 인제스트
npx ragpipe ingest ./docs/
npx ragpipe ingest ./docs/privacy-policy.md

# CLI에서 직접 질문
npx ragpipe ask "전자의무기록 보존 기간은?"

# 벡터 DB 초기화
npx ragpipe clear

# 상태 확인
npx ragpipe status
```

### `ragpipe init` 플로우

```
$ npx ragpipe init

? Embedding 프로바이더를 선택하세요:
  ❯ Gemini (Google)
    OpenAI
    Voyage AI
    Ollama (로컬)
    Cloudflare Workers AI
    AWS Bedrock

? VectorStore를 선택하세요:
  ❯ Supabase (pgvector)
    PostgreSQL (pgvector 직접)
    SQLite (로컬)

? Generation LLM을 선택하세요:
  ❯ Gemini
    OpenAI (GPT)
    AWS Bedrock (Claude)
    Ollama (로컬)

✔ ragpipe.config.ts 생성 완료
✔ 필요 패키지: @ragpipe/plugin-gemini, @ragpipe/plugin-supabase
✔ pnpm add ragpipe @ragpipe/plugin-gemini @ragpipe/plugin-supabase 실행 완료
```

---

## 7. 플러그인 구현 예시

### Gemini Embedding 플러그인

Gemini Embedding API를 래핑한 플러그인:

```ts
// packages/plugin-gemini/src/embedding.ts
import type { EmbeddingPlugin } from "ragpipe";

interface GeminiEmbeddingOptions {
  apiKey: string;
  model?: string;
}

export function geminiEmbedding(options: GeminiEmbeddingOptions): EmbeddingPlugin {
  const model = options.model ?? "gemini-embedding-001";

  return {
    name: "gemini",
    dimensions: 3072,
    rateLimit: { delayMs: 800 },

    async embed(text: string): Promise<number[]> {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${options.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: { parts: [{ text }] } }),
        },
      );

      if (!res.ok) {
        throw new Error(`Gemini embedding error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json() as { embedding: { values: number[] } };
      return data.embedding.values;
    },
  };
}
```

### Supabase VectorStore 플러그인

Supabase pgvector를 래핑한 플러그인:

```ts
// packages/plugin-supabase/src/vector-store.ts
import type { VectorStorePlugin, SearchResult } from "ragpipe";
import postgres from "postgres";

interface SupabaseVectorStoreOptions {
  databaseUrl: string;
  tableName?: string;
  dimensions?: number;
}

export function supabaseVectorStore(options: SupabaseVectorStoreOptions): VectorStorePlugin {
  const table = options.tableName ?? "documents";
  const sql = postgres(options.databaseUrl);

  return {
    name: "supabase",

    async search(vector: number[], topK: number): Promise<SearchResult[]> {
      const vectorStr = `[${vector.join(",")}]`;
      const results = await sql`
        SELECT source, content,
          1 - (vector <=> ${vectorStr}::vector) AS score
        FROM ${sql(table)}
        ORDER BY vector <=> ${vectorStr}::vector
        LIMIT ${topK}
      `;
      return results as unknown as SearchResult[];
    },

    async upsert(source: string, content: string, vector: number[]): Promise<void> {
      const vectorStr = `[${vector.join(",")}]`;
      await sql`
        INSERT INTO ${sql(table)} (source, content, vector)
        SELECT ${source}, ${content}, ${vectorStr}::vector
        WHERE NOT EXISTS (
          SELECT 1 FROM ${sql(table)}
          WHERE source = ${source} AND content = ${content}
        )
      `;
    },

    async clear(): Promise<void> {
      await sql`TRUNCATE TABLE ${sql(table)}`;
    },

    async disconnect(): Promise<void> {
      await sql.end();
    },
  };
}
```

---

## 8. 프로그래매틱 사용

CLI 외에 코드에서 직접 사용:

```ts
// app.ts
import { loadConfig, createPipeline } from "ragpipe";

const config = await loadConfig(); // ragpipe.config.ts 자동 로드
const rag = createPipeline(config);

// 문서 인제스트
const chunkCount = await rag.ingest(markdownText, "docs/guide.md");
console.log(`${chunkCount}개 청크 저장 완료`);

// 질문
const result = await rag.ask("사용자 인증은 어떻게 하나요?");
console.log(result.answer);
console.log("출처:", result.sources.map((s) => s.source));
```

### Fastify 라우트 예시

```ts
// routes/ask.ts
import { createPipeline, loadConfig } from "ragpipe";

const rag = createPipeline(await loadConfig());

app.post("/ask", async (req, reply) => {
  const { query } = req.body;
  const result = await rag.ask(query, 5);
  return { answer: result.answer, sources: result.sources.map((s) => s.source) };
});
```

### Slack 봇 예시

```ts
// slack.ts
import { createPipeline, loadConfig } from "ragpipe";

const rag = createPipeline(await loadConfig());

slackApp.event("app_mention", async ({ event, client }) => {
  const result = await rag.ask(event.text);
  await client.chat.postMessage({
    channel: event.channel,
    text: result.answer,
  });
});
```

---

## 9. 차별화 — 왜 LangChain이 아닌가

| 기준 | LangChain.js | ragpipe |
|------|-------------|---------|
| 번들 크기 | ~2MB+ (의존성 포함) | 코어 <50KB |
| 학습 곡선 | Chain, Agent, Tool, Memory 등 | 함수 4개: `ingest`, `search`, `ask`, `generate` |
| 설정 방식 | 코드에서 직접 조립 | `defineConfig()` 선언형 |
| CLI | 없음 | `npx ragpipe ingest/ask/init` |
| TypeScript | 타입이 느슨한 부분 다수 | 처음부터 strict 타입 설계 |
| 추상화 수준 | 범용 AI 프레임워크 | **RAG 전용** — 한 가지만 잘 함 |
| 플러그인 발견 | 문서를 읽고 직접 조합 | `ragpipe init`으로 인터랙티브 선택 |
| 영감 | — | hot-updater의 `defineConfig` 패턴 |

핵심 철학:

> **"RAG는 함수 3개의 조합이다: embed → search → generate.
> 나머지는 전부 플러그인 선택의 문제다."**

---

## 10. 로드맵

### Phase 0 — 레포 초기화 (1일)

- [ ] monorepo 구성 (pnpm workspace + turborepo)
- [ ] 코어 패키지 스캐폴딩 (`ragpipe`)
- [ ] `types.ts` — 플러그인 인터페이스 확정
- [ ] `config.ts` — `defineConfig()` + `loadConfig()`
- [ ] `pipeline.ts` — `createPipeline()`
- [ ] `chunker.ts` — 기본 내장 chunker (단락 기반, 크기 제한)
- [ ] `rate-limiter.ts` — 범용 rate-limited embedder

### Phase 1 — 첫 플러그인 3개 (2~3일)

최소 동작 가능한 조합으로 MVP 구현:

- [ ] `@ragpipe/plugin-gemini` — embedding + generation
- [ ] `@ragpipe/plugin-supabase` — vectorStore
- [ ] 코어 CLI (`init`, `ingest`, `ask`)
- [ ] `examples/with-gemini-supabase/` — 기본 예시

Phase 1 완료 시점에 다음이 가능해야 한다:

```bash
npx ragpipe init          # → config 생성
npx ragpipe ingest ./docs # → 문서 적재
npx ragpipe ask "질문"     # → 답변 반환
```

### Phase 2 — 플러그인 확장 (1~2주)

- [ ] `@ragpipe/plugin-voyage` — Voyage AI embedding
- [ ] `@ragpipe/plugin-ollama` — 로컬 embedding + generation
- [ ] `@ragpipe/plugin-cloudflare` — Cloudflare Workers AI embedding
- [ ] `@ragpipe/plugin-bedrock` — AWS Bedrock embedding + generation
- [ ] `@ragpipe/plugin-openai` — OpenAI embedding + generation
- [ ] `@ragpipe/plugin-pgvector` — PostgreSQL 직접 연결
- [ ] `@ragpipe/plugin-sqlite-vec` — SQLite 로컬 벡터 DB

### Phase 3 — 고도화 (2~4주)

- [ ] 스트리밍 응답 (`generateStream`)
- [ ] 배치 임베딩 (`embedMany`) — rate limit 자동 처리
- [ ] 문서 사이트 (Fumadocs 또는 Starlight)
- [ ] GitHub Actions CI/CD + npm 자동 배포
- [ ] `ragpipe dev` — 로컬 웹 UI로 인제스트/검색 테스트
- [ ] 커스텀 chunker 플러그인 지원 (Markdown 헤더 기반, 코드 블록 인식 등)

### Phase 4 — 에코시스템 (장기)

- [ ] 커뮤니티 플러그인 지원 (third-party plugin 등록)
- [ ] `ragpipe deploy` — Vercel/Cloudflare Workers 원클릭 배포
- [ ] 멀티모달 임베딩 (이미지, PDF)
- [ ] Re-ranker 플러그인 축 추가 (Cohere Rerank 등)

---

## 11. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 언어 | TypeScript 5.x (strict) | 대상 사용자가 TS/JS 개발자 |
| 모노레포 | pnpm workspace + turborepo | hot-updater와 동일한 검증된 구성 |
| 빌드 | tsup | 빠르고 ESM/CJS 동시 출력 |
| CLI | citty 또는 commander | 경량 CLI 프레임워크 |
| 설정 로더 | jiti 또는 c12 | TS config 파일 런타임 로드 |
| 린터 | Biome | 빠르고 설정이 단순 |
| 테스트 | Vitest | TS 네이티브, 빠른 실행 |
| 문서 | Fumadocs 또는 Starlight | MDX 기반, 검색 내장 |

---

## 12. 리스크 및 고려사항

### 네이밍 — 확정: `ragpipe`

npm 패키지명 `ragpipe`와 org scope `@ragpipe` 모두 사용 가능 확인 완료 (2026-04-06).
기존 후보였던 `rag-kit`은 npm org `@rag-kit`이 제3자에 의해 선점되어 사용 불가.
`ragkit`은 기존 LangChain 기반 RAG 프레임워크가 점유 중.

"pipe"는 파이프라인 아키텍처(embed → search → generate)를 직관적으로 전달하며,
Unix pipe 철학("한 가지를 잘 하고 조합한다")과도 부합한다.

### 유지보수 부담

플러그인 수가 늘어나면 프로바이더 API 변경에 따른 유지보수 비용이 생긴다.
Phase 1은 Gemini + Supabase만으로 시작하고, 나머지는 커뮤니티 기여를 유도하는 전략이 현실적이다.

### 프로바이더 API 안정성

- Gemini API: 아직 `v1beta` → 변경 가능성 있음
- Bedrock: 안정적이나 리전별 모델 가용성 차이
- Voyage: 비교적 안정

### 벡터 차원 정합

프로바이더마다 임베딩 차원이 다름 (Gemini: 3072, OpenAI: 1536, Titan: 1024, Voyage: 1024).
VectorStore 플러그인이 `dimensions` 설정을 받아야 하고,
embedding ↔ vectorStore 간 차원 불일치를 코어에서 검증해야 한다.

### 보안

플러그인에 API 키를 넘기는 구조이므로,
`ragpipe.config.ts`가 `.gitignore`에 포함되어야 한다는 안내가 필요하다.
또는 `.env`에서 읽는 패턴을 기본으로 권장.

---

## 13. 결론

RAG의 본질은 `embed → search → generate` 세 함수의 조합이다.
프로바이더별로 동일 시그니처를 따르는 구조가 이미 검증되어 있으며,
인터페이스 추출 + 패키지 분리로 누구나 사용 가능한 프레임워크가 된다.

**Phase 1 목표: `npx ragpipe init` → `npx ragpipe ingest ./docs/` → `npx ragpipe ask "질문"`이 동작하는 MVP.**

Gemini + Supabase 조합 하나만으로 시작하고,
플러그인은 검증된 순서대로 (Ollama → Voyage → Bedrock → OpenAI) 추가한다.
