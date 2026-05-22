---
name: start-task
description: TASK_BACKLOG에서 다음 태스크 시작. 의존성 확인 → 테스트 작성 → 구현 흐름 강제. 새 빌드 작업 시작 시 호출.
---

# /start-task

다음 빌드 태스크를 안전하게 시작하는 절차. TDD + 의존성 추적 + 결정 검증을 묶음.

## 절차 (반드시 순서대로)

### 1. 다음 TODO 태스크 확인 (Lazy load 진입점)

이 시점에 [TASK_BACKLOG.md](../../../docs/TASK_BACKLOG.md)를 처음 읽는다 — 모든 세션 필수 읽기에서는 빠져 있다 (CLAUDE.md 정책).

[TASK_BACKLOG.md](../../../docs/TASK_BACKLOG.md)에서:
- 사용자가 명시한 태스크 코드 (예: S05) **또는**
- Lane별 다음 TODO (Status: TODO, Status: BLOCKED 아닌 것)
- 현재 Sprint(PROGRESS.md 참조)에 해당하는 것 우선

태스크가 없으면 → Sprint 마일스톤 확인 → 사용자에게 다음 sprint 진입 여부 물음.

### 2. 의존성 확인 (BLOCKED 체크)
- **Depends 필드**의 다른 태스크가 **DONE 인지** [SESSION_LOG.md](../../../docs/SESSION_LOG.md)에서 확인
- **Depends에 D{N} 결정**이 있으면 [DECISIONS.md](../../../docs/DECISIONS.md)에서 결정 확정 여부 확인
- **Depends에 Q-{ID} 질문**이 있으면 [OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md)에서 답변 상태 확인

차단된 의존성이 있으면:
- 사용자에게 보고 ("S05 시작 전 S00이 DONE이어야 함. 현재 TODO 상태.")
- **시작하지 않음** — 사용자가 의존 해결 또는 force 결정

### 3. 관련 문서 읽기 (컨텍스트 로드)
태스크 종류에 따라:
- **UI 작업** (frontend, 화면): [DESIGN.md](../../../docs/DESIGN.md) 의무 + `.claude/rules/design.md`, `react-native.md`, `ko-kr.md`
- **백엔드 작업** (Supabase, Edge Function): [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) §4 (Realtime) + `.claude/rules/supabase.md`, `ko-kr.md`
- **테스트 작성**: [TEST_PLAN.md](../../../docs/TEST_PLAN.md) + `.claude/rules/testing.md`
- **모든 작업**: 해당 태스크의 `Notes` 필드, 관련 [DECISIONS.md](../../../docs/DECISIONS.md) 참조

### 4. TodoWrite로 sub-task 분해
큰 태스크는 sub-task로 쪼개기:
```
1. 테스트 작성 (failing 확인)
2. 핵심 구현
3. 엣지 케이스
4. 통합 (관련 컴포넌트)
5. 타입 안전 + lint pass
6. /ship-task
```

### 5. TDD — 테스트 먼저 작성
[testing rule](../../rules/testing.md)에 따라:
- Acceptance criteria → 테스트 변환
- Jest (unit/integration) 또는 Maestro (E2E) 또는 Deno (Edge Function)
- 실행 → **실패 확인** (red)
- 실패 메시지 사용자에게 보고

### 6. 구현 + 통과 확인
- 최소 구현 → 테스트 통과 (green)
- 리팩토링 (refactor)
- 모든 테스트 그린 + `npx tsc --noEmit` 0 + `npx eslint` 0 확인

### 7. /ship-task 호출
모든 통과 시 `/ship-task`로 마무리:
- SESSION_LOG.md 항목 prepend
- PROGRESS.md +1
- TASK_BACKLOG.md Status: DONE
- git commit

## 금지

- 의존성 확인 안 하고 시작
- 테스트 없이 구현 먼저
- DESIGN.md 안 읽고 UI 작업
- `Date()`, hex 색, 영문 라벨 직접 작성 (rules 위반)
- DONE 마킹 전 `/ship-task` 스킵

## 참고 — 태스크 종류별 빠른 진입점

| 태스크 | 우선 읽기 |
|---|---|
| S00 (Backend foundation) | ARCHITECTURE.md §2 데이터 모델, rules/supabase.md |
| S01 (Kakao OAuth) | ARCHITECTURE.md §3.1, D1, D21, rules/supabase.md |
| S05 (시간 그리드) | DESIGN.md §10.1, ARCHITECTURE.md §4, D11, D12, rules/react-native.md |
| S10 (지도) | ARCHITECTURE.md §3.2-3.3, D18, D26 |
| S14 (Web guest) | DESIGN.md, D23, rules/testing.md (Playwright) |
| S11 (다크 토큰) | DESIGN.md §3, §13, D6, D7 |
