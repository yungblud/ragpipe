# @ragpipe/plugin-voyage — Voyage AI Embedding Plugin

Created: 2026-04-12

## Overview

Voyage AI의 text embedding API를 ragpipe Embedding 플러그인으로 제공한다.
구현은 native `fetch` 기반으로 진행하고, 외부 SDK는 사용하지 않는다.

`@ragpipe/plugin-voyage`는 embedding axis만 담당한다.
Generation 기능은 포함하지 않는다.

MVP 목표는 다음이다:

- 단일 embedding (`embed`)
- 배치 embedding (`embedMany`)
- 모델별 기본 차원 노출
- Base URL override
- 명확한 API 에러 처리

---

## 1. Scope

| 기능 | 포함 여부 | 비고 |
|------|-----------|------|
| Embedding | O | Voyage text embedding API |
| Batch embedding | O | `embedMany` 지원 |
| Base URL override | O | 테스트/프록시 환경 대응 |
| 모델별 기본 dimensions | O | known model map 기반 |
| Custom dimensions override | O | API가 허용하는 경우 요청에 전달 |
| Generation | X | plugin scope 밖 |
| Streaming | X | embedding plugin이라 불필요 |
| Rerank API | X | 후속 별도 plugin 또는 확장 범위 |

---

## 2. API Reference

Voyage API는 Bearer 토큰 기반 REST API를 사용한다.

기본 Base URL:

```txt
https://api.voyageai.com/v1
```

### Embedding — `POST /embeddings`

요청 예시:

```json
{
  "model": "voyage-3-lite",
  "input": "hello world"
}
```

배치 요청 예시:

```json
{
  "model": "voyage-3-lite",
  "input": ["hello", "world"]
}
```

차원 축소를 명시하는 경우:

```json
{
  "model": "voyage-3-lite",
  "input": ["hello", "world"],
  "dimensions": 512
}
```

응답 예시:

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.123, -0.456, 0.789]
    },
    {
      "object": "embedding",
      "index": 1,
      "embedding": [0.111, -0.222, 0.333]
    }
  ],
  "model": "voyage-3-lite"
}
```

정책:

- 단일/배치 모두 같은 엔드포인트 사용
- 응답은 `index` 순으로 정렬해서 반환
- 비정상 응답 또는 `res.ok === false`는 명확한 에러로 변환

---

## 3. Plugin Interface

```ts
interface VoyageEmbeddingOptions {
  apiKey: string;
  model?: string;      // default: "voyage-3-lite"
  dimensions?: number; // optional override
  baseUrl?: string;    // default: "https://api.voyageai.com/v1"
}

function voyageEmbedding(options: VoyageEmbeddingOptions): EmbeddingPlugin;
```

반환되는 plugin contract:

| 필드 | 값 |
|------|----|
| `name` | `"voyage"` |
| `model` | options.model ?? `"voyage-3-lite"` |
| `dimensions` | options.dimensions ?? 모델별 기본값 |
| `embed(text)` | 단일 embedding |
| `embedMany(texts)` | 배치 embedding |
| `rateLimit` | `{ delayMs: 200 }` |

설계 원칙:

- OpenAI embedding plugin과 유사한 shape를 따른다
- SDK 없이 `fetch`만 사용한다
- 모델별 default dimensions를 제공하되, override가 들어오면 그 값을 plugin metadata와 request body에 반영한다

---

## 4. Supported Models

MVP에서는 대표 text embedding 모델 중심으로 문서화한다.

| 모델 | 기본 차원 | 상태 | 비고 |
|------|-----------|------|------|
| `voyage-3-lite` | 1024 | MVP 기본값 | 비용/성능 균형 |
| `voyage-3` | 1024 | MVP | 고품질 |
| `voyage-code-3` | 1024 | MVP | code/search 용도 |
| `voyage-large-2-instruct` | 1024 | compatible | 레거시/호환 범위 |

정책:

- 기본 차원은 known map으로 관리
- unknown model이면 fallback dimension은 `1024`
- 사용자가 `dimensions`를 지정하면 해당 값을 우선한다

> 실제 Voyage 모델 카탈로그는 변할 수 있으므로,
> 구현 단계에서 README에는 "공식 문서 기준"임을 명시하고 과도한 모델 보장은 피한다.

---

## 5. Package Structure

```txt
packages/plugin-voyage/
├── src/
│   ├── index.ts
│   ├── embedding.ts
│   └── __tests__/
│       └── embedding.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

### package.json 핵심

```json
{
  "name": "@ragpipe/plugin-voyage",
  "peerDependencies": {
    "ragpipe": ">=0.9.0"
  },
  "dependencies": {},
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  }
}
```

정책:

- 외부 SDK dependency 없음
- `fetch` 기반 구현
- `ragpipe`는 peer dependency

---

## 6. Implementation Details

### 6.0 Implementation Checklist

- [ ] Confirm MVP scope remains embedding-only and excludes generation/rerank
- [ ] Confirm Voyage API request/response shape against the current official docs before implementation
- [ ] Create `packages/plugin-voyage/`
- [ ] Add `package.json`
- [ ] Add `tsconfig.json`
- [ ] Add `tsup.config.ts`
- [ ] Add `src/index.ts`
- [ ] Add `src/embedding.ts`
- [ ] Add `src/__tests__/embedding.test.ts`
- [ ] Add `README.md`
- [ ] Add a changeset for `@ragpipe/plugin-voyage`

### 6.0.1 Package Scaffolding Checklist

- [ ] Use the same package layout as other embedding plugins
- [ ] Set `name` to `@ragpipe/plugin-voyage`
- [ ] Set `peerDependencies.ragpipe`
- [ ] Keep runtime dependencies empty unless implementation evidence proves one is necessary
- [ ] Include standard scripts: `build`, `dev`, `typecheck`, `test`, `test:watch`, `test:coverage`
- [ ] Export ESM/CJS/types from package root
- [ ] Include `dist` and `README.md` in published files

### 6.1 `embedding.ts`

예상 구현 형태:

```ts
import type { EmbeddingPlugin } from "ragpipe";

export interface VoyageEmbeddingOptions {
  apiKey: string;
  model?: string;
  dimensions?: number;
  baseUrl?: string;
}

const DEFAULT_MODEL = "voyage-3-lite";

const DIMENSION_MAP: Record<string, number> = {
  "voyage-3-lite": 1024,
  "voyage-3": 1024,
  "voyage-code-3": 1024,
  "voyage-large-2-instruct": 1024,
};

export function voyageEmbedding(
  options: VoyageEmbeddingOptions,
): EmbeddingPlugin {
  const model = options.model ?? DEFAULT_MODEL;
  const baseUrl = options.baseUrl ?? "https://api.voyageai.com/v1";
  const dimensions = options.dimensions ?? DIMENSION_MAP[model] ?? 1024;

  async function callApi(input: string | string[]): Promise<number[][]> {
    const body: Record<string, unknown> = { model, input };

    if (options.dimensions) {
      body.dimensions = options.dimensions;
    }

    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(
        `Voyage embedding error: ${res.status} ${await res.text()}`,
      );
    }

    const data = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };

    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  return {
    name: "voyage",
    model,
    dimensions,
    rateLimit: { delayMs: 200 },
    async embed(text) {
      return (await callApi(text))[0];
    },
    async embedMany(texts) {
      return callApi(texts);
    },
  };
}
```

### 6.2 `index.ts`

```ts
export { voyageEmbedding } from "./embedding.js";
export type { VoyageEmbeddingOptions } from "./embedding.js";
```

### 6.3 Embedding Implementation Checklist

- [ ] Define `VoyageEmbeddingOptions`
- [ ] Define `DEFAULT_MODEL = "voyage-3-lite"`
- [ ] Define known `DIMENSION_MAP`
- [ ] Resolve `model`, `baseUrl`, and `dimensions` defaults
- [ ] Implement shared `callApi(input)` helper for single/batch requests
- [ ] Send `Authorization: Bearer ${apiKey}` header
- [ ] Send `Content-Type: application/json` header
- [ ] Include `dimensions` in request body only when explicitly configured
- [ ] Sort returned embeddings by `index`
- [ ] Return the first vector from `embed()`
- [ ] Return all vectors from `embedMany()`
- [ ] Return `[]` immediately from `embedMany([])` without calling the API
- [ ] Set plugin metadata: `name`, `model`, `dimensions`, `rateLimit`

### 6.4 Response Validation Checklist

- [ ] Validate that JSON payload contains a `data` array
- [ ] Validate that each item has numeric `index` and `embedding`
- [ ] Throw a stable error for malformed payloads
- [ ] Throw a stable error when no embeddings are returned for single input
- [ ] Avoid silently accepting invalid or partial responses

---

## 7. Error Handling

에러 메시지 정책:

- HTTP 실패:
  - `Voyage embedding error: ${status} ${responseText}`
- API 응답 구조 이상:
  - `Voyage embedding error: invalid response payload`
- 빈 data 배열:
  - `Voyage embedding error: no embeddings returned`

추가 원칙:

- 401/403/429/500 응답을 삼키지 않는다
- raw response body를 포함해 디버깅 가능성을 높인다
- `embedMany([])`는 불필요한 API 호출 없이 `[]`를 반환해도 된다

### 7.1 Error Handling Checklist

- [ ] Preserve HTTP status code in thrown errors
- [ ] Include response text for non-OK responses
- [ ] Use `Voyage embedding error:` prefix consistently
- [ ] Throw a clear invalid-payload error when `data` is missing or malformed
- [ ] Throw a clear no-embeddings error when response data is empty in single-input flow

---

## 8. Tests

`src/__tests__/embedding.test.ts`에서 다음 케이스를 커버한다.

### 생성/메타데이터

- `name === "voyage"`
- default model = `voyage-3-lite`
- default dimensions = known map
- custom `dimensions` override 반영
- custom `baseUrl` 반영

### API 호출

- `embed()`가 `/embeddings`에 단일 string payload 전송
- `embedMany()`가 string 배열 payload 전송
- `dimensions` 지정 시 request body에 포함
- Authorization header에 Bearer token 포함
- response `index` 기준 정렬

### 에러

- non-200 응답 시 에러 throw
- malformed payload 시 에러 throw
- empty data 시 에러 throw

검증 방식:

- `global.fetch = vi.fn()` mocking
- 요청 URL, method, headers, body를 assert
- 성공/실패 응답 payload를 각각 구성

### 8.1 Test Implementation Checklist

- [ ] Assert plugin metadata defaults
- [ ] Assert custom model override
- [ ] Assert custom dimensions override
- [ ] Assert custom base URL override
- [ ] Assert single `embed()` request body
- [ ] Assert batch `embedMany()` request body
- [ ] Assert Authorization header
- [ ] Assert dimensions omission when not provided
- [ ] Assert dimensions inclusion when provided
- [ ] Assert response sorting by `index`
- [ ] Assert `embedMany([])` short-circuits without fetch
- [ ] Assert non-OK HTTP error propagation
- [ ] Assert invalid JSON payload error
- [ ] Assert empty data error
- [ ] Assert malformed item structure error

---

## 9. README Requirements

README에는 최소한 다음을 포함한다.

- 설치
- 기본 사용 예시
- API options 표
- 지원 모델/기본 차원
- `embedMany()` 지원 여부
- `baseUrl` override 예시

예시:

```ts
import { defineConfig } from "ragpipe";
import { voyageEmbedding } from "@ragpipe/plugin-voyage";

export default defineConfig({
  embedding: voyageEmbedding({
    apiKey: process.env.VOYAGE_API_KEY!,
    model: "voyage-3-lite",
    dimensions: 1024,
  }),
  // vectorStore, generation ...
});
```

---

## 10. CLI Integration

`packages/ragpipe/src/cli/init.ts`에 Embedding provider로 추가한다.

추가 스펙:

- label: `Voyage AI`
- package: `@ragpipe/plugin-voyage`
- importName: `voyageEmbedding`
- generated config:

```ts
embedding: voyageEmbedding({
  apiKey: process.env.VOYAGE_API_KEY!,
  model: "voyage-3-lite",
  dimensions: 1024,
})
```

Generation axis는 Voyage와 직접 연결되지 않으므로 기존 provider 선택 흐름 유지.

### 10.1 CLI Integration Checklist

- [ ] Add `Voyage AI` to `EMBEDDING_PROVIDERS`
- [ ] Use package `@ragpipe/plugin-voyage`
- [ ] Use import name `voyageEmbedding`
- [ ] Generate `apiKey: process.env.VOYAGE_API_KEY!`
- [ ] Generate `model: "voyage-3-lite"`
- [ ] Generate `dimensions: 1024`
- [ ] Verify `ragpipe init` output remains valid TypeScript

---

## 11. Verification Plan

구현 완료 조건:

1. `packages/plugin-voyage/` 스캐폴딩 완료
2. `voyageEmbedding()` 구현 완료
3. `embedding.test.ts` 통과
4. `pnpm --filter @ragpipe/plugin-voyage typecheck` 통과
5. `pnpm --filter @ragpipe/plugin-voyage build` 통과
6. `packages/ragpipe/src/cli/init.ts`에 provider 추가 후 `pnpm --filter ragpipe typecheck` 통과

### 11.1 Verification Checklist

- [ ] `pnpm --filter @ragpipe/plugin-voyage test`
- [ ] `pnpm --filter @ragpipe/plugin-voyage typecheck`
- [ ] `pnpm --filter @ragpipe/plugin-voyage build`
- [ ] `pnpm --filter ragpipe typecheck`
- [ ] `pnpm --filter ragpipe build`
- [ ] Review generated `ragpipe.config.ts` for Voyage option correctness
- [ ] Review README for install and usage accuracy
- [ ] Add implementation summary to `tasks/todo.md`

---

## 12. Out of Scope

이번 스펙에서 제외:

- rerank API 연동
- multimodal embedding
- generation support
- provider-specific retry/backoff client
- adaptive batching

이 범위는 MVP 구현을 작은 변경으로 끝내기 위한 의도적 제외다.
