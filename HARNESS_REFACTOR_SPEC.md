# 된다 앱 하네스 최적화 작업 지시서

> **수신**: 작업을 수행할 AI 에이전트 (Claude Code 등)
> **발신**: 하네스 진단 AI (선행 분석 완료)
> **목표**: 된다 앱 AI 하네스의 SSoT(Single Source of Truth) 붕괴와 토큰 부하 문제를 단계적으로 해소
> **작업 유형**: 하네스 메타-리팩터링 (앱 코드 변경 아님 — `.claude/`, `CLAUDE.md`, `docs/` 만 수정)
> **선행 진단 일자**: 2026-05-22

---

## §0. 작업 전 필수 확인 — 컨텍스트 로딩

### 0.1. 너는 무엇을 하고 있는가
이 작업은 **앱 소스 코드 변경이 아니다**. 된다 앱의 AI 하네스(Claude Code 등이 사용하는 정책·규칙·문서 구조)를 리팩터링하는 메타 작업이다. 변경 대상 디렉토리는 다음 세 곳뿐이다:
- `CLAUDE.md` (루트, 정책)
- `.claude/` (실행 계층: rules·skills·agents·hooks·settings)
- `docs/` (지식 계층)

`src/`, `supabase/`, `web-guest/`, `tests/` 등 **앱 코드는 절대 건드리지 않는다**.

### 0.2. 진단 결과 요약 (반드시 이해할 것)
선행 분석에서 다음 사실들이 측정되었다:

| 지표 | 측정값 | 의미 |
|---|---|---|
| 같은 결정이 명시된 파일 수 (D13 KST) | 10 / 12 | SSoT 붕괴 — D13을 바꾸려면 10곳 동기화 필요 |
| 같은 결정이 명시된 파일 수 (D7 폰트) | 8 / 12 | 동일 |
| 모든 세션 필수 읽기 총 줄 수 | 861줄 | PROJECT_CONTEXT.md(105줄) 도입의 압축 효과를 무력화 |
| `rules/supabase.md` 길이 | 165줄 | 자동 주입되는 파일이 너무 김. 코드 예제가 본문 차지 |
| `design-guard.sh` Windows 경로 의존성 | 37번 줄 | macOS/Linux에서 hook 무력화 위험 |

### 0.3. 어떤 원칙을 따르는가
1. **Minimal scaffolding, maximal harness** — 같은 규칙을 여러 곳에 적지 말고, 결정적 강제(hook)와 한 곳 참조로 대체
2. **Single Source of Truth** — 모든 결정은 `docs/DECISIONS.md`의 D{N}이 진실. 다른 파일은 참조만
3. **Lazy loading over eager loading** — 작업 시작 시점에 필요한 것만 읽고, 모든 세션에 강제하지 않는다
4. **Hook은 환경 의존성 없어야 한다** — 어느 OS에서나 동작해야 신뢰 가능

### 0.4. 절대 변경 금지 항목 (HARD DENY)
다음은 어떤 경우에도 변경·삭제하지 않는다. 의심스러우면 사용자에게 확인.
- `docs/DECISIONS.md`의 **D1~D26, G1, G2 결정 자체의 정의**: 결정 본문은 유지. 위치만 SSoT로 격상.
- `docs/archive/**`: 의사결정 사후 추적용 보존. 단 1바이트도 변경 금지.
- `docs/PRD.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`의 본문: 다른 파일이 이것들을 참조하는 방식만 바꾼다.
- `src/`, `supabase/functions/`, `tests/`: 앱 코드 영역.
- `package.json`, `tsconfig.json`, `app.json`: 빌드 설정.
- `git` history rewrite: 절대 금지. 모든 작업은 새 commit으로.

### 0.5. 작업 전 체크리스트
시작 전 다음을 반드시 확인:
- [ ] `git status` 확인 — 작업 디렉토리가 깨끗한가 (untracked·modified 없음)
- [ ] 현재 브랜치 확인 — `main`이 아니라면 사용자에게 의도 확인
- [ ] 새 브랜치 생성 권장: `git checkout -b refactor/harness-ssot`
- [ ] `docs/SESSION_LOG.md` 읽고 진행 중 작업과 충돌 없는지 확인

---

## §1. 작업 범위 및 우선순위

### 작업 의존성 그래프
```
P0 (즉시 — 토큰 부하 30~40% 감소)
├── Task 1: DECISIONS.md를 SSoT로 격상 (선행)
├── Task 2: rules/*.md 본문을 참조로 치환 (Task 1 의존)
├── Task 3: CLAUDE.md ↔ PROJECT_CONTEXT.md 역할 분리 (독립)
└── Task 4: TASK_BACKLOG를 lazy 로드로 강등 (Task 3 의존)

P1 (다음 주 — 일관성 부담 해소)
├── Task 5: rules/*.md 슬림화 50줄 이하 (Task 2 후속)
├── Task 6: design-guard.sh OS 경로 의존성 제거 (독립)
└── Task 7: archive를 검색에서 제외 (독립)

P2 (점진 개선)
├── Task 8: reviewer.md 압축 12→4 영역 (독립)
└── Task 9: SESSION_LOG auto-archive 강제 (독립)
```

### 권장 진행 순서
1. P0 4개를 한 번에 진행 → 사용자에게 diff 검토 요청 → 단일 commit
2. 사용자 승인 후 P1 3개 진행 → 단일 commit
3. 사용자 승인 후 P2 2개 진행 → 단일 commit

각 단계 사이에 사용자 검토를 받는다. **모든 P0를 한 번에 commit하면 diff가 너무 커서 사용자가 못 본다.** Task별로 git commit을 분리하는 것이 안전하다.

---

## §2. P0 — 즉시 적용 (토큰 부하 감소)

### Task 1 — DECISIONS.md를 SSoT(Single Source of Truth)로 격상

**목적**: 모든 결정(D1~D26, G1·G2)의 진실의 위치를 `docs/DECISIONS.md`로 명시 선언한다. 다른 파일은 참조만 한다는 정책을 문서화한다.

**변경 대상 파일**: `docs/DECISIONS.md` (헤더 부분만)

**현재 상태** (1~6번 줄):
```markdown
# Decisions Log

> 된다 앱의 모든 확정 결정은 여기 기록한다. 새 결정이 생기면 즉시 추가.
> 출처: ENG_REVIEW(D1~D3), DESIGN(§16), OFFICE_HOURS(게이트)
> 최신순으로 정렬.
```

**변경 후 상태**:
```markdown
# Decisions Log

> **이 문서는 된다 앱 모든 결정의 진실의 단일 위치(SSoT)다.**
> D1~D26, G1·G2의 본문은 오직 여기에만 존재한다.
> 다른 파일(`CLAUDE.md`, `.claude/rules/*.md`, `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`, `docs/PROJECT_CONTEXT.md`)은 결정 ID(`D{N}`, `G{N}`)와 1줄 요약 + 이 문서의 해당 절 링크만 가질 수 있다.
>
> 본문(근거·대안·코드 예제 등)을 복제하는 행위는 금지한다.
> 만약 결정이 바뀌면 이 문서만 수정하고, 다른 파일은 참조 링크만 검증한다.
>
> 출처: ENG_REVIEW(D1~D3), DESIGN(§16), OFFICE_HOURS(게이트)
> 최신순으로 정렬.
```

**검증**:
- `head -15 docs/DECISIONS.md`로 새 정책 선언이 잘 들어갔는지 확인
- D1~D26 본문은 한 줄도 변경되지 않아야 함: `git diff docs/DECISIONS.md`에서 8번 줄 이후 변경 0줄

**commit 메시지**:
```
refactor(harness): DECISIONS.md를 SSoT로 명시 선언

- D{N} 본문은 오직 DECISIONS.md에만 존재한다는 정책을 헤더에 추가
- 다른 파일은 참조 링크만 가능 (Task 2에서 적용)
```

---

### Task 2 — rules/*.md의 결정 본문을 참조로 치환

**목적**: rules 파일들이 D{N} 결정의 코드 예제·근거를 본문으로 복제하고 있는 것을 모두 1~3줄 참조로 치환한다.

**변경 대상 파일**: 5개
- `.claude/rules/ko-kr.md`
- `.claude/rules/react-native.md`
- `.claude/rules/supabase.md`
- `.claude/rules/testing.md`
- `.claude/rules/design.md`

**작업 패턴**: 각 rules 파일에서 다음과 같은 결정 본문 블록을 찾아 1~3줄 참조로 치환한다.

#### 2.1. `.claude/rules/supabase.md`

**찾을 패턴 1** (D11 본문 블록):
```markdown
### Realtime 히트맵 = Edge Function aggregation (D11)

**금지**: 클라이언트에서 raw votes 받아 합산.
**의무**: Edge Function이 group_id로 합산 → broadcast.

```ts
// supabase/functions/votes_aggregate/index.ts
// votes INSERT trigger → 합산 → broadcast
const { data: counts } = await supabase
  .from('votes')
  .select('start_minute, count(*)')
  .eq('group_id', groupId)
  .group('start_minute');

await supabase.channel(`group:${groupId}`).send({
  type: 'broadcast',
  event: 'heatmap_update',
  payload: { slots: counts },
});
```

클라이언트는 `broadcast`만 listen → `useSharedValue` 업데이트 (rules/react-native.md 참조).
```

**치환 후**:
```markdown
### D11 — Realtime 히트맵 = Edge Function aggregation

클라이언트 raw votes 합산 금지. Edge Function이 합산 후 broadcast.

- 결정 본문 · 근거: [DECISIONS.md#d11](../../docs/DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b)
- 구현 예제: [ARCHITECTURE.md §4 Realtime aggregation](../../docs/ARCHITECTURE.md)
- Edge Function 위치: `supabase/functions/votes_aggregate/`
```

**같은 패턴으로 치환할 항목들**:
- D16 차단 helper 본문(SQL 예제 포함) → 참조로
- D17 F4 idempotency 본문(TS 예제 포함) → 참조로
- D14 시간 슬롯 CHECK 본문(SQL 예제) → 참조로
- D13 TIMESTAMPTZ 본문 → 참조로
- D20 Calendar push fan-out 본문 → 참조로

**원칙**:
- 결정의 **한 줄 요약**과 **금지/의무 명령**은 rules에 남긴다 (LLM이 즉시 보고 행동 변경 가능해야 하므로)
- 결정의 **근거·대안·전체 코드 예제**는 DECISIONS.md 또는 ARCHITECTURE.md로 이동·참조

#### 2.2. `.claude/rules/ko-kr.md`

`### KST 타임존 강제` 절의 코드 예제(`luxon` 사용법 등)를 다음으로 치환:
```markdown
### D13 — KST 강제

- DB = `TIMESTAMPTZ` (UTC 정규화 저장)
- Client = `Asia/Seoul` (luxon 또는 date-fns-tz)
- `new Date()` 직접 사용 금지 (design-guard hook이 차단)

결정 본문 · 예제: [DECISIONS.md#d13](../../docs/DECISIONS.md#d13--kst-강제-db는-timestamptz-utc)
```

`### Pretendard 셀프호스팅` 절의 폰트 fallback chain 등 세부도 동일하게 D7 참조로 치환.

#### 2.3. `.claude/rules/react-native.md`

`### 60fps 시간 그리드 (회사 운명) — D12` 절의 worklet 코드 예제(❌/✅ 패턴) 전체를 다음으로 치환:
```markdown
### D12 — 60fps 시간 그리드

- Drag = `Gesture.Pan()` + Reanimated worklet (UI thread)
- 셀 상태 = `useSharedValue` (JS state 금지)
- 매 cell touch마다 `setState` 금지 — 60fps 무너짐

코드 예제 · 근거: [DECISIONS.md#d12](../../docs/DECISIONS.md#d12--60fps-시간-그리드-구현-spec)
```

`### Cold start < 2초 — D25` 절의 `lazy(() => import(...))` 예제 5개도 동일하게 참조로 치환. **lazy 대상 목록은 rules에 남긴다** (그 자체가 명령적 정보).

#### 2.4. `.claude/rules/testing.md`

`### Jest + RN testing-library`, `### Maestro E2E`, `### Deno test` 절의 코드 예제 블록을 모두 다음 패턴으로:
```markdown
### 테스트 framework별 예제

- Jest + RN testing-library 예제: [TEST_PLAN.md §3.1](../../docs/TEST_PLAN.md)
- Maestro E2E 예제: [TEST_PLAN.md §3.2](../../docs/TEST_PLAN.md)
- Deno test (Supabase Edge) 예제: [TEST_PLAN.md §3.3](../../docs/TEST_PLAN.md)
- OCR ground truth 구조: `tests/ocr/ground_truth/` (실제 디렉토리)
```

**중요**: TEST_PLAN.md에 §3.1~§3.3 절이 없으면, 이 작업 전에 TEST_PLAN.md에 절을 만들어 코드 예제를 이동해야 한다. **rules에서 본문을 삭제하기 전에 반드시 docs/에 옮긴 뒤** 삭제할 것.

#### 2.5. `.claude/rules/design.md`

이 파일은 비교적 명령조로 잘 작성되어 있지만, `### 컴포넌트 spec 빠른 참조` 표는 그대로 유지하고, DESIGN.md를 가리키는 라인은 강조한다. 본문 변경 최소.

**Task 2 검증**:
```bash
# 각 rules 파일의 줄 수가 줄었는지 확인 (목표: 모두 100줄 이하)
wc -l .claude/rules/*.md

# 결정 ID 참조가 제대로 들어갔는지 확인
grep -E "DECISIONS\.md#d" .claude/rules/*.md | wc -l  # 최소 15개 이상이어야 함

# 코드 블록(```) 개수가 줄었는지 확인
grep -c '```' .claude/rules/*.md
```

**commit 메시지**:
```
refactor(harness): rules/*.md 본문을 DECISIONS.md 참조로 치환

- supabase.md, ko-kr.md, react-native.md, testing.md, design.md
- D11/D12/D13/D14/D16/D17/D20/D25 코드 예제를 DECISIONS·ARCHITECTURE·TEST_PLAN 참조로 이동
- rules 파일은 명령적 한 줄 요약 + 참조 링크만 유지

Closes: SSoT 붕괴 해소 P0-2
```

---

### Task 3 — CLAUDE.md ↔ PROJECT_CONTEXT.md 역할 분리

**목적**: 두 파일이 동일한 정보(제품 한 줄, Phase 1+2 상태, Gate #2, Phase 3 금지 항목)를 중복 명시하는 것을 끊는다. 역할을 칼같이 나눈다.

**역할 정의 (HARD)**:
- **CLAUDE.md** = "Claude가 어떻게 행동하는가"만 (정책·읽기 순서·작업 흐름·메타 절차)
- **PROJECT_CONTEXT.md** = "우리가 무엇을 만드는가"만 (제품 사실·게이트·금지선·Cardinal 결정)

#### 3.1. CLAUDE.md에서 삭제할 절들

| 현재 절 | 조치 | 이유 |
|---|---|---|
| `## 제품 한 줄` (8~10번 줄) | **삭제** | PROJECT_CONTEXT.md §1과 중복 |
| `## 절대 규칙` 6번 (Phase 3 코드 작성 금지) | **참조로 축약** | PROJECT_CONTEXT.md §6과 중복 — "🔒 [Phase 3 금지 항목 전체](docs/PROJECT_CONTEXT.md#6-절대-금지-phase-boundary)" |
| `## 파일 인덱스` (66~100번 줄) | **삭제** | PROJECT_CONTEXT.md §9 참조 인덱스로 흡수 |
| `## Glob 자동 로드 규칙 (참고)` (149~160번 줄) | **유지** | 메타 정보 — CLAUDE.md에 적절 |

#### 3.2. CLAUDE.md 최종 구조 (목표 80줄)

새 CLAUDE.md는 다음 구조만 갖는다:
```markdown
# 된다 (DenDa) — AI 코딩 하네스 정책 레이어

> 솔로 개발 + AI 에이전트(Claude Code 등)로 풀 사이클 빌드.
> 이 문서는 **모든 새 세션이 가장 먼저 읽는 정책**.
> 제품 사실·게이트·결정 본문은 docs/에 (이 파일은 정책·메타만).

## 새 세션 읽기 순서

### 모든 세션 공통 (필수, lazy 강등 후 4개)
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

새 결정: DECISIONS.md 템플릿 복사 → 새 D{N} → OPEN_QUESTIONS `Closed by D{N}` → 영향받는 docs/ 업데이트 → rules/에 새 grep pattern 필요 시 design-guard.sh 추가.

새 의문: OPEN_QUESTIONS.md 적절한 카테고리(A/B/C/D)에 새 Q-{ID} → 차단된 태스크의 `Depends`에 Q-{ID} 추가.

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

**Last updated**: {오늘 KST 날짜} (SSoT 격상 + 역할 분리)
```

#### 3.3. PROJECT_CONTEXT.md는 변경하지 않는다

현재 PROJECT_CONTEXT.md는 적절한 구조다. 단 §7의 Cardinal 결정 발췌는 그대로 유지하되, 각 항목 끝에 `→ [전체 본문](DECISIONS.md#d{N})` 링크가 이미 있는지 확인. 없으면 추가.

**Task 3 검증**:
```bash
wc -l CLAUDE.md  # 목표: 80~90줄 (현재 192줄)
grep -c "## " CLAUDE.md  # 절 개수가 줄었는지

# CLAUDE.md에서 PROJECT_CONTEXT.md와 중복되는 표현이 사라졌는지 확인
grep -E "제품 한 줄|친구들과 시간 맞추고|click-through 측정만" CLAUDE.md
# 위 grep 결과가 비어 있어야 함 (또는 단순 link 형태만)
```

**commit 메시지**:
```
refactor(harness): CLAUDE.md와 PROJECT_CONTEXT.md 역할 분리

- CLAUDE.md = 정책·읽기순서·메타절차 only (192→~85줄)
- PROJECT_CONTEXT.md = 제품사실·게이트·금지선 only (변경 없음)
- 중복 제거: 제품 한 줄, Phase 1+2 상태, Phase 3 금지 항목, 파일 인덱스
- 절대 규칙 7개는 DECISIONS.md 참조 형태로 축약

Closes: 역할 혼란 해소 P0-3
```

---

### Task 4 — TASK_BACKLOG.md를 lazy 로드로 강등

**목적**: 모든 세션이 344줄의 TASK_BACKLOG를 강제 로드하는 것을 끊는다. `/start-task` 스킬 호출 시점에만 lazy 로드한다.

**변경 대상 파일**: 2개
- `CLAUDE.md` (Task 3에서 이미 수정됨 — `## 새 세션 읽기 순서`에서 TASK_BACKLOG가 빠지는지 확인)
- `.claude/skills/start-task/SKILL.md` (lazy 로드 책임 명시)

**`.claude/skills/start-task/SKILL.md`의 1번 절차 강조**:

기존 (13~16번 줄):
```markdown
### 1. 다음 TODO 태스크 확인
[TASK_BACKLOG.md](../../../docs/TASK_BACKLOG.md)에서:
```

다음으로 치환:
```markdown
### 1. 다음 TODO 태스크 확인 (Lazy load 진입점)

이 시점에 [TASK_BACKLOG.md](../../../docs/TASK_BACKLOG.md)를 처음 읽는다 — 모든 세션 필수 읽기에서는 빠져 있다.

[TASK_BACKLOG.md](../../../docs/TASK_BACKLOG.md)에서:
```

**Task 4 검증**:
```bash
# CLAUDE.md의 "필수" 또는 "공통" 절에 TASK_BACKLOG가 없는지 확인
grep -A 10 "모든 세션 공통" CLAUDE.md | grep TASK_BACKLOG
# 비어 있어야 함

# start-task SKILL.md에 lazy load 명시가 들어갔는지
grep -i "lazy load" .claude/skills/start-task/SKILL.md
```

**commit 메시지**:
```
refactor(harness): TASK_BACKLOG.md를 lazy 로드로 강등

- 모든 세션 필수 읽기에서 제거 (5개→4개)
- /start-task 스킬 호출 시점에만 로드
- 토큰 부하 감소: 모든 세션 861→~517줄 (40% 감소)

Closes: 컨텍스트 부담 P0-4
```

---

### P0 완료 후 사용자에게 보고할 것

1. 변경 전후 줄 수 비교 표
   ```
   | 파일 | 이전 | 이후 | 변화 |
   ```
2. SSoT 매트릭스 재측정 — `D13 KST` 등 핵심 결정이 본문으로 명시된 파일 수가 줄었는지
3. `git diff --stat`의 전체 변경 줄 수
4. 사용자가 P1로 진행할지 묻는다

---

## §3. P1 — 일관성 부담 해소

P0 완료 + 사용자 승인 후 진행.

### Task 5 — rules/*.md 슬림화 50줄 이하 목표

**전제**: Task 2가 완료되었다.

**현황 (목표 vs 실제)**:
| 파일 | 현재 | 목표 |
|---|---|---|
| ko-kr.md | 89줄 | 50줄 이하 |
| supabase.md | 165줄 | 60줄 이하 (가장 김 — 코드 예제 비중 높음) |
| react-native.md | 140줄 | 60줄 이하 |
| testing.md | 152줄 | 50줄 이하 |
| design.md | 92줄 | 60줄 이하 |

**작업 방법**:
- Task 2의 참조 치환만으로 줄 수가 충분히 줄지 않으면, 다음 절들을 docs/로 옮긴다:
  - `### 디렉토리 구조` 절 (supabase.md, react-native.md) → ARCHITECTURE.md로 이동, rules에서는 1줄 링크
  - `### 외부 통합 패턴` 절 (react-native.md) → ARCHITECTURE.md로 이동
  - `### 패턴` 절의 큰 예제 (testing.md) → TEST_PLAN.md로 이동
  - `### CI/CD` 절 (testing.md) → docs/CI_CD.md 신설 또는 ARCHITECTURE.md §7로

**원칙**:
- rules에 남는 것: **금지 패턴 grep 가능한 명령 + D{N} 참조**
- docs에 가는 것: **예제·근거·디렉토리 구조·CI 설정**

**Task 5 검증**:
```bash
wc -l .claude/rules/*.md
# 모두 65줄 이하여야 함 (목표 50줄)
```

**commit 메시지**:
```
refactor(harness): rules/*.md 슬림화 (명령만 남기고 예제는 docs로)

- supabase.md 165→{N}, react-native.md 140→{N}, testing.md 152→{N}
- 디렉토리 구조, 외부 통합 패턴은 ARCHITECTURE.md로
- 테스트 예제는 TEST_PLAN.md로
- rules는 자동 주입되므로 짧을수록 효율적

Closes: P1-5
```

---

### Task 6 — design-guard.sh OS 경로 의존성 제거

**목적**: `.claude/hooks/design-guard.sh`의 Windows 경로 case 문이 macOS/Linux에서 hook을 무력화시키는 잠재 버그를 제거한다.

**변경 대상 파일**: `.claude/hooks/design-guard.sh`

**현재 상태** (35~39번 줄):
```bash
# Skip files outside the project (defensive).
case "$FILE_PATH" in
  /c/dev/된다*|c:/dev/된다*|C:/dev/된다*|"c:\\dev\\된다"*|"C:\\dev\\된다"*) ;;
  *) exit 0 ;;
esac
```

**변경 후**:
```bash
# Skip files outside the project (defensive).
# is_source_file()이 이미 확장자와 node_modules/archive 등을 거르므로
# OS 의존적 절대 경로 매칭은 제거. 어떤 OS·경로에서도 동작해야 hook이 신뢰 가능.
case "$FILE_PATH" in
  /*|[a-zA-Z]:*|*) ;;  # 모든 절대·상대 경로 허용 (is_source_file이 이미 필터함)
esac
```

또는 더 간단하게:
```bash
# Skip files outside the project (defensive).
# OS-independent: is_source_file() filters by extension and directory exclusion.
# Removed Windows-only path matching that would silently disable hook on macOS/Linux.
```
(case 문 자체 삭제)

**검증**:
```bash
# 1. macOS/Linux 가상 시나리오 — 임시 ts 파일 만들어 hook 동작 확인
echo '{"tool_input":{"file_path":"/tmp/test/foo.ts"}}' | bash .claude/hooks/design-guard.sh
# exit code가 0이어야 함 (파일이 없으니 통과)

# 2. hook 차단 동작 확인 — 가짜 위반 파일 만들어 테스트
mkdir -p /tmp/harness-test
cat > /tmp/harness-test/bad.tsx <<'EOF'
const color = "#FF5733";  // D5 위반 — hex 직접 사용
EOF
echo '{"tool_input":{"file_path":"/tmp/harness-test/bad.tsx"}}' | bash .claude/hooks/design-guard.sh
echo "Exit code: $?"  # 2여야 함 (차단)
rm -rf /tmp/harness-test
```

**commit 메시지**:
```
fix(harness): design-guard.sh OS 경로 의존성 제거

- 37번 줄의 Windows 전용 경로 case 삭제
- is_source_file()이 이미 확장자·디렉토리로 필터링하므로 OS 무관
- macOS/Linux 환경에서 hook이 무력화되던 잠재 버그 해소

Closes: P1-6
```

---

### Task 7 — archive를 검색·Read에서 제외

**목적**: `docs/archive/` (2,200줄)이 Grep·Glob 검색에서 우선순위 없이 잡히는 것을 방지. 의사결정 추적이 필요하면 명시적 경로 Read만.

**변경 대상 파일**: `.claude/settings.json`

**현재 상태** (16~45번 줄의 `permissions.allow`):
```json
"allow": [
  ...
  "Read(c:\\dev\\된다 앱\\**)",
  "Write(c:\\dev\\된다 앱\\**)",
  "Edit(c:\\dev\\된다 앱\\**)"
],
```

**변경 후**:
```json
"allow": [
  ...
  "Read(./**)",
  "Write(./**)",
  "Edit(./**)"
],
"deny": [
  "Bash(rm -rf /:*)",
  "Bash(curl * | sh)",
  "Bash(curl * | bash)",
  "Glob(./docs/archive/**)",
  "Grep(./docs/archive/**)"
]
```

**중요**:
- `Read(./docs/archive/**)` 자체는 막지 않는다 — 사용자가 명시적으로 archive 파일을 읽으라고 하면 가능해야 한다.
- `Glob`과 `Grep`만 막아서 패턴 검색의 잡음을 제거한다.
- Windows 절대 경로(`c:\\dev\\된다 앱\\**`)도 함께 일반화한다 (Task 6과 같은 OS 독립성 원칙).

**Task 7 검증**:
```bash
# settings.json이 유효한 JSON인지
python3 -m json.tool .claude/settings.json > /dev/null && echo OK

# Claude Code 재시작 후 grep 동작 확인 (수동)
# `Grep -r "Phase 3" docs/`가 archive를 안 잡는지
```

**commit 메시지**:
```
refactor(harness): archive를 Glob/Grep에서 제외 + 경로 일반화

- .claude/settings.json
- docs/archive/**는 Glob·Grep deny (Read는 명시 시 허용)
- Windows 절대 경로를 상대 경로로 일반화 (OS 독립)

Closes: P1-7
```

---

## §4. P2 — 점진 개선

P1 완료 + 사용자 승인 후 진행. P2는 효과가 점진적이라 P0/P1 후 한 달 정도 사용해보고 진행해도 좋다.

### Task 8 — reviewer.md 12개 영역 → Critical 4개로 압축

**목적**: 솔로 개발자가 매 ship 전 12개 리뷰 영역을 다 받으면 응답이 길어 실제로는 안 호출하게 된다. Critical만 유지.

**변경 대상**: `.claude/agents/reviewer.md`

**유지할 4개 (Critical)**:
1. 디자인 토큰 일치 (D4·D5·D6·D7)
2. RLS 누락 (D16)
3. KST 타임존 (D13)
4. Secret / API key 노출

**다른 곳으로 이동할 8개**:
| 검토 영역 | 이동 대상 |
|---|---|
| 테스트 커버리지 | `/ship-task` 스킬이 이미 `npm test` 강제 |
| 한국어 UI 일관 | `design-guard.sh` hook이 grep으로 잡음 |
| 60fps spec 준수 | `/design-check` 스킬에 60fps 체크리스트 추가 |
| Realtime aggregation | `/design-check` 또는 새 `/backend-check` 스킬 |
| Push F4 idempotency | S04/S12 태스크 acceptance에 명시 |
| Calendar 부분 실패 | S06 태스크 acceptance에 명시 |
| Phase 3 코드 누출 | design-guard.sh에 추가 (`grep -E "토스페이먼츠|reservations" → exit 2`) |
| 의존성 일관성 | `npm audit` + `/ship-task` 5단계에 추가 |

**reviewer.md 목표 줄 수**: 60줄 이하 (현재 151줄)

**commit 메시지**:
```
refactor(harness): reviewer.md를 Critical 4개 영역으로 압축

- 12개 검토 영역 → 4개 (디자인 토큰·RLS·KST·secret)
- 나머지는 hook·스킬·acceptance로 분산
- 솔로 환경에서 실제 호출 가능한 가벼움 확보

Closes: P2-8
```

---

### Task 9 — SESSION_LOG auto-archive 강제

**목적**: SESSION_LOG의 "30일+ archive로 이동" 정책이 선언만 되어 있고 강제되지 않는다. `/ship-task`에 자동 archive 트리거 추가.

**변경 대상**: `.claude/skills/ship-task/SKILL.md`

**추가할 절 (6번 git commit 이전)**:
```markdown
### 5.5. SESSION_LOG 자동 archive (30일+ 항목)

`/ship-task` 실행 시 자동으로 30일 이상 된 SESSION_LOG 항목을 archive로 이동:

1. SESSION_LOG.md 항목 중 날짜가 (오늘 KST - 30일) 이전인 것 찾기
2. 해당 항목을 `docs/archive/SESSION_LOG_archived.md` 하단에 append
3. SESSION_LOG.md에서 해당 항목 삭제
4. `git add docs/SESSION_LOG.md docs/archive/SESSION_LOG_archived.md`

스크립트:
\`\`\`bash
bash .claude/skills/ship-task/archive_old_sessions.sh
\`\`\`
(스크립트가 없으면 이 작업 전에 생성 필요 — 사용자에게 요청)
```

**또는 더 가벼운 대안** — 정책만 강제:
```markdown
### 5.5. SESSION_LOG 길이 체크

`wc -l docs/SESSION_LOG.md`가 200줄을 넘으면 사용자에게 archive 권유 알림:
"SESSION_LOG.md가 {N}줄입니다. 30일+ 항목 archive 이동을 권장합니다. `/archive-sessions` 호출 시 자동 처리."
```

**Task 9 검증**:
```bash
# /ship-task SKILL.md에 archive 트리거가 들어갔는지
grep -i "archive\|30일\|wc -l" .claude/skills/ship-task/SKILL.md
```

**commit 메시지**:
```
feat(harness): SESSION_LOG 자동 archive 강제

- /ship-task에 30일+ 항목 자동 archive 트리거 추가
- 또는 200줄+ 시 사용자 알림 (선택)
- 선언적 정책에서 강제 정책으로 격상

Closes: P2-9
```

---

## §5. 작업 완료 기준 (Definition of Done)

전체 9개 Task가 끝났을 때 다음이 모두 만족되어야 한다.

### 5.1. 정량 지표

| 지표 | 작업 전 | 작업 후 목표 | 측정 명령 |
|---|---|---|---|
| 모든 세션 필수 읽기 총 줄 수 | 861줄 | < 500줄 | `wc -l CLAUDE.md docs/PROJECT_CONTEXT.md docs/SESSION_LOG.md docs/PROGRESS.md` |
| `rules/*.md` 평균 줄 수 | 128줄 | < 65줄 | `wc -l .claude/rules/*.md \| tail -1` |
| `D13` 본문 명시 파일 수 | 10 / 12 | 1 / 12 (DECISIONS.md만) | `grep -lE "luxon\|Asia/Seoul" .claude/ CLAUDE.md docs/PROJECT_CONTEXT.md` |
| `D7` 본문 명시 파일 수 | 8 / 12 | 1 / 12 | 동일 패턴 |
| `reviewer.md` 줄 수 | 151줄 | < 70줄 | `wc -l .claude/agents/reviewer.md` |
| `CLAUDE.md` 줄 수 | 192줄 | < 90줄 | `wc -l CLAUDE.md` |

### 5.2. 정성 검증

- [ ] DECISIONS.md 헤더에 SSoT 선언이 들어갔다
- [ ] 모든 rules/*.md가 `[D{N}](../../docs/DECISIONS.md#d{n})` 형태 참조를 가진다
- [ ] CLAUDE.md에 "친구들과 시간 맞추고", "click-through 측정만" 같은 PROJECT_CONTEXT.md와 중복되는 표현이 없다
- [ ] CLAUDE.md의 필수 읽기가 4개로 줄었다 (TASK_BACKLOG 제거)
- [ ] design-guard.sh가 Windows·macOS·Linux 어디서나 동작한다 (Task 6 검증 시나리오 통과)
- [ ] settings.json이 유효한 JSON이고 `Glob(./docs/archive/**)` deny가 있다
- [ ] reviewer.md가 4개 영역만 다룬다
- [ ] `/ship-task` SKILL이 SESSION_LOG length 체크를 한다 (Task 9)

### 5.3. 기능 회귀 테스트

작업 후 다음 시나리오를 직접 실행해 회귀가 없음을 확인:

1. **hook 차단 동작**: 새 `.tsx` 파일에 `#FF5733` hex 작성 → design-guard가 exit 2로 차단하는지
2. **hook 차단 동작 (`new Date()`)**: 새 `.ts` 파일에 `new Date()` 직접 사용 → 차단
3. **rules 자동 로드**: `src/components/foo.tsx` 편집 시 design.md + react-native.md + ko-kr.md가 로드되는지 (수동 확인)
4. **`/start-task` 동작**: TASK_BACKLOG가 lazy 로드되는지 확인 (스킬 호출 시점에만 읽기)
5. **결정 참조 무결성**: `grep -rE "DECISIONS\.md#d\d+" .claude/ CLAUDE.md docs/PROJECT_CONTEXT.md`의 모든 링크가 실제 DECISIONS.md에 존재하는 anchor인지 확인 (broken link 검출)

---

## §6. 절대 금지 사항 (Hard Deny)

다음을 어기는 순간 작업은 무효다. 의심스러우면 사용자에게 확인.

1. **결정 본문 변경 금지** — D1~D26, G1·G2의 정의·근거·대안은 한 글자도 바꾸지 않는다. SSoT로 격상만 한다.
2. **archive 폴더 변경 금지** — `docs/archive/**`는 1바이트도 수정·삭제하지 않는다.
3. **앱 코드 변경 금지** — `src/`, `supabase/`, `web-guest/`, `tests/`는 이 작업의 범위가 아니다.
4. **사용자 미승인 거대 commit 금지** — Task 단위로 commit을 분리. 9개 Task를 1 commit으로 합치지 않는다.
5. **git history rewrite 금지** — `git rebase -i`, `git reset --hard`, `git push --force` 금지. 모든 변경은 새 commit으로.
6. **`/start-task` 절차 변경 금지** — TDD 강제, 의존성 체크 순서는 유지. lazy 로드 명시만 추가.
7. **새 결정(D{N}) 생성 금지** — 이 작업 중 새 결정이 필요하다고 판단되면 작업을 멈추고 사용자에게 보고.
8. **hook 동작을 우회·비활성화하지 말 것** — design-guard.sh는 작업 도중에도 활성. 변경 중 hook이 너 자신을 차단하면 그건 hook이 옳은 것.

---

## §7. 작업 보고 형식

각 Task 완료 시 다음 형식으로 사용자에게 보고:

```markdown
## Task {N} — {제목} 완료

### 변경된 파일
- {경로}: {줄 수 변화 (예: 192 → 85)}
- ...

### 검증 결과
- {검증 명령}: {결과}
- ...

### 다음 Task 진행 여부
[ ] Task {N+1}로 자동 진행
[x] 사용자 검토 후 진행

### 발견 사항 (있을 시)
- {예상 못 한 상황, 결정 필요 항목}
```

P0 완료 시(Task 1~4) 추가로 다음 매트릭스를 재측정해 보고:

| 결정 | 작업 전 명시 파일 수 | 작업 후 |
|---|---|---|
| D13 KST | 10 | ? |
| D7 폰트 | 8 | ? |
| D4 그라데 | 4 | ? |
| ... | ... | ... |

---

## §8. 참고 자료 (이 작업의 배경 이론)

이 작업이 따르는 원칙들의 출처:

- **하네스 엔지니어링 (Mitchell Hashimoto, 2026-02)**: "에이전트가 실수를 저지를 때마다 환경 자체를 엔지니어링해 같은 실수를 구조적으로 불가능하게 만든다."
- **Agent = Model + Harness (Birgitta Böckeler, martinfowler.com)**: guides + sensors 분류. 현재 된다 앱은 guides가 여러 곳에 흩어져 있어 SSoT 원칙 위반.
- **VILA Lab의 Claude Code 분석**: 1.6% AI / 98.4% 결정론적 인프라. 된다 앱의 design-guard.sh는 정확히 이 98.4% 인프라에 해당. 보존·강화.
- **Code with Claude 2026 (Mario Rodriguez, GitHub)**: 94% 캐시 적중률 목표. 컨텍스트 부담 감소가 캐시 효율과 직결.

작업 수행 AI는 위 원칙들을 이해하고 적용한다. 단순 mechanical refactor가 아니라, "왜 이렇게 바꾸는가"를 인지하고 작업 중 더 나은 대안이 보이면 사용자에게 제안한다.

---

**문서 작성**: 2026-05-22 (선행 분석 + 작업 지시)
**예상 작업 시간**: P0 약 2~3시간 · P1 약 1~2시간 · P2 약 1시간 (총 4~6시간)
**최종 검토**: 사용자 (이 문서를 받은 사람이 작업 결과를 git diff로 검토하고 최종 승인)
