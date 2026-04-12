# ragpipe DX Roadmap — Beyond CLI `ask`

Created: 2026-04-12

## Overview

현재 `ragpipe`는 `init`, `setup`, `ingest`, `ask` CLI 흐름으로 MVP 사용성은 확보했지만,
실제 개발자들이 Slack bot, internal API, webhook worker, Next.js route handler 같은 환경에 붙이기에는
DX가 아직 CLI 중심이다.

핵심 문제는 기능 부재보다 "공식적으로 지원되는 integration surface가 약하다"는 점이다.
이미 내부적으로는 `loadConfig()` + `createPipeline(config)` + `pipeline.ask()` 조합으로
애플리케이션 코드에서 직접 사용할 수 있다.

따라서 DX 개선 방향은 새로운 추상화를 크게 추가하는 것이 아니라:

1. 현재 pipeline API를 공식 사용 패턴으로 승격
2. 실전 예제 제공
3. 필요한 경우에만 얇은 server/helper 추가

이 순서로 가는 것이 맞다.

---

## 1. Problem Statement

현재 상태:

- CLI로는 `setup -> ingest -> ask` 흐름이 가능하다
- 라이브러리 레벨에서는 `createPipeline()`이 이미 존재한다
- 하지만 이를 Slack bot / HTTP API / app backend에 붙이는 공식 가이드가 없다
- 결과적으로 개발자는 "CLI toolkit"으로 인식하기 쉽다

목표:

- `ragpipe`를 CLI 도구이자 embeddable TypeScript library로 포지셔닝
- 개발자가 `ask()`를 앱 코드에서 바로 사용할 수 있게 DX를 명확히 만든다
- product surface를 과도하게 늘리지 않고 adoption friction을 줄인다

---

## 2. Current Assets

이미 있는 기반:

- `loadConfig()`
- `defineConfig()`
- `createPipeline(config)`
- `pipeline.ingest()`
- `pipeline.search()`
- `pipeline.ask()`

즉, DX 개선의 핵심은 새 core engine이 아니라:

- 공식 API 문서화
- integration examples
- 선택적 helper/server packaging

이다.

---

## 3. Product Direction

권장 포지셔닝:

> `ragpipe` is both a CLI workflow and an embeddable RAG pipeline library for TypeScript apps.

개발자에게 전달해야 할 메시지:

- CLI는 빠른 로컬 검증용
- 실제 앱 연동은 `createPipeline()` 기반
- Slack bot / API server / backend job 모두 같은 pipeline API를 공유

---

## 4. Roadmap Principles

### 4.1 Favor Thin Surfaces

- 새로운 framework를 만들지 않는다
- existing pipeline API 위에 얇은 helper만 추가한다
- helper가 없어도 사용 가능한 구조를 유지한다

### 4.2 Example-First DX

- 기능 추가보다 예제 제공이 우선이다
- developer adoption은 docs보다 working example이 더 강하다

### 4.3 Keep Core Neutral

- Slack 전용 로직을 core에 넣지 않는다
- HTTP framework 전용 결합을 core에 넣지 않는다
- core는 config + pipeline 중심 유지

### 4.4 Do Not Overbuild `serve`

- `ragpipe serve`는 유용할 수 있지만, auth/deployment/runtime 문제가 같이 따라온다
- server mode는 examples/API usage가 정리된 이후에 도입한다

---

## 5. Phased Roadmap

## Phase 1 — Official Embedded API Usage

목표:

- CLI 바깥에서 `ragpipe`를 어떻게 쓰는지 공식 패턴을 제공

산출물:

- [ ] `specs/ragpipe-embedded-api.md` 또는 동등한 API usage 문서 작성
- [ ] root README 또는 `packages/ragpipe/README.md`에 "Use in your app" 섹션 추가
- [ ] `loadConfig()` + `createPipeline()` 기반 예제 코드 추가
- [ ] `pipeline.ask()` 사용 예제 추가
- [ ] `pipeline.search()` / `pipeline.ingest()` 사용 예제 추가

예시 목표 코드:

```ts
import { createPipeline, loadConfig } from "ragpipe";

const config = await loadConfig();
const pipeline = createPipeline(config);

const result = await pipeline.ask("What is the refund policy?");
console.log(result.answer);
console.log(result.sources);
```

완료 기준:

- 개발자가 CLI 없이 app code에서 ragpipe를 사용하는 방법을 5분 안에 파악 가능

우선순위:

- Highest

---

## Phase 2 — Example Projects

목표:

- 실제 integration을 복붙 가능한 수준으로 제공

산출물:

- [ ] `examples/with-express-api/`
- [ ] `examples/with-slack-bot/`
- [ ] 각 example별 README
- [ ] env var template 제공
- [ ] 최소 run instructions 제공

### 2.1 Express / Fastify API Example

권장 엔드포인트:

- [ ] `POST /ask`
- [ ] `POST /search`
- [ ] `POST /ingest`

예시 response shape:

```json
{
  "answer": "The refund policy is ...",
  "sources": [
    {
      "source": "docs/refund.md",
      "score": 0.92
    }
  ]
}
```

### 2.2 Slack Bot Example

권장 시나리오:

- [ ] mention trigger
- [ ] `/ask` slash command
- [ ] answer + top sources reply
- [ ] timeout-safe ack/deferred response handling

권장 stack:

- Bolt for JavaScript

목표:

- 개발자가 Slack bot example을 바로 복사해 사내용 Q&A bot으로 연결 가능

우선순위:

- High

---

## Phase 3 — Helper Utilities

목표:

- 예제에서 반복되는 glue code를 작은 유틸로 승격

후보 helper:

- [ ] `createAskHandler()`
- [ ] `createSearchHandler()`
- [ ] `formatSources()` 유틸
- [ ] `createPipelineFromConfig()` helper

예시:

```ts
import { createAskHandler } from "ragpipe/server";
```

원칙:

- framework-agnostic하게 유지
- heavy abstraction 금지
- helper는 example에서 반복이 확인된 뒤에만 승격

우선순위:

- Medium

---

## Phase 4 — Optional `ragpipe serve`

목표:

- 로컬/내부망에서 바로 붙일 수 있는 minimal API server 제공

후보 커맨드:

```bash
npx ragpipe serve
```

후보 엔드포인트:

- [ ] `POST /ask`
- [ ] `POST /search`
- [ ] `POST /ingest`
- [ ] `POST /setup`
- [ ] `GET /health`

하지만 선행 조건:

- [ ] embedded API docs 존재
- [ ] Express/Fastify example 존재
- [ ] request/response shape가 examples를 통해 안정화됨

리스크:

- auth story 필요
- deployment/runtime expectation 증가
- CLI 범위가 과도하게 커질 수 있음

우선순위:

- Medium-Low

---

## 6. Recommended Execution Order

가장 실용적인 순서:

1. [ ] Embedded API usage 문서화
2. [ ] `examples/with-slack-bot/` 추가
3. [ ] `examples/with-express-api/` 추가
4. [ ] 반복되는 코드가 확인되면 helper 유틸 추가
5. [ ] 마지막으로 `ragpipe serve` 검토

이 순서를 권장하는 이유:

- 가장 작은 변경으로 가장 큰 DX 효과
- product surface를 급격히 늘리지 않음
- examples를 통해 실제 사용 패턴을 먼저 검증할 수 있음

---

## 7. Technical Design Notes

### 7.1 Keep `createPipeline()` as the Center

DX 개선이 `createPipeline()`을 우회하면 안 된다.

모든 integration은 결국 아래 구조를 공유해야 한다:

```ts
const config = await loadConfig();
const pipeline = createPipeline(config);
```

Slack bot, API server, background worker 모두 이 공통 surface를 재사용해야 한다.

### 7.2 Avoid Core Slack Coupling

Slack-specific concerns:

- ack timing
- message formatting
- bot permissions
- retries

이건 example 레이어에 있어야 한다.

### 7.3 Separate Transport From Retrieval Logic

HTTP/Slack는 transport layer다.
RAG logic은 pipeline layer에 남겨야 한다.

즉:

- transport: express, slack, route handlers
- rag logic: `pipeline.ask()`, `pipeline.search()`, `pipeline.ingest()`

---

## 8. Risks

### 8.1 Over-abstracting Too Early

너무 빨리 `server` abstraction을 만들면:

- 사용 패턴이 고정되기 전에 API가 굳는다
- framework별 예외 처리로 core가 복잡해진다

### 8.2 Example Drift

examples가 실제 API와 자주 어긋날 수 있다.

대응:

- [ ] examples도 CI 대상에 포함
- [ ] 최소 typecheck 또는 smoke test 추가

### 8.3 DX Fragmentation

CLI, library API, examples, serve mode가 서로 다른 방식으로 보이면 혼란이 생긴다.

대응:

- 모든 usage path가 `createPipeline()` 중심으로 수렴하게 유지

---

## 9. Success Criteria

이 roadmap이 성공했다고 볼 기준:

- [ ] 개발자가 CLI 없이 app code에서 ragpipe를 붙일 수 있다
- [ ] Slack bot example이 실제 동작한다
- [ ] HTTP API example이 실제 동작한다
- [ ] docs/examples/server가 같은 pipeline mental model을 공유한다
- [ ] `ragpipe`가 "CLI 도구"가 아니라 "embeddable TS RAG toolkit"으로 인식된다

---

## 10. Immediate Next Step

가장 추천하는 바로 다음 작업:

- [ ] `examples/with-slack-bot/` 스펙 작성

이유:

- DX 개선 체감이 가장 크다
- 실제 앱 연동 사례를 바로 보여줄 수 있다
- core 변경이 거의 필요 없다
- 이후 HTTP example과 helper 설계에도 기준점이 된다
