# @ragpipe/plugin-cloudflare — Cloudflare Workers AI Plugin

Created: 2026-04-07

## Overview

Cloudflare Workers AI의 Embedding + Generation을 ragpipe 플러그인으로 제공한다.
REST API(`/client/v4/accounts/{id}/ai/run/{model}`)를 직접 호출하며, 외부 의존성 없이 native `fetch`만 사용한다.

---

## 1. Scope

| 기능 | 포함 여부 | 비고 |
|------|-----------|------|
| Embedding | O | `@cf/baai/bge-base-en-v1.5` 기본 |
| Generation | O | `@cf/meta/llama-3.1-8b-instruct` 기본 |
| Streaming | O | SSE 기반 `generateStream` |
| Batch Embedding | O | `embedMany` — Workers AI가 배열 입력 지원 |

---

## 2. API Reference

### Cloudflare Workers AI REST API

```
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}
Authorization: Bearer {api_token}
Content-Type: application/json
```

#### Embedding Request/Response

```json
// Request
{ "text": ["hello world"] }

// Response
{
  "result": {
    "shape": [1, 768],
    "data": [[0.123, -0.456, ...]]
  },
  "success": true
}
```

#### Generation Request/Response

```json
// Request
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false
}

// Response
{
  "result": {
    "response": "generated text here"
  },
  "success": true
}
```

Streaming(`"stream": true`)일 경우 SSE 형식으로 응답:
```
data: {"response":"Hello"}
data: {"response":" world"}
data: [DONE]
```

---

## 3. Plugin Interfaces

### Embedding

```ts
interface CloudflareEmbeddingOptions {
  accountId: string;
  apiToken: string;
  model?: string; // default: "@cf/baai/bge-base-en-v1.5"
}

function cloudflareEmbedding(options: CloudflareEmbeddingOptions): EmbeddingPlugin;
```

| 필드 | 값 |
|------|----|
| `name` | `"cloudflare"` |
| `dimensions` | `768` (bge-base-en-v1.5 기준) |
| `rateLimit` | 없음 (Workers AI는 자체 rate limit 처리) |

### Generation

```ts
interface CloudflareGenerationOptions {
  accountId: string;
  apiToken: string;
  model?: string; // default: "@cf/meta/llama-3.1-8b-instruct"
  systemPrompt?: string;
}

function cloudflareGeneration(options: CloudflareGenerationOptions): GenerationPlugin;
```

---

## 4. 지원 모델

### Embedding Models

| 모델 | 차원 | 비고 |
|------|------|------|
| `@cf/baai/bge-base-en-v1.5` | 768 | 기본값, 영어 특화 |
| `@cf/baai/bge-large-en-v1.5` | 1024 | 더 높은 정확도 |
| `@cf/baai/bge-small-en-v1.5` | 384 | 경량 |

### Generation Models

| 모델 | 비고 |
|------|------|
| `@cf/meta/llama-3.1-8b-instruct` | 기본값 |
| `@cf/meta/llama-3-8b-instruct` | 이전 버전 |
| `@cf/mistral/mistral-7b-instruct-v0.1` | Mistral |

---

## 5. 패키지 구조

```
packages/plugin-cloudflare/
├── src/
│   ├── index.ts          ← re-export
│   ├── embedding.ts      ← cloudflareEmbedding()
│   └── generation.ts     ← cloudflareGeneration()
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### package.json 핵심

```json
{
  "name": "@ragpipe/plugin-cloudflare",
  "peerDependencies": {
    "ragpipe": ">=0.1.0"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  }
}
```

---

## 6. 구현 단계

### Step 1 — 패키지 스캐폴딩
- [x] `packages/plugin-cloudflare/` 생성
- [x] `package.json`, `tsconfig.json`, `tsup.config.ts` 설정
- [x] `src/index.ts` 엔트리 포인트

### Step 2 — Embedding 구현
- [x] `CloudflareEmbeddingOptions` 타입 정의
- [x] `cloudflareEmbedding()` 팩토리 함수
- [x] `embed()` — 단일 텍스트 임베딩
- [x] `embedMany()` — 배열 입력 배치 처리
- [x] 에러 핸들링 (`success: false` 응답 처리)

### Step 3 — Generation 구현
- [ ] `CloudflareGenerationOptions` 타입 정의
- [ ] `cloudflareGeneration()` 팩토리 함수
- [ ] `generate()` — 동기 응답
- [ ] `generateStream()` — SSE 파싱 + AsyncIterable
- [ ] system prompt, history 지원

### Step 4 — 빌드/테스트 검증
- [ ] `pnpm turbo run build` 통과
- [ ] `pnpm biome check --write` 통과
- [ ] `pnpm turbo check:type` 통과
- [ ] 단위 테스트 작성 (vitest)

### Step 5 — 배포 준비
- [ ] npmjs OIDC trusted publishing 설정
- [ ] changeset 파일 작성
- [ ] spec 로드맵 체크리스트 업데이트

---

## 7. 고려 사항

### 모델별 차원 분기

embedding 모델마다 차원이 다르므로 (`768`, `1024`, `384`), 모델명에 따라 `dimensions`를 자동 매핑하거나 사용자가 명시적으로 지정할 수 있도록 해야 한다.

```ts
const DIMENSION_MAP: Record<string, number> = {
  "@cf/baai/bge-base-en-v1.5": 768,
  "@cf/baai/bge-large-en-v1.5": 1024,
  "@cf/baai/bge-small-en-v1.5": 384,
};
```

### Rate Limit

Workers AI는 account plan에 따라 rate limit이 다르다 (Free: 10,000 neurons/day).
플러그인 레벨에서 rate limit을 강제하지 않고, 429 응답 시 에러를 명확히 전달한다.

### 인증 방식

API Token (`Bearer` 헤더) 단일 방식. Global API Key는 지원하지 않는다.
