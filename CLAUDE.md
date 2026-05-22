# 된다 (DenDa) — AI 코딩 하네스 정책 레이어

> 솔로 개발 + AI 에이전트(Claude Code 등)로 풀 사이클 빌드.
> 이 문서는 **모든 새 세션이 가장 먼저 읽는 정책**.
> 제품 사실·게이트·결정 본문은 docs/에 (이 파일은 정책·메타만).

## 새 세션 읽기 순서

### 모든 세션 공통 (필수, 4개)
1. **이 파일** (CLAUDE.md) — 정책
2. [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — 제품·페르소나·게이트·금지선·결정 (~105줄)
3. [docs/SESSION_LOG.md](docs/SESSION_LOG.md) — 최근 완료 3건
4. [docs/PROGRESS.md](docs/PROGRESS.md) — 활성 게이트

`docs/TASK_BACKLOG.md`는 `/start-task` 호출 시 lazy 로드.

### 역할별 추가
| 작업 종류 | 추가로 읽기 |
|---|---|
| **UI / Frontend** | [docs/DESIGN.md](docs/DESIGN.md) (의무) |
| **Backend / Edge Function** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §3-§4 |
| **테스트 작성** | [docs/TEST_PLAN.md](docs/TEST_PLAN.md) |
| **새 결정 / 의문** | [docs/DECISIONS.md](docs/DECISIONS.md) + [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) |

`.claude/rules/`는 편집 파일 path에 따라 자동 로드.

## 절대 규칙

이 7가지는 절대 어기지 않는다. 본문은 DECISIONS.md를 참조.

1. **시각 결정은 DESIGN.md 토큰 외 금지** → [D4](docs/DECISIONS.md#d4--디자인-원칙-토스-풍-절제), [D5](docs/DECISIONS.md#d5--purple-discipline), [D6](docs/DECISIONS.md#d6--다크모드--시스템-자동-독립-디자인), [D7](docs/DECISIONS.md#d7--typography-pretendard-variable-단일-패밀리-셀프호스팅). 위반은 `.claude/hooks/design-guard.sh`가 차단.
2. **TDD 의무** — 테스트 먼저 → 실패 확인 → 구현 → 통과. `/start-task`가 강제. → [D24](docs/DECISIONS.md#d24--test-framework)
3. **KST 명시** — `new Date()` 직접 금지. luxon + Asia/Seoul. → [D13](docs/DECISIONS.md#d13--kst-강제-db는-timestamptz-utc)
4. **한국어 UI 라벨** — 베타 한국어 only.
5. **결정 변경 즉시 DECISIONS.md 기록** — 새 D{N} 추가 + OPEN_QUESTIONS의 `Closed by D{N}` 표기.
6. **🔒 Phase 3 코드 작성 금지** — 전체 금지 목록은 [PROJECT_CONTEXT.md §6](docs/PROJECT_CONTEXT.md#6-절대-금지-phase-boundary).
7. **secret · API key 클라이언트 expose 금지** — HMAC·Kakao secret·Gemini key는 Edge Function only.

## 작업 흐름

- `/start-task [코드]` — TASK_BACKLOG에서 다음 태스크 시작 (의존성 + TDD 강제)
- `/ship-task` — SESSION_LOG·PROGRESS update + git commit
- `/design-check` — DESIGN.md 토큰 정합 검증
- `@reviewer` — 큰 변경 ship 전 코드 리뷰 (Read-only 서브에이전트)

## 새 결정 / 의문 추가 절차

**새 결정**: DECISIONS.md 템플릿 복사 → 새 D{N} → OPEN_QUESTIONS `Closed by D{N}` → 영향받는 docs/ 업데이트 → rules/에 새 grep pattern 필요 시 design-guard.sh 추가.

**새 의문**: OPEN_QUESTIONS.md 적절한 카테고리(A/B/C/D)에 새 Q-{ID} → 차단된 태스크의 `Depends`에 Q-{ID} 추가.

## Glob 자동 로드 규칙 (참고)

| 편집 파일 | 자동 로드 rules |
|---|---|
| `src/**/*.tsx` | design.md + react-native.md + ko-kr.md |
| `src/lib/supabase/**` | supabase.md + ko-kr.md |
| `supabase/functions/**` | supabase.md + ko-kr.md |
| `**/*.test.tsx` | testing.md + react-native.md + design.md + ko-kr.md |
| `*.md`, `*.sql` | ko-kr.md |

자동 로드는 컨텍스트 절약 — 명시적 Read 불필요.

## 글로벌 superpowers와 관계

이 프로젝트 하네스는 글로벌 [superpowers](https://github.com/anthropic-experiments/superpowers) v5.1.0 위에서 동작. 중복 정의 없음.

## 정책 변경 절차

이 파일 변경 시: 사용자 승인 + 변경 사유 git commit 메시지 명시 + 영향받는 rules/skills/agents 함께 변경.

---

**Last updated**: 2026-05-22 (SSoT 격상 + 역할 분리)
