# @ragpipe/plugin-openai — OpenAI Embedding + Generation Plugin

Created: 2026-04-10

## Overview

OpenAI의 Embedding + Chat Completion API를 ragpipe 플러그인으로 제공한다.
`https://api.openai.com/v1` REST API를 직접 호출하며, 외부 SDK 없이 native `fetch`만 사용한다.
Embedding은 `text-embedding-3-small/large`, Generation은 `gpt-4o/gpt-4o-mini` 등 지원.

---

## 1. Scope

| 기능 | 포함 여부 | 비고 |
|------|-----------|------|
| Embedding | O | `text-embedding-3-small` 기본 |
| Generation | O | `gpt-4o-mini` 기본 |
| Streaming | O | SSE 기반 `generateStream` |
| Batch Embedding | O | `embedMany` — `/v1/embeddings` input 배열 지원 |

---

## 2. API Reference

### OpenAI REST API

API Key 필수. `Authorization: Bearer <key>` 헤더 사용.

#### Embedding — `POST /v1/embeddings`

```json
// Request (단일)
{
  "model": "text-embedding-3-small",
  "input": "hello world"
}

// Request (배치)
{
  "model": "text-embedding-3-small",
  "input": ["hello", "world"]
}

// Response
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.123, -0.456, ...]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": { "prompt_tokens": 2, "total_tokens": 2 }
}
```

> 단일/배치 모두 동일 엔드포인트. `input`이 string이면 단일, string[]이면 배치.

#### Chat Completion — `POST /v1/chat/completions`

```json
// Request
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false
}

// Response
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "generated text here"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30 }
}
```

Streaming (`"stream": true`) 시 SSE 형식:

```
data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}

data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"content":" world"}}]}

data: [DONE]
```

> Cloudflare와 동일한 OpenAI-compatible SSE 포맷. `data: [DONE]`으로 종료.

---

## 3. Plugin Interfaces

### Embedding

```ts
interface OpenAIEmbeddingOptions {
  apiKey: string;        // OpenAI API key
  model?: string;        // default: "text-embedding-3-small"
  dimensions?: number;   // default: 모델별 기본값 (small: 1536, large: 3072)
  baseUrl?: string;      // default: "https://api.openai.com/v1"
}

function openaiEmbedding(options: OpenAIEmbeddingOptions): EmbeddingPlugin;
```

| 필드 | 값 |
|------|----|
| `name` | `"openai"` |
| `dimensions` | options.dimensions ?? 모델별 기본값 |
| `model` | options.model ?? `"text-embedding-3-small"` |
| `rateLimit` | `{ delayMs: 200 }` (RPM 제한 대응) |

### Generation

```ts
interface OpenAIGenerationOptions {
  apiKey: string;            // OpenAI API key
  model?: string;            // default: "gpt-4o-mini"
  systemPrompt?: string;
  baseUrl?: string;          // default: "https://api.openai.com/v1"
}

function openaiGeneration(options: OpenAIGenerationOptions): GenerationPlugin;
```

| 필드 | 값 |
|------|----|
| `name` | `"openai"` |
| `model` | options.model ?? `"gpt-4o-mini"` |

---

## 4. 지원 모델

### Embedding Models

| 모델 | 차원 | 비고 |
|------|------|------|
| `text-embedding-3-small` | 1536 | 기본값, 비용 효율적 |
| `text-embedding-3-large` | 3072 | 고정밀도 |
| `text-embedding-ada-002` | 1536 | 레거시, 하위 호환 |

> `text-embedding-3-*` 모델은 `dimensions` 파라미터로 출력 차원 축소 가능 (e.g. 256, 512).
> 이 경우 사용자가 `dimensions` 옵션으로 명시하면 API 요청에 포함.

### Generation Models

| 모델 | 비고 |
|------|------|
| `gpt-4o` | 최신 플래그십 |
| `gpt-4o-mini` | 기본값, 비용 효율적 |
| `gpt-4-turbo` | GPT-4 Turbo |
| `o1` | 추론 모델 |
| `o1-mini` | 추론 모델 (경량) |
| `o3-mini` | 추론 모델 (최신 경량) |

---

## 5. 패키지 구조

```
packages/plugin-openai/
├── src/
│   ├── index.ts          ← re-export
│   ├── embedding.ts      ← openaiEmbedding()
│   ├── generation.ts     ← openaiGeneration()
│   └── __tests__/
│       ├── embedding.test.ts
│       └── generation.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

### package.json 핵심

```json
{
  "name": "@ragpipe/plugin-openai",
  "peerDependencies": {
    "ragpipe": ">=0.4.0"
  },
  "dependencies": {},
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  }
}
```

> 외부 dependency 0개. Pure `fetch` only. (`openai` SDK 미사용)

---

## 6. 구현 세부사항

### Embedding 구현

```ts
// embedding.ts
import type { EmbeddingPlugin } from "ragpipe";

const DEFAULT_MODEL = "text-embedding-3-small";

const DIMENSION_MAP: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

export function openaiEmbedding(options: OpenAIEmbeddingOptions): EmbeddingPlugin {
  const model = options.model ?? DEFAULT_MODEL;
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  const dimensions = options.dimensions ?? DIMENSION_MAP[model] ?? 1536;

  async function callApi(input: string | string[]): Promise<number[][]> {
    const body: Record<string, unknown> = { model, input };
    // text-embedding-3-* 모델만 dimensions 파라미터 지원
    if (options.dimensions && model.startsWith("text-embedding-3-")) {
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
        `OpenAI embedding error: ${res.status} ${await res.text()}`,
      );
    }

    const data = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };

    // index 순서 보장 (API가 순서 보장하지만 안전하게)
    return data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  return {
    name: "openai",
    dimensions,
    model,
    rateLimit: { delayMs: 200 },

    async embed(text: string): Promise<number[]> {
      const vectors = await callApi(text);
      return vectors[0];
    },

    async embedMany(texts: string[]): Promise<number[][]> {
      return callApi(texts);
    },
  };
}
```

### Generation 구현

```ts
// generation.ts
import type { GenerationPlugin } from "ragpipe";

const DEFAULT_MODEL = "gpt-4o-mini";

export function openaiGeneration(options: OpenAIGenerationOptions): GenerationPlugin {
  const model = options.model ?? DEFAULT_MODEL;
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";

  function buildMessages(
    question: string,
    context: string,
    opts?: { history?: string; systemPrompt?: string },
  ): ChatMessage[] {
    const systemPrompt =
      opts?.systemPrompt ??
      options.systemPrompt ??
      "Answer based on the provided context.";

    let userPrompt = `Context:\n${context}\n\nQuestion: ${question}`;
    if (opts?.history) {
      userPrompt = `Conversation history:\n${opts.history}\n\n${userPrompt}`;
    }

    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
  }

  return {
    name: "openai",
    model,

    async generate(question, context, opts) {
      const messages = buildMessages(question, context, opts);

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, stream: false }),
      });

      if (!res.ok) {
        throw new Error(
          `OpenAI generation error: ${res.status} ${await res.text()}`,
        );
      }

      const data = (await res.json()) as ChatCompletionResponse;
      return data.choices?.[0]?.message?.content ?? "";
    },

    async *generateStream(question, context, opts) {
      const messages = buildMessages(question, context, opts);

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, stream: true }),
      });

      if (!res.ok) {
        throw new Error(
          `OpenAI generation stream error: ${res.status} ${await res.text()}`,
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") return;
            try {
              const data = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const chunk = data.choices?.[0]?.delta?.content;
              if (chunk) yield chunk;
            } catch {
              // skip malformed SSE chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
```

> Streaming 파싱은 Cloudflare 플러그인과 동일한 SSE + `[DONE]` 패턴.

---

## 7. 구현 단계

### Step 1 — 패키지 스캐폴딩
- [ ] `packages/plugin-openai/` 생성
- [ ] `package.json`, `tsconfig.json`, `tsup.config.ts` 설정
- [ ] `src/index.ts` 엔트리 포인트

### Step 2 — Embedding 구현
- [ ] `OpenAIEmbeddingOptions` 타입 정의
- [ ] `openaiEmbedding()` 팩토리 함수
- [ ] `embed()` — `POST /v1/embeddings` 단일 텍스트
- [ ] `embedMany()` — 배열 입력 배치 처리
- [ ] `dimensions` 파라미터 지원 (`text-embedding-3-*` 전용)
- [ ] 에러 핸들링 (401, 429 rate limit, 모델 미지원 등)

### Step 3 — Generation 구현
- [ ] `OpenAIGenerationOptions` 타입 정의
- [ ] `openaiGeneration()` 팩토리 함수
- [ ] `generate()` — `POST /v1/chat/completions` with `stream: false`
- [ ] `generateStream()` — SSE 파싱 + `[DONE]` 종료 + AsyncIterable
- [ ] system prompt, history 지원

### Step 4 — 테스트 작성
- [ ] `embedding.test.ts` — 메타데이터, API 호출, 배치, 에러, dimensions 옵션
- [ ] `generation.test.ts` — 메타데이터, API 호출, systemPrompt, history, streaming, [DONE] 처리

### Step 5 — 빌드/검증
- [ ] `pnpm turbo run build` 통과
- [ ] `pnpm biome check --write` 통과
- [ ] `pnpm turbo typecheck` 통과

### Step 6 — 문서/배포 준비
- [ ] README.md 작성
- [ ] changeset 파일 작성
- [ ] `specs/rag-kit-spec.md` 로드맵 체크리스트 업데이트

---

## 8. 고려 사항

### baseUrl 커스터마이징

OpenAI-compatible API (Azure OpenAI, OpenRouter, Together AI 등)를 지원하기 위해 `baseUrl` override 제공.
Default `https://api.openai.com/v1`.

```ts
// Azure OpenAI 예시
openaiEmbedding({
  apiKey: process.env.AZURE_OPENAI_KEY!,
  baseUrl: "https://my-resource.openai.azure.com/openai/deployments/my-embedding",
  model: "text-embedding-3-small",
  dimensions: 1536,
});

// OpenRouter 예시
openaiGeneration({
  apiKey: process.env.OPENROUTER_KEY!,
  baseUrl: "https://openrouter.ai/api/v1",
  model: "openai/gpt-4o",
});
```

### Rate Limit

OpenAI는 tier별 RPM/TPM 제한 있음. 기본 `{ delayMs: 200 }` 설정.
- Tier 1: 500 RPM (embedding), 500 RPM (chat)
- Tier 2+: 5000 RPM 이상

사용자가 core의 `createRateLimitedEmbedder()`로 추가 조절 가능.

### dimensions 파라미터

`text-embedding-3-small/large`만 `dimensions` 축소 지원.
`text-embedding-ada-002`에 dimensions 보내면 API 에러 발생하므로 모델명 체크 후 조건부 포함.

### 에러 응답 형식

OpenAI 에러 응답은 구조화되어 있음:

```json
{
  "error": {
    "message": "Incorrect API key provided: sk-xxxx.",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_api_key"
  }
}
```

에러 메시지에 `res.text()` 포함하여 디버깅 편의성 확보 (기존 플러그인 패턴과 동일).

### 외부 SDK 미사용 이유

`openai` npm 패키지 (공식 SDK)를 사용하지 않는 이유:
1. 기존 플러그인 패턴과 일관성 유지 (모든 플러그인이 pure fetch)
2. 번들 사이즈 최소화 (dependency 0개 원칙)
3. OpenAI REST API는 단순하여 SDK 없이 충분
4. baseUrl override로 호환 API 서버 지원 시 SDK 제약 회피

---

## 9. 사용 예시

### OpenAI + Supabase 기본 조합

```ts
import { defineConfig } from "ragpipe";
import { openaiEmbedding, openaiGeneration } from "@ragpipe/plugin-openai";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";

export default defineConfig({
  embedding: openaiEmbedding({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "text-embedding-3-small",
  }),
  vectorStore: supabaseVectorStore({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  generation: openaiGeneration({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
  }),
});
```

### 고정밀 임베딩 + GPT-4o

```ts
openaiEmbedding({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "text-embedding-3-large",
  dimensions: 1024, // 3072 → 1024로 축소 (비용/성능 트레이드오프)
});
```

### OpenAI embedding + 다른 generation 혼합

```ts
import { openaiEmbedding } from "@ragpipe/plugin-openai";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";
import { geminiGeneration } from "@ragpipe/plugin-gemini";

export default defineConfig({
  embedding: openaiEmbedding({
    apiKey: process.env.OPENAI_API_KEY!,
  }),
  vectorStore: supabaseVectorStore({ /* ... */ }),
  generation: geminiGeneration({ /* ... */ }),
});
```

### OpenRouter 경유

```ts
openaiGeneration({
  apiKey: process.env.OPENROUTER_KEY!,
  baseUrl: "https://openrouter.ai/api/v1",
  model: "anthropic/claude-3.5-sonnet",
});
```
