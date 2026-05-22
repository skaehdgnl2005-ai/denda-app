---
description: TDD 의무, Jest + Maestro + Playwright + Deno test. 테스트 작성 시 자동 로드.
globs:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "tests/**"
  - "e2e/**"
  - "playwright/**"
  - "maestro/**"
---

# Testing Rules

→ 결정: [D24 Test Framework](../../docs/DECISIONS.md#d24--test-framework). 전체 plan: [TEST_PLAN.md](../../docs/TEST_PLAN.md)

## 절대 규칙

### TDD 의무

새 기능 / 버그 수정 시 **테스트 먼저 작성** → 실패 확인 → 구현 → 통과.
`/start-task` 스킬이 이 흐름을 강제한다.

### Framework 사용처

| 영역 | Framework | 위치 |
|---|---|---|
| Unit / Integration (RN) | Jest + @testing-library/react-native | `src/**/*.test.ts(x)` |
| Component visual (선택) | Storybook for RN | `src/components/**/*.stories.tsx` |
| E2E mobile | Maestro | `maestro/*.yaml` |
| Web guest E2E | Playwright | `web-guest/playwright/*.spec.ts` |
| Supabase Edge Function | Deno test (Supabase 공식) | `supabase/functions/**/*_test.ts` |
| OCR eval (D2 keep) | Gemini JSON 비교 + ground truth | `tests/ocr/ground_truth/` |

### 테스트 framework별 예제

- Jest + RN testing-library 예제: [TEST_PLAN.md §3.1](../../docs/TEST_PLAN.md)
- Maestro E2E 예제: [TEST_PLAN.md §3.2](../../docs/TEST_PLAN.md)
- Deno test (Supabase Edge) 예제: [TEST_PLAN.md §3.3](../../docs/TEST_PLAN.md)
- OCR ground truth 구조: [TEST_PLAN.md §3.4](../../docs/TEST_PLAN.md) (실제 디렉토리: `tests/ocr/ground_truth/`)

### 필수 테스트 set (Phase 1+2)

TEST_PLAN.md 47+ 테스트 path. 카테고리:
- 32 unit/integration (코드 path)
- 15 E2E user flow
- 1 regression (Prior MVP 시간 그리드 동작 영상 비교)
- OCR eval ~20장 (Gemini Vision ground truth)

### Critical paths (반드시 통과)

Gate metric에 직접 영향:
1. **"예약하기" click event 정확도** — 더블 탭 idempotent, 1 event만 로그
2. **모임 확정 → 장소 확정 funnel** — Gate #1 측정 instrument
3. **Segment 라벨링** — P1 학생 / P2 직장인 구분 데이터

### 부하 / Regression

- **60fps 시간 그리드**: 7명 모임 × 동시 투표 (load test + Realtime simulation). production binary 측정 의무 (dev mode 측정 금지).
- **저사양 baseline**: iPhone SE 2nd gen + Galaxy A14 (P1 페르소나 기기).
- **Prior MVP regression**: 웹 시간 그리드 영상 vs 새 RN 코드 side-by-side. 드래그 sweep 동작이 달라지면 30명 prior user retention ↓.

## 금지 패턴

- 테스트 없이 새 기능 commit (TDD 위반)
- E2E에서 fixed `sleep()` 사용 → `assertVisible`로 대기
- Realtime broadcast mock 부정확 (실제 Supabase Realtime client 사용 권장)
- DB mock (Supabase LOCAL test instance 사용)
- 60fps 측정을 dev mode에서 (production binary 의무)

## CI/CD

| 명령 | 대상 |
|---|---|
| `npm test` | Jest (RN unit/integration) |
| `npm run e2e` | Maestro Cloud 또는 local |
| `npm run e2e:web` | Playwright |
| `supabase functions test` | Deno test |

PR 시 모든 그린 + typecheck 0 + lint 0 의무.
