# @ragpipe/plugin-bedrock — AWS Bedrock Embedding + Generation Plugin

Created: 2026-04-10

## Overview

AWS Bedrock Runtime의 Embedding + Generation을 ragpipe 플러그인으로 제공한다.
다른 플러그인과 달리 Bedrock는 SigV4 인증이 필요하므로, native `fetch` 대신 공식 AWS SDK v3를 사용한다.

MVP 범위는 다음 두 축에 집중한다:

- Embedding: Amazon Titan Text Embeddings
- Generation: Anthropic Claude on Bedrock

즉, `@ragpipe/plugin-bedrock`은 "Bedrock 전체 모델 카탈로그"를 한 번에 추상화하는 것이 아니라,
ragpipe에서 실사용 가능한 최소 안정 범위를 먼저 제공하고 이후 모델 family adapter를 확장하는 방향으로 설계한다.

---

## 1. Scope

| 기능 | 포함 여부 | 비고 |
|------|-----------|------|
| Embedding | O | MVP는 Titan Embeddings 중심 |
| Generation | O | MVP는 Claude 계열 중심 |
| Streaming | O | `ConverseStream` 기반 `generateStream` |
| Batch Embedding | O | 공통 배치 endpoint가 없으므로 plugin 내부 loop로 처리 |
| Tool use / multimodal | X | ragpipe 현재 scope 밖 |
| Guardrail integration | X | 후속 단계 |
| Knowledge Base API 연동 | X | vectorStore axis와 역할 중복 |

---

## 2. Why SDK Instead of fetch

Bedrock Runtime 호출은 일반 REST API처럼 보이지만 실제로는 AWS Signature V4 서명이 필요하다.
직접 구현도 가능하지만, 이 프로젝트에서는 다음 이유로 AWS SDK v3 사용이 맞다.

1. SigV4 서명, 재시도, credential provider chain을 직접 구현하지 않아도 된다.
2. IAM User / STS / SSO / ECS / Lambda Role 등 AWS 표준 인증 흐름을 그대로 활용할 수 있다.
3. Bedrock API는 `InvokeModel`, `Converse`, `ConverseStream` 등 operation 단위가 명확해 SDK가 더 자연스럽다.
4. `fetch-only` 원칙보다 "정확한 인증과 운영 안정성"이 Bedrock에서는 더 중요하다.

따라서 이 플러그인은 예외적으로 외부 dependency를 허용한다:

```json
{
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.x"
  }
}
```

> `@aws-sdk/credential-providers`는 MVP에서 필수 아님.
> credentials를 명시하지 않으면 SDK 기본 credential chain을 사용한다.

---

## 3. AWS API Reference

### Runtime Operations

| 역할 | API | 용도 |
|------|-----|------|
| Embedding | `InvokeModel` | Titan embedding request/response |
| Generation | `Converse` | non-stream text generation |
| Streaming | `ConverseStream` | streaming text generation |

### 3.1 Embedding — Titan via `InvokeModel`

MVP 기본 모델:

- `amazon.titan-embed-text-v2:0`

요청 body 예시:

```json
{
  "inputText": "hello world",
  "dimensions": 1024,
  "normalize": true
}
```

응답 body 예시:

```json
{
  "embedding": [0.123, -0.456, 0.789],
  "inputTextTokenCount": 2
}
```

### 3.2 Generation — Claude via `Converse`

MVP 기본 모델:

- `anthropic.claude-3-5-haiku-20241022-v1:0`

요청 개념 예시:

```ts
{
  modelId: "anthropic.claude-3-5-haiku-20241022-v1:0",
  system: [{ text: "Answer based on the provided context." }],
  messages: [
    {
      role: "user",
      content: [
        {
          text: "Context:\n...\n\nQuestion: What is the refund policy?"
        }
      ]
    }
  ],
  inferenceConfig: {
    maxTokens: 1024,
    temperature: 0.2,
    topP: 0.9
  }
}
```

응답에서 필요한 값:

```ts
output.message.content[0].text
```

### 3.3 Streaming — Claude via `ConverseStream`

stream 이벤트는 OpenAI SSE처럼 단순 문자열이 아니라 structured event stream이다.
MVP에서는 `contentBlockDelta.delta.text`만 yield 한다.

예시 이벤트 흐름:

```json
{ "messageStart": { "role": "assistant" } }
{ "contentBlockStart": { "contentBlockIndex": 0 } }
{ "contentBlockDelta": { "delta": { "text": "Hello" } } }
{ "contentBlockDelta": { "delta": { "text": " world" } } }
{ "contentBlockStop": { "contentBlockIndex": 0 } }
{ "messageStop": { "stopReason": "end_turn" } }
```

> 즉, Bedrock streaming은 SSE string parser가 아니라 SDK event iterator 처리로 구현해야 한다.

---

## 4. Plugin Interfaces

### 4.1 Shared Client Options

```ts
interface BedrockCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

interface BedrockClientOptions {
  region: string;
  credentials?: BedrockCredentials;
  endpoint?: string;
}
```

설명:

- `region`은 필수
- `credentials` 미지정 시 AWS SDK 기본 credential chain 사용
- `endpoint`는 로컬 테스트, VPC endpoint, 특수 프록시 환경용 override

### 4.2 Embedding

```ts
interface BedrockEmbeddingOptions extends BedrockClientOptions {
  model?: string; // default: "amazon.titan-embed-text-v2:0"
  dimensions?: 256 | 512 | 1024;
  normalize?: boolean; // default: true
}

function bedrockEmbedding(options: BedrockEmbeddingOptions): EmbeddingPlugin;
```

| 필드 | 값 |
|------|----|
| `name` | `"bedrock"` |
| `dimensions` | options.dimensions ?? 모델 기본값 |
| `model` | options.model ?? `"amazon.titan-embed-text-v2:0"` |
| `rateLimit` | `{ delayMs: 250 }` |

### 4.3 Generation

```ts
interface BedrockGenerationOptions extends BedrockClientOptions {
  model?: string; // default: "anthropic.claude-3-5-haiku-20241022-v1:0"
  systemPrompt?: string;
  maxTokens?: number;   // default: 1024
  temperature?: number; // default: 0.2
  topP?: number;        // default: 0.9
}

function bedrockGeneration(options: BedrockGenerationOptions): GenerationPlugin;
```

| 필드 | 값 |
|------|----|
| `name` | `"bedrock"` |
| `model` | options.model ?? `"anthropic.claude-3-5-haiku-20241022-v1:0"` |

---

## 5. Supported Models

### 5.1 Embedding Models

MVP에서 공식 지원하는 모델 family:

| 모델 | 차원 | 상태 | 비고 |
|------|------|------|------|
| `amazon.titan-embed-text-v2:0` | 1024 기본, 256/512/1024 configurable | MVP | 기본값 |
| `amazon.titan-embed-text-v1` | 1536 | optional | request shape 유사 |

정책:

- 문서화된 안정 지원은 Titan 계열만 보장
- Cohere embedding 계열은 request/response shape가 달라서 MVP 범위에서 제외
- 향후 필요 시 `provider adapter`를 추가해 확장

### 5.2 Generation Models

MVP에서 공식 지원하는 모델 family:

| 모델 | 상태 | 비고 |
|------|------|------|
| `anthropic.claude-3-5-haiku-20241022-v1:0` | MVP | 기본값 |
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | MVP | 고품질 |
| `anthropic.claude-3-7-sonnet-*` | compatible | Converse 지원 시 동일 경로 |

정책:

- generation MVP는 Claude 계열만 1차 지원
- Meta / Mistral / Nova 등 타 family는 Converse payload나 응답 parsing이 달라질 수 있으므로 후속 범위
- 모델 family가 지원 대상이 아니면 조용히 실패하지 말고 명확한 에러를 던진다

---

## 6. Package Structure

```
packages/plugin-bedrock/
├── src/
│   ├── index.ts          ← re-export
│   ├── client.ts         ← BedrockRuntimeClient 생성 helper
│   ├── embedding.ts      ← bedrockEmbedding()
│   ├── generation.ts     ← bedrockGeneration()
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
  "name": "@ragpipe/plugin-bedrock",
  "peerDependencies": {
    "ragpipe": ">=0.6.0"
  },
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.x"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  }
}
```

---

## 7. Implementation Details

### 7.1 `client.ts` — shared client factory

```ts
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

export function createBedrockRuntimeClient(options: BedrockClientOptions) {
  return new BedrockRuntimeClient({
    region: options.region,
    credentials: options.credentials,
    endpoint: options.endpoint,
  });
}
```

원칙:

- embedding / generation에서 client 생성 로직을 중복하지 않음
- credentials 미지정 시 SDK 기본 chain 사용
- 테스트에서 `BedrockRuntimeClient.prototype.send` mock 가능하게 구조 단순화

### 7.2 Embedding 구현

```ts
// embedding.ts
import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { EmbeddingPlugin } from "ragpipe";

const DEFAULT_MODEL = "amazon.titan-embed-text-v2:0";

const DIMENSION_MAP: Record<string, number> = {
  "amazon.titan-embed-text-v2:0": 1024,
  "amazon.titan-embed-text-v1": 1536,
};

export function bedrockEmbedding(
  options: BedrockEmbeddingOptions,
): EmbeddingPlugin {
  const model = options.model ?? DEFAULT_MODEL;
  const client = createBedrockRuntimeClient(options);
  const dimensions = options.dimensions ?? DIMENSION_MAP[model] ?? 1024;
  const normalize = options.normalize ?? true;

  async function invoke(text: string): Promise<number[]> {
    assertSupportedEmbeddingModel(model);

    const body =
      model === "amazon.titan-embed-text-v2:0"
        ? { inputText: text, dimensions, normalize }
        : { inputText: text };

    const res = await client.send(
      new InvokeModelCommand({
        modelId: model,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body),
      }),
    );

    const payload = JSON.parse(new TextDecoder().decode(res.body));
    return payload.embedding;
  }

  return {
    name: "bedrock",
    model,
    dimensions,
    rateLimit: { delayMs: 250 },
    embed: invoke,
    async embedMany(texts) {
      const result: number[][] = [];
      for (const text of texts) {
        result.push(await invoke(text));
      }
      return result;
    },
  };
}
```

핵심 결정:

1. `embedMany()`는 Bedrock 공통 batch API가 없어 내부 serial loop로 구현
2. Titan v2만 `dimensions`, `normalize` 옵션을 request body에 반영
3. 지원하지 않는 model family는 사전에 차단

### 7.3 Generation 구현

```ts
// generation.ts
import {
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { GenerationPlugin } from "ragpipe";

const DEFAULT_MODEL = "anthropic.claude-3-5-haiku-20241022-v1:0";

export function bedrockGeneration(
  options: BedrockGenerationOptions,
): GenerationPlugin {
  const model = options.model ?? DEFAULT_MODEL;
  const client = createBedrockRuntimeClient(options);

  function buildUserPrompt(
    question: string,
    context: string,
    opts?: { history?: string; systemPrompt?: string },
  ): string {
    let prompt = `Context:\n${context}\n\nQuestion: ${question}`;
    if (opts?.history) {
      prompt = `Conversation history:\n${opts.history}\n\n${prompt}`;
    }
    return prompt;
  }

  function buildSystemText(opts?: {
    history?: string;
    systemPrompt?: string;
  }): string {
    return (
      opts?.systemPrompt ??
      options.systemPrompt ??
      "Answer based on the provided context."
    );
  }

  return {
    name: "bedrock",
    model,

    async generate(question, context, opts) {
      assertSupportedGenerationModel(model);

      const res = await client.send(
        new ConverseCommand({
          modelId: model,
          system: [{ text: buildSystemText(opts) }],
          messages: [
            {
              role: "user",
              content: [{ text: buildUserPrompt(question, context, opts) }],
            },
          ],
          inferenceConfig: {
            maxTokens: options.maxTokens ?? 1024,
            temperature: options.temperature ?? 0.2,
            topP: options.topP ?? 0.9,
          },
        }),
      );

      return extractTextFromConverseOutput(res.output);
    },

    async *generateStream(question, context, opts) {
      assertSupportedGenerationModel(model);

      const res = await client.send(
        new ConverseStreamCommand({
          modelId: model,
          system: [{ text: buildSystemText(opts) }],
          messages: [
            {
              role: "user",
              content: [{ text: buildUserPrompt(question, context, opts) }],
            },
          ],
          inferenceConfig: {
            maxTokens: options.maxTokens ?? 1024,
            temperature: options.temperature ?? 0.2,
            topP: options.topP ?? 0.9,
          },
        }),
      );

      for await (const chunk of res.stream ?? []) {
        const text = chunk.contentBlockDelta?.delta?.text;
        if (text) yield text;
      }
    },
  };
}
```

핵심 결정:

1. generation은 `InvokeModel`이 아니라 `Converse` 계열을 기본 경로로 사용
2. streaming은 SDK가 event stream을 파싱해주므로 수동 SSE parser 불필요
3. ragpipe 공통 인터페이스에 맞추기 위해 history는 별도 multi-turn message array 대신 prompt string에 직렬화

### 7.4 Validation helpers

```ts
function assertSupportedEmbeddingModel(model: string): void {
  if (!model.startsWith("amazon.titan-embed-text")) {
    throw new Error(
      `Unsupported Bedrock embedding model: ${model}. ` +
      `MVP supports Titan embedding models only.`,
    );
  }
}

function assertSupportedGenerationModel(model: string): void {
  if (!model.startsWith("anthropic.claude")) {
    throw new Error(
      `Unsupported Bedrock generation model: ${model}. ` +
      `MVP supports Claude models only.`,
    );
  }
}
```

이 validation은 중요하다.
Bedrock는 model family마다 payload shape가 다르므로, "호출은 되지만 body shape가 틀려서 런타임 400"보다
"지원 범위를 사전에 명시"하는 편이 훨씬 낫다.

---

## 8. Test Plan

테스트는 실제 AWS 호출 없이 SDK `send()` mocking으로 작성한다.

### 8.1 `embedding.test.ts`

- [ ] plugin metadata 검증 (`name`, `model`, `dimensions`, `rateLimit`)
- [ ] `InvokeModelCommand`가 올바른 `modelId`, `contentType`, `body`로 호출되는지 검증
- [ ] Titan v2에서 `dimensions`, `normalize`가 body에 들어가는지 검증
- [ ] `embed()`가 `embedding` 배열을 반환하는지 검증
- [ ] `embedMany()`가 입력 순서를 유지하는지 검증
- [ ] unsupported model family에서 명확한 에러를 던지는지 검증
- [ ] AWS SDK 에러가 wrapping되어 전달되는지 검증

### 8.2 `generation.test.ts`

- [ ] plugin metadata 검증 (`name`, `model`)
- [ ] `ConverseCommand` 호출 payload 검증
- [ ] `systemPrompt` override가 per-call > factory option 순서로 적용되는지 검증
- [ ] `history`가 user prompt에 포함되는지 검증
- [ ] `generate()`가 첫 text block을 반환하는지 검증
- [ ] `generateStream()`이 `contentBlockDelta.delta.text`만 yield 하는지 검증
- [ ] empty/non-text chunk를 무시하는지 검증
- [ ] unsupported model family에서 명확한 에러를 던지는지 검증

### 8.3 경계 케이스

- [ ] `res.output.message.content`가 비어 있으면 `""` 반환
- [ ] `res.stream`이 없으면 조용히 종료
- [ ] `TextDecoder` 처리 시 body가 `Uint8Array`인 경우 정상 parse

---

## 9. Implementation Steps

### Step 1 — 패키지 스캐폴딩

- [ ] `packages/plugin-bedrock/` 생성
- [ ] `package.json`, `tsconfig.json`, `tsup.config.ts` 설정
- [ ] `src/index.ts` 엔트리 포인트 작성

### Step 2 — 공통 client/helper 작성

- [ ] `client.ts` 작성
- [ ] supported model family validation helper 작성
- [ ] Bedrock body decode helper 작성

### Step 3 — Embedding 구현

- [ ] `BedrockEmbeddingOptions` 타입 정의
- [ ] `bedrockEmbedding()` 팩토리 함수 작성
- [ ] Titan v2 request body 분기 구현
- [ ] `embedMany()` serial loop 구현
- [ ] 에러 메시지 정리

### Step 4 — Generation 구현

- [ ] `BedrockGenerationOptions` 타입 정의
- [ ] `bedrockGeneration()` 팩토리 함수 작성
- [ ] `generate()` with `ConverseCommand`
- [ ] `generateStream()` with `ConverseStreamCommand`
- [ ] system prompt / history / inferenceConfig 반영

### Step 5 — 테스트 및 검증

- [ ] `embedding.test.ts` 작성
- [ ] `generation.test.ts` 작성
- [ ] `pnpm turbo run build --filter=@ragpipe/plugin-bedrock`
- [ ] `pnpm turbo run typecheck --filter=@ragpipe/plugin-bedrock`
- [ ] `pnpm turbo run test --filter=@ragpipe/plugin-bedrock`

### Step 6 — 문서/배포 준비

- [ ] `packages/plugin-bedrock/README.md` 작성
- [ ] changeset 파일 작성
- [ ] `README.md` plugin status 유지 또는 구현 후 stable 반영
- [ ] `specs/rag-kit-spec.md` 로드맵 참조 링크 추가

---

## 10. Considerations

### Credential Resolution

MVP는 다음 순서를 따른다:

1. `options.credentials`
2. AWS SDK default credential chain

즉, 다음 환경에서 모두 동작해야 한다:

- 로컬 `.aws/credentials`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- EC2 / ECS / Lambda IAM Role

별도 `profile` 옵션은 넣지 않는다.
필요하면 사용자가 `AWS_PROFILE` 환경변수로 해결하면 된다.

### Model-family-specific Payload

Bedrock는 provider 통합 플랫폼이지만 request shape가 완전히 통일되어 있지 않다.
따라서 초기 설계는 "모든 Bedrock 모델 지원"이 아니라 "지원하는 family를 명시"하는 방식이어야 한다.

이 원칙이 없으면:

- Titan embedding body와 Cohere embedding body가 섞이고
- Claude converse와 다른 모델 family의 response shape가 충돌하고
- 테스트가 모호해진다

### Error Handling

에러는 SDK raw object를 그대로 노출하지 말고 provider 맥락을 붙인다:

```ts
throw new Error(`Bedrock embedding error (${model}): ${message}`);
throw new Error(`Bedrock generation error (${model}): ${message}`);
```

권장 케이스:

- region misconfiguration
- access denied (`bedrock:InvokeModel`, `bedrock:Converse` 권한 부족)
- model access not enabled in Bedrock console
- unsupported model family
- throttling

### Rate Limit

Bedrock quota는 account/model/region별로 다르다.
플러그인에서 공격적으로 병렬화하지 않고, 기본 `rateLimit` 힌트만 제공한다.

```ts
rateLimit: { delayMs: 250 }
```

실제 고속 ingest가 필요하면 core의 rate-limiter 조합으로 조절한다.

### Node Runtime Assumption

AWS SDK v3를 사용하므로 이 플러그인은 Node.js 런타임 기준으로 설계한다.
브라우저 번들 호환성은 본 패키지의 우선 목표가 아니다.

---

## 11. Usage Examples

### Bedrock End-to-End

```ts
import { defineConfig } from "ragpipe";
import {
  bedrockEmbedding,
  bedrockGeneration,
} from "@ragpipe/plugin-bedrock";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";

export default defineConfig({
  embedding: bedrockEmbedding({
    region: "us-east-1",
    model: "amazon.titan-embed-text-v2:0",
    dimensions: 1024,
  }),
  vectorStore: supabaseVectorStore({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  generation: bedrockGeneration({
    region: "us-east-1",
    model: "anthropic.claude-3-5-haiku-20241022-v1:0",
    systemPrompt: "Answer based on the provided context.",
  }),
});
```

### Explicit IAM Credentials

```ts
bedrockGeneration({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});
```

### Mixed Provider Setup

```ts
import { voyageEmbedding } from "@ragpipe/plugin-voyage";
import { bedrockGeneration } from "@ragpipe/plugin-bedrock";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";

export default defineConfig({
  embedding: voyageEmbedding({
    apiKey: process.env.VOYAGE_API_KEY!,
    model: "voyage-3-lite",
  }),
  vectorStore: supabaseVectorStore({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  generation: bedrockGeneration({
    region: "us-east-1",
    model: "anthropic.claude-3-5-haiku-20241022-v1:0",
  }),
});
```

---

## 12. Out of Scope for MVP

- Cohere / Nova / Llama / Mistral family별 adapter 구현
- multimodal input
- Bedrock Guardrails API
- prompt caching / provisioned throughput / inference profile 전용 옵션
- fine-grained tool use schema
- multi-turn structured message array를 ragpipe core 인터페이스에 직접 반영

MVP 완료 기준은 단순하다:

1. Titan embedding이 동작한다.
2. Claude generation + streaming이 동작한다.
3. IAM credential chain 환경에서 안정적으로 사용할 수 있다.
4. unsupported family는 명확히 실패한다.
