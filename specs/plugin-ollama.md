# @ragpipe/plugin-ollama — Ollama Local Embedding + Generation Plugin

Created: 2026-04-09

## Overview

Ollama의 로컬 Embedding + Generation을 ragpipe 플러그인으로 제공한다.
`http://localhost:11434` REST API를 직접 호출하며, 외부 의존성 없이 native `fetch`만 사용한다.
API key 불필요 — `plugin-sqlite-vec`와 조합하면 완전 로컬 RAG 구성 가능.

---

## 1. Scope

| 기능 | 포함 여부 | 비고 |
|------|-----------|------|
| Embedding | O | `bge-m3` 기본 |
| Generation | O | `llama3` 기본 |
| Streaming | O | NDJSON 기반 `generateStream` |
| Batch Embedding | O | `embedMany` — `/api/embed` 배열 입력 지원 |

---

## 2. API Reference

### Ollama REST API

Ollama 서버가 `ollama serve`로 실행 중이어야 함.

#### Embedding — `POST /api/embed`

```json
// Request
{
  "model": "bge-m3",
  "input": "hello world"
}

// Response
{
  "model": "bge-m3",
  "embeddings": [[0.123, -0.456, ...]]
}
```

배열 입력도 동일 엔드포인트:

```json
// Request (batch)
{
  "model": "bge-m3",
  "input": ["hello", "world"]
}

// Response
{
  "model": "bge-m3",
  "embeddings": [[0.123, ...], [0.789, ...]]
}
```

#### Generation — `POST /api/chat`

```json
// Request
{
  "model": "llama3",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false
}

// Response
{
  "model": "llama3",
  "message": {
    "role": "assistant",
    "content": "generated text here"
  },
  "done": true
}
```

Streaming (`"stream": true`) 시 NDJSON 형식:

```
{"model":"llama3","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"llama3","message":{"role":"assistant","content":" world"},"done":false}
{"model":"llama3","message":{"role":"assistant","content":""},"done":true}
```

> **Gemini/Cloudflare와 차이**: SSE(`data: ...`)가 아닌 NDJSON(줄 단위 JSON). 파싱 로직 다름.

---

## 3. Plugin Interfaces

### Embedding

```ts
interface OllamaEmbeddingOptions {
  model: string;        // e.g. "bge-m3", "nomic-embed-text"
  baseUrl?: string;     // default: "http://localhost:11434"
  dimensions?: number;  // model-dependent, user 명시 가능
}

function ollamaEmbedding(options: OllamaEmbeddingOptions): EmbeddingPlugin;
```

| 필드 | 값 |
|------|----|
| `name` | `"ollama"` |
| `dimensions` | options.dimensions ?? `1024` (bge-m3 기준) |
| `rateLimit` | 없음 (로컬 실행) |

### Generation

```ts
interface OllamaGenerationOptions {
  model: string;           // e.g. "llama3", "mistral", "gemma2"
  baseUrl?: string;        // default: "http://localhost:11434"
  systemPrompt?: string;
}

function ollamaGeneration(options: OllamaGenerationOptions): GenerationPlugin;
```

---

## 4. 지원 모델

### Embedding Models

| 모델 | 차원 | 비고 |
|------|------|------|
| `bge-m3` | 1024 | 기본값, 다국어 지원 |
| `nomic-embed-text` | 768 | 경량, 영어 특화 |
| `mxbai-embed-large` | 1024 | 높은 정확도 |
| `all-minilm` | 384 | 초경량 |

### Generation Models

| 모델 | 비고 |
|------|------|
| `llama3` | 기본값, Meta Llama 3 |
| `llama3.1` | 최신 Llama |
| `mistral` | Mistral 7B |
| `gemma2` | Google Gemma 2 |
| `phi3` | Microsoft Phi-3 |
| `qwen2` | Alibaba Qwen 2 |

> 모델 사전 설치 필요: `ollama pull bge-m3`, `ollama pull llama3`

---

## 5. 패키지 구조

```
packages/plugin-ollama/
├── src/
│   ├── index.ts          ← re-export
│   ├── embedding.ts      ← ollamaEmbedding()
│   ├── generation.ts     ← ollamaGeneration()
│   └── __tests__/
│       ├── embedding.test.ts
│       └── generation.test.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### package.json 핵심

```json
{
  "name": "@ragpipe/plugin-ollama",
  "peerDependencies": {
    "ragpipe": ">=0.1.0"
  },
  "dependencies": {},
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  }
}
```

> 외부 dependency 0개. Pure `fetch` only.

---

## 6. 구현 단계

### Step 1 — 패키지 스캐폴딩
- [ ] `packages/plugin-ollama/` 생성
- [ ] `package.json`, `tsconfig.json`, `tsup.config.ts` 설정
- [ ] `src/index.ts` 엔트리 포인트

### Step 2 — Embedding 구현
- [ ] `OllamaEmbeddingOptions` 타입 정의
- [ ] `ollamaEmbedding()` 팩토리 함수
- [ ] `embed()` — `POST /api/embed` 단일 텍스트
- [ ] `embedMany()` — 배열 입력 배치 처리
- [ ] 에러 핸들링 (Ollama 서버 미실행, 모델 미설치 등)

### Step 3 — Generation 구현
- [ ] `OllamaGenerationOptions` 타입 정의
- [ ] `ollamaGeneration()` 팩토리 함수
- [ ] `generate()` — `POST /api/chat` with `stream: false`
- [ ] `generateStream()` — NDJSON 파싱 + AsyncIterable
- [ ] system prompt, history 지원

### Step 4 — 빌드/테스트 검증
- [ ] `pnpm turbo run build` 통과
- [ ] `pnpm biome check --write` 통과
- [ ] `pnpm turbo check:type` 통과
- [ ] 단위 테스트 작성 (vitest, fetch mock)

### Step 5 — 배포 준비
- [ ] changeset 파일 작성
- [ ] spec 로드맵 체크리스트 업데이트

---

## 7. 고려 사항

### 모델별 차원 분기

Embedding 모델마다 차원 다름. 모델명 → 차원 자동 매핑 + 사용자 override 지원.

```ts
const DIMENSION_MAP: Record<string, number> = {
  "bge-m3": 1024,
  "nomic-embed-text": 768,
  "mxbai-embed-large": 1024,
  "all-minilm": 384,
};
```

### Ollama 서버 연결 실패

`fetch` 실패 시 (ECONNREFUSED) 명확한 에러 메시지 필요:

```
Error: Ollama server not reachable at http://localhost:11434.
Run "ollama serve" to start the server.
```

### 모델 미설치

Ollama가 404 또는 모델 관련 에러 반환 시:

```
Error: Model "bge-m3" not found.
Run "ollama pull bge-m3" to download the model.
```

### Streaming 파싱 — SSE vs NDJSON

Gemini/Cloudflare는 SSE (`data: {...}` prefix), Ollama는 NDJSON (줄 단위 raw JSON).
`generateStream()` 내부 파싱 로직이 다름:

```ts
// Ollama NDJSON parsing
for (const line of lines) {
  if (!line.trim()) continue;
  const data = JSON.parse(line) as OllamaChatResponse;
  if (data.message?.content) yield data.message.content;
  if (data.done) break;
}
```

### baseUrl 커스터마이징

Docker, 원격 서버 등에서 Ollama 실행 시 `baseUrl` override 필요.
Default `http://localhost:11434` 이외 환경 지원.

### Rate Limit

로컬 실행이므로 플러그인 레벨 rate limit 불필요.
`rateLimit` 필드 미설정 (undefined).

---

## 8. 사용 예시

### 완전 로컬 RAG (API key 없음)

```ts
import { defineConfig } from "ragpipe";
import { ollamaEmbedding, ollamaGeneration } from "@ragpipe/plugin-ollama";
import { sqliteVectorStore } from "@ragpipe/plugin-sqlite-vec";

export default defineConfig({
  embedding: ollamaEmbedding({ model: "bge-m3" }),
  vectorStore: sqliteVectorStore({ path: "./rag.db" }),
  generation: ollamaGeneration({ model: "llama3" }),
});
```

### 원격 Ollama 서버

```ts
ollamaEmbedding({
  model: "bge-m3",
  baseUrl: "http://gpu-server.local:11434",
});
```

### Ollama embedding + Cloud generation 혼합

```ts
import { ollamaEmbedding } from "@ragpipe/plugin-ollama";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";
import { geminiGeneration } from "@ragpipe/plugin-gemini";

export default defineConfig({
  embedding: ollamaEmbedding({ model: "bge-m3" }),
  vectorStore: supabaseVectorStore({ /* ... */ }),
  generation: geminiGeneration({ /* ... */ }),
});
```
