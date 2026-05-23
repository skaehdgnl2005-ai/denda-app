# 된다 앱 하네스 SSoT 누락 보강 작업 지시서 (v2 후속)

> **수신**: 작업을 수행할 AI 에이전트 (Claude Code 등)
> **발신**: 하네스 검증 AI (SSoT 격상 후속 검증 완료)
> **선행 작업**: `HARNESS_REFACTOR_SPEC.md` (이미 적용됨 — git log에서 확인 가능)
> **목표**: 선행 작업 검증에서 발견된 **2가지 broken link**를 해소
> **작업 유형**: 하네스 무결성 복구 (앱 코드 변경 아님)
> **검증 일자**: 2026-05-22

---

## §0. 작업 전 필수 확인 — 컨텍스트 로딩

### 0.1. 너는 무엇을 하고 있는가
선행 작업(`HARNESS_REFACTOR_SPEC.md`)이 적용된 후 객관적 검증에서 두 가지 **무결성 손상**이 발견되었다. 이 문서는 그 두 가지만 해소한다.

**손상 1 — Broken Link (knowledge loss)**:
`.claude/rules/*.md`가 결정 본문을 제거하면서 "결정 본문 · 코드 예제: [DECISIONS.md#d11](...)" 형태로 참조 링크를 만들었다. 그러나:
- `docs/DECISIONS.md`에 **코드 블록이 0개**다 (`grep -c '\`\`\`ts\|\`\`\`sql' docs/DECISIONS.md` = 0)
- `docs/TEST_PLAN.md`에 **§3.1~§3.4 절이 존재하지 않는다** (`rules/testing.md`가 가리키는 anchor)

즉 rules에서 코드 예제를 빼면서 옮길 곳을 만들지 않아, 예제가 **실질적으로 소실**된 상태다. 에이전트가 결정 ID를 봐도 "어떻게 구현하라는 거지?"가 안 보이므로 환각으로 메워 넣을 위험이 있다.

**손상 2 — 책임 이관 단절**:
`.claude/agents/reviewer.md`가 12개 검토 영역을 Critical 4개로 축소하면서, 다음 라우팅 표를 만들었다:

> | Phase 3 코드 누출 | `design-guard.sh` hook (grep `토스페이먼츠\|reservations`) |

그러나 `.claude/hooks/design-guard.sh`에는 그 grep 패턴이 **추가되지 않았다**. 즉 reviewer가 "내가 안 보고 hook이 본다"고 선언했는데 hook은 그 약속을 모른다. **결과**: Phase 3 코드(토스페이먼츠 import, `reservations`/`payments`/`payouts` 테이블 참조, F6/F7 push 등)가 실수로 작성되어도 어디서도 안 잡힌다. CLAUDE.md 절대 규칙 #6이 선언적으로만 존재하는 상태다.

### 0.2. 어떤 원칙을 따르는가
선행 작업과 동일한 4개 원칙. 이번 작업은 그 원칙의 **유실된 절반을 복구**한다:

1. **Minimal scaffolding, maximal harness** — 선행 작업에서 scaffolding은 줄였지만 harness(코드 예제와 hook 강제)가 비어버린 곳을 채운다.
2. **Single Source of Truth** — DECISIONS.md를 진실의 위치로 격상했으니, 거기에 **실제 진실(코드 예제)이 들어 있어야** 한다.
3. **선언적 정책 → 결정적 강제 (Hashimoto 원칙)** — reviewer가 사람의 검토에 맡긴 "Phase 3 누출"을 hook의 결정적 grep으로 격상한다.
4. **링크 무결성** — 작성된 모든 anchor(`#d11`, `§3.1`)는 실제로 존재해야 한다.

### 0.3. 절대 변경 금지 항목 (HARD DENY)
선행 작업과 동일. 특히 이번 작업에서는 다음 추가 주의:

- **결정 본문 자체 변경 금지**: D1~D26, G1·G2의 `결정` / `근거` / `대안` / `소유자` / `결정일` / `의존` / `결과 영향` / `출처` 표 본문은 한 글자도 바꾸지 않는다. **이번 작업은 각 결정 절 안에 "구현 예제" 서브섹션을 추가**하는 것뿐이다.
- **새 결정(D27~) 생성 금지**: 코드 예제 추가는 새 결정이 아니다. D{N} 본문 내부에 절을 추가하는 것.
- **archive 변경 금지**.
- **앱 코드(`src/`, `supabase/functions/` 등) 변경 금지**: 이 작업은 `docs/`와 `.claude/hooks/`만 건드린다.
- **rules/*.md 추가 변경 금지**: 선행 작업으로 정리된 상태를 유지. 이번 작업은 rules가 가리키는 **참조 대상**만 채운다.
- **CLAUDE.md, PROJECT_CONTEXT.md 변경 금지**: 정책·컨텍스트 계층은 안정 상태.

### 0.4. 작업 전 체크리스트
- [ ] `git status` — 깨끗한 상태인가
- [ ] 새 브랜치: `git checkout -b refactor/harness-ssot-followup`
- [ ] `git log --oneline -5` — 선행 작업 commit이 있는지 확인 (보통 `refactor(harness): ...` 메시지로 시작)
- [ ] `docs/DECISIONS.md` 헤더 SSoT 선언이 들어가 있는지 확인 (3~11번 줄 부근)

### 0.5. 받는 AI에게 — 코드 원본 어디서 구하나
이 문서에 V1 원본 코드 예제가 **그대로 포함되어 있다**. git history에서 추출할 필요 없이 이 문서만 보고 작업 가능하다.

만약 추가 디테일이 필요하면 `git show HEAD~N:.claude/rules/supabase.md` 같은 방식으로 선행 작업 직전의 rules 파일을 볼 수 있다. 다만 우선 이 문서의 코드를 사용한다.

---

## §1. 작업 범위 및 의존성

```
Task A: DECISIONS.md 8개 결정에 "구현 예제" 절 추가 (독립)
└── A.1 D11 Realtime aggregation
└── A.2 D12 60fps worklet
└── A.3 D13 KST luxon + Edge
└── A.4 D14 15분 슬롯 CHECK
└── A.5 D16 차단 helper
└── A.6 D17 F4 idempotency
└── A.7 D20 Calendar fan-out
└── A.8 D25 Cold start lazy imports

Task B: TEST_PLAN.md §3.1~§3.4 절 추가 (독립)
└── B.1 §3.1 Jest + RN testing-library
└── B.2 §3.2 Maestro E2E
└── B.3 §3.3 Deno test (Supabase Edge)
└── B.4 §3.4 OCR ground truth 구조

Task C: design-guard.sh Phase 3 누출 grep 추가 (독립)
```

세 Task는 서로 독립이다. 동시 진행 가능. 권장 순서는 A → B → C이지만 어느 순서든 무방.

**Commit 분리 원칙**: Task A, B, C를 각각 별도 commit으로. 한 번에 합치면 diff가 너무 커서 사용자 검토가 어렵다.

---

## §2. Task A — DECISIONS.md에 구현 예제 보강

### 2.0. 공통 패턴

각 결정(D{N})은 현재 다음 구조를 가진다:

```markdown
## D{N} — {제목}

| 항목 | 내용 |
|---|---|
| 결정 | ... |
| 근거 | ... |
| 대안 | ... |
| 소유자 | ... |
| 결정일 | ... |
| 의존 | ... |
| 결과 영향 | ... |
| 출처 | ... |

---
```

**모든 Task A 항목의 작업 방법은 동일**: 위 표 바로 아래(`---` 구분선 직전)에 "### 구현 예제" 서브섹션을 추가한다. 표 본문은 한 글자도 바꾸지 않는다.

삽입 위치 예시:
```markdown
## D11 — Realtime 히트맵 = ...

| 항목 | 내용 |
|---|---|
| 결정 | ... |
... (표 그대로)
| 출처 | ENG_REVIEW §1.3 |

### 구현 예제  ← 여기 새로 추가

{이 절에 코드 블록 삽입}

---  ← 기존 구분선
```

### 2.1. D11 — Realtime 히트맵 구현 예제

`docs/DECISIONS.md`의 `## D11 — Realtime 히트맵 = Edge Function 합산 후 broadcast (옵션 B)` 절 끝에 다음 추가:

````markdown
### 구현 예제

**Edge Function (합산 + broadcast)**:

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

**클라이언트 (broadcast만 listen)**:

```ts
// src/lib/supabase/realtime.ts
supabase.channel(`group:${groupId}`)
  .on('broadcast', { event: 'heatmap_update' }, ({ payload }) => {
    heatmapSharedValue.value = payload.slots; // useSharedValue (D12)
  })
  .subscribe();
```

**금지 패턴**: 클라이언트가 `votes` 테이블에서 raw row를 받아 직접 합산. 7명 × 60슬롯 × 7일 = 2,940 rows를 매번 transfer + 합산하면 60fps 무너짐 + 배터리 손실.
````

### 2.2. D12 — 60fps 시간 그리드 구현 예제

`## D12 — 60fps 시간 그리드 구현 spec` 절 끝에 추가:

````markdown
### 구현 예제

**❌ 금지 패턴 (JS thread 폭파)**:

```tsx
const [cells, setCells] = useState<Record<string, boolean>>({});
const onCellTouch = (id: string) =>
  setCells(prev => ({ ...prev, [id]: true }));
// 매 cell touch → setState → 전체 grid re-render → 16ms 예산 초과
```

**✅ 의무 패턴 (UI thread worklet)**:

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

const cellState = useSharedValue<Record<string, boolean>>({});

const gesture = Gesture.Pan()
  .onUpdate((e) => {
    'worklet'; // UI thread, JS 영향 0
    const id = computeCellId(e.x, e.y);
    cellState.value = { ...cellState.value, [id]: true };
  })
  .onEnd(() => {
    'worklet';
    // drag 종료 시 1회만 JS로 commit (100ms debounce)
    runOnJS(commitVotes)(cellState.value);
  });
```

**가상화 (420 cells)**:

```tsx
import { FlashList } from '@shopify/flash-list';
// 또는 React.memo로 셀별 memoization
```
````

### 2.3. D13 — KST luxon + Edge Function 패턴

`## D13 — KST 강제, DB는 TIMESTAMPTZ (UTC)` 절 끝에 추가:

````markdown
### 구현 예제

**❌ 금지 (timezone 미명시)**:

```ts
const now = new Date();
const formatted = now.toLocaleString(); // 기기 로케일에 의존 — 해외 사용자에게 KST 아님
```

**✅ 클라이언트 (luxon)**:

```ts
import { DateTime } from 'luxon';

const now = DateTime.now().setZone('Asia/Seoul');
const formatted = now.toFormat('yyyy-MM-dd HH:mm', { locale: 'ko-KR' });

// 시간 그리드 슬롯 (15분 단위, D14)
const slot = DateTime.fromObject(
  { year: 2026, month: 5, day: 22, hour: 19, minute: 30 },
  { zone: 'Asia/Seoul' }
);
```

**✅ Edge Function (Deno)**:

```ts
// supabase/functions/_lib/kst.ts
export function nowKstISO(): string {
  return new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
}

// 또는 luxon Deno port
import { DateTime } from 'https://esm.sh/luxon@3.4.4';
const kst = DateTime.now().setZone('Asia/Seoul');
```

**DB schema (필수)**:

```sql
-- 모든 시간 column은 TIMESTAMPTZ (UTC 정규화 저장)
ALTER TABLE groups ADD COLUMN confirmed_at TIMESTAMPTZ;
-- TIMESTAMP (without time zone) 사용 금지
```

해외 사용자도 모든 시간 KST로 표시 + 작은 라벨 `"KST 기준으로 표시 중"` 의무.
````

### 2.4. D14 — 15분 슬롯 CHECK constraint

`## D14 — 시간 슬롯 단위 강제: 15분 + DB CHECK constraint` 절 끝에 추가:

````markdown
### 구현 예제

**DB constraint (필수)**:

```sql
-- supabase/migrations/0003_slot_constraint.sql
ALTER TABLE votes ADD CONSTRAINT slot_15min
  CHECK (start_minute % 15 = 0);

-- start_minute은 09:00=540, 09:15=555, ..., 23:45=1425
-- 화면 09:00~24:00 (60 슬롯/일 × 7일 = 420 cells)
```

**Application constant (server + client 공유)**:

```ts
// src/lib/constants.ts (+ supabase/functions/_lib/constants.ts에 동일하게)
export const SLOT_DURATION_MINUTES = 15;
export const SLOTS_PER_DAY = 60;     // 09:00~24:00
export const DAYS_PER_GROUP = 7;
export const CELLS_PER_GROUP = SLOTS_PER_DAY * DAYS_PER_GROUP; // 420
```

**금지**: 30분·60분 슬롯 데이터가 votes에 들어가면 UI grid가 깨진다. CHECK constraint가 INSERT 시점에 거부.
````

### 2.5. D16 — 차단 helper

`## D16 — 차단·신고 일관성: Helper function + RLS` 절 끝에 추가:

````markdown
### 구현 예제

**Helper function**:

```sql
-- supabase/migrations/_lib/blocking.sql
CREATE OR REPLACE FUNCTION is_blocked(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM blocks
    WHERE (blocker_id = viewer_id AND blocked_id = target_id)
       OR (blocker_id = target_id AND blocked_id = viewer_id)
  );
$$ LANGUAGE sql STABLE;
```

**RLS policy 패턴 (모든 SELECT에 적용)**:

```sql
-- friendships
CREATE POLICY "friends_no_blocked" ON friendships
  FOR SELECT USING (NOT is_blocked(auth.uid(), friend_id));

-- group_members
CREATE POLICY "members_no_blocked" ON group_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR NOT is_blocked(auth.uid(), user_id)
  );

-- 친구 검색·추천·모임 멤버·초대 모든 query에 동일 패턴
```

**적용 대상**: 친구 검색, 친구 추천, 모임 멤버 목록, 모임 초대 가능 친구 목록, schedules 공유 목록.
````

### 2.6. D17 — F4 push idempotency

`## D17 — Push F4 idempotency: \`groups.f4_sent_at\` column` 절 끝에 추가:

````markdown
### 구현 예제

**Edge Function (트랜잭션 내 조건부 UPDATE)**:

```ts
// supabase/functions/notify_f4/index.ts
const { data, error } = await supabase
  .from('groups')
  .update({ f4_sent_at: new Date().toISOString() })
  .eq('id', groupId)
  .is('f4_sent_at', null)  // 이미 발송됐으면 0 rows 반환
  .select()
  .single();

if (!data) {
  console.log(`F4 already sent for group ${groupId}, skip`);
  return new Response(null, { status: 204 });
}

// 0 rows 반환되지 않은 경우에만 push 발송 진행
await sendExpoPush({
  to: tokens,
  title: '전 멤버가 투표를 끝냈어요',
  body: `${groupName} — 호스트가 시간을 확정해주세요`,
});
```

**DB schema**:

```sql
ALTER TABLE groups ADD COLUMN f4_sent_at TIMESTAMPTZ;
-- NULL = 미발송, NOT NULL = 발송 완료
```

**Race condition 방지**: 두 멤버가 거의 동시에 마지막 vote를 INSERT해도, UPDATE의 `IS NULL` 조건이 단 1회만 매칭되어 idempotent.
````

### 2.7. D20 — Calendar push fan-out background queue

`## D20 — Calendar push fan-out = background queue` 절 끝에 추가:

````markdown
### 구현 예제

**호스트 액션 (즉시 응답)**:

```ts
// supabase/functions/group_confirm/index.ts
await supabase
  .from('groups')
  .update({ confirmed_at: new Date().toISOString() })
  .eq('id', groupId);

// 호스트에게 즉시 200 응답
return new Response(JSON.stringify({ ok: true }), { status: 200 });
// Calendar push는 pg_cron이 백그라운드로 처리 (아래)
```

**pg_cron queue 처리**:

```sql
-- supabase/migrations/0010_calendar_queue.sql
SELECT cron.schedule(
  'process_calendar_queue',
  '*/1 * * * *',  -- 1분마다
  $$ SELECT net.http_post(
    url := 'https://{project}.supabase.co/functions/v1/calendar_push_worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  ); $$
);
```

**Worker (retry max 3)**:

```ts
// supabase/functions/calendar_push_worker/index.ts
const { data: pending } = await supabase
  .from('groups')
  .select('id, member_ids, retry_count')
  .not('confirmed_at', 'is', null)
  .is('calendar_pushed_at', null)
  .lt('retry_count', 3)
  .limit(50);

for (const group of pending) {
  const failedMembers: string[] = [];
  for (const memberId of group.member_ids) {
    try {
      await pushToMemberCalendar(memberId, group);
    } catch (e) {
      failedMembers.push(memberId);
    }
  }

  if (failedMembers.length === 0) {
    await supabase.from('groups').update({
      calendar_pushed_at: new Date().toISOString(),
    }).eq('id', group.id);
  } else {
    await supabase.from('groups').update({
      retry_count: group.retry_count + 1,
      partial_fail_list: failedMembers,
    }).eq('id', group.id);
  }
}
```

**Partial fail 처리**: `groups.partial_fail_list` JSON column에 실패 멤버 list 기록. 3회 retry 후 호스트에게 알림 (D19 단방향 부분 실패).
````

### 2.8. D25 — Cold start lazy imports

`## D25 — Cold start target: < 2초 + lazy loading` 절 끝에 추가:

````markdown
### 구현 예제

**Always load (앱 startup)**:

```ts
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { create as createStore } from 'zustand';
import * as SecureStore from 'expo-secure-store';
// 위 5개는 즉시 로드 — cold start 핵심 path
```

**Lazy load (route 진입 시)**:

```tsx
// src/app/(tabs)/map.tsx
import { lazy, Suspense } from 'react';
const MapScreen = lazy(() => import('@/screens/MapScreen'));
// @mj-studio/react-native-naver-map는 MapScreen 내부에서 import

export default function MapTab() {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <MapScreen />
    </Suspense>
  );
}
```

**나머지 lazy 대상**:

```ts
// 모임 확정 + Calendar push 시점
const CalendarSync = lazy(() => import('@/lib/calendar/sync'));

// OCR 진입
const OCRScreen = lazy(() => import('@/screens/OCRScreen'));
// Gemini Vision SDK는 OCRScreen 내부에서 동적 import

// 첫 진입 attribution check (단 SDK init은 startup)
const BranchAttribution = lazy(() => import('@/lib/branch/attribution'));

// 🔒 Phase 3 — 현재 import하지 않음
// const TossPayment = lazy(() => import('@tosspayments/widget-sdk'));
```

**측정**: production binary로 cold start 측정 의무 (Hermes profile + Flipper). dev mode 측정 금지.
````

### Task A 검증

```bash
# 1. DECISIONS.md에 코드 블록이 들어갔는지
grep -c '```ts\|```sql\|```tsx\|```yaml' docs/DECISIONS.md
# 결과 ≥ 18 (각 결정마다 1~3개)

# 2. broken link 해소 — rules의 모든 [DECISIONS.md#d{N}] 링크가 실제 anchor를 가리키는지
for anchor in d11 d12 d13 d14 d16 d17 d20 d25; do
  if grep -qE "^## D${anchor:1} " docs/DECISIONS.md; then
    echo "✓ #$anchor exists"
  else
    echo "✗ #$anchor MISSING"
  fi
done

# 3. 결정 본문 표는 그대로인지 (`| 결정 |`, `| 근거 |` 등 표 항목이 그대로)
grep -c "^| 결정 |" docs/DECISIONS.md  # 변화 없어야 함 (선행 작업과 동일 수)
```

**Commit 메시지**:
```
docs(decisions): D11/D12/D13/D14/D16/D17/D20/D25 구현 예제 보강

- rules에서 빼낸 코드 예제를 결정 본문 절에 복원
- 결정 표 본문은 그대로, "### 구현 예제" 서브섹션만 추가
- broken link 해소: rules/*.md의 모든 [DECISIONS.md#d{N}] 참조 무결성 복구

Closes: SSoT 누락 보강 Task A
```

---

## §3. Task B — TEST_PLAN.md §3.1~§3.4 절 추가

### 3.0. 사전 확인

`docs/TEST_PLAN.md`의 현재 절 구조를 먼저 본다:
```bash
grep -E "^##? " docs/TEST_PLAN.md
```

§3에 해당하는 절이 어떤 제목인지 확인. 없으면 새로 만들고, 있으면 그 절 안에 §3.1~§3.4를 만든다.

만약 §3가 이미 다른 용도(예: "테스트 카테고리")로 쓰이고 있다면, **§3.x로 번호 충돌**이 발생하므로 다음 중 택일:
- (a) 기존 §3을 §4로 밀고 새 §3 "Framework별 예제" 생성
- (b) 새 절을 §6 "Framework별 예제"로 만들고 `rules/testing.md`의 링크를 §3.x → §6.x로 수정

**권장**: (b) 가 안전하다 (기존 절 번호 변경 금지). 단 이 경우 rules/testing.md의 §3.1~§3.4 참조를 §6.1~§6.4로 수정하는 작업이 추가된다.

작업 받는 AI는 이 결정을 사용자에게 묻거나, 가장 비파괴적인 방향(b)로 진행.

### 3.1. 만약 §3가 비어 있거나 (a) 방안인 경우

`docs/TEST_PLAN.md`에 다음 절 추가:

````markdown
## §3. Framework별 예제

이 절의 예제들은 `.claude/rules/testing.md`가 참조한다. 코드 예제의 SSoT 위치.

### §3.1. Jest + RN testing-library

Unit / Integration 테스트의 기본 패턴.

```tsx
// src/components/TimeGrid/TimeGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TimeGrid } from '@/components/TimeGrid';
import { tokens } from '@/design/tokens';

describe('TimeGrid', () => {
  it('drag sweeps multi-select cells (D12)', async () => {
    render(<TimeGrid groupId="test-group" />);
    const cell0 = screen.getByTestId('cell-09-00');

    // Reanimated worklet은 unit test에서 mock 필요
    fireEvent(cell0, 'gestureStart');
    fireEvent(cell0, 'gestureUpdate', { x: 0, y: 100 }); // sweep down
    fireEvent(cell0, 'gestureEnd');

    // 본인 슬롯 = brand-50 + 보더 (DESIGN §10.1)
    expect(cell0).toHaveStyle({ backgroundColor: tokens.light.brand[50] });
  });

  it('cell touch is idempotent on double tap', async () => {
    render(<TimeGrid groupId="test-group" />);
    const cell = screen.getByTestId('cell-19-30');
    fireEvent.press(cell);
    fireEvent.press(cell);
    // 같은 슬롯 vote insert는 1회만 (D14 + idempotency)
    expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);
  });
});
```

**Reanimated worklet mock**: `jest-setup.ts`에 `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` 필수.

### §3.2. Maestro E2E (모바일)

User flow 단위 E2E. iOS·Android 양쪽.

```yaml
# maestro/host_create_group.yaml
appId: com.denda.app
---
- launchApp
- tapOn: "(+)"  # FAB
- inputText:
    id: "group-name-input"
    text: "팀플 모임"
- tapOn: "다음"

# 시간 그리드 드래그 sweep
- tapOn:
    id: "cell-2026-05-22-1900"  # KST
- swipe:
    from: { id: "cell-2026-05-22-1900" }
    to: { id: "cell-2026-05-22-2030" }

# 선택 확인
- assertVisible:
    id: "selected-count"
    text: "6 슬롯 선택"

# 모임 확정 (호스트 액션)
- tapOn: "모임 확정"
- assertVisible:
    id: "confirmed-banner"
    text: "확정됨"
```

**Critical paths (Gate 측정에 직접 영향)**:
1. `host_create_group.yaml` — 모임 생성 funnel
2. `member_vote.yaml` — 멤버 투표 (히트맵 60fps)
3. `place_select_click_through.yaml` — Gate #2 측정 ("예약하기" click)
4. `kakao_oauth.yaml` — D21 synthetic email + HMAC flow

### §3.3. Deno test (Supabase Edge Function)

Edge Function unit test는 Supabase 공식 Deno test로.

```ts
// supabase/functions/votes_aggregate/test.ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { aggregate } from "./aggregate.ts";

Deno.test("votes aggregate sums per slot (D11)", () => {
  const votes = [
    { user_id: 'a', start_minute: 540 },  // 09:00
    { user_id: 'b', start_minute: 540 },
    { user_id: 'c', start_minute: 555 },  // 09:15
  ];
  const result = aggregate(votes);
  assertEquals(result.find(s => s.minute === 540)?.count, 2);
  assertEquals(result.find(s => s.minute === 555)?.count, 1);
});

Deno.test("F4 push idempotent (D17)", async () => {
  // 1st call: f4_sent_at IS NULL → UPDATE 성공 → push 발송
  const r1 = await callF4Function('test-group-id');
  assertEquals(r1.pushed, true);

  // 2nd call: f4_sent_at NOT NULL → UPDATE 0 rows → no-op
  const r2 = await callF4Function('test-group-id');
  assertEquals(r2.pushed, false);
});
```

**실행**:
```bash
supabase functions test
# 또는 specific:
deno test supabase/functions/votes_aggregate/test.ts
```

**금지**: DB mock. Supabase LOCAL test instance 사용 (`supabase start` → `supabase functions test`).

### §3.4. OCR ground truth 구조 (Gemini Vision)

에브리타임 OCR 정확도 측정.

**디렉토리 구조**:
```
tests/ocr/
├── ground_truth/
│   ├── case_01.png                  # 에브리타임 스크린샷
│   ├── case_01.expected.json        # 기대 결과
│   ├── case_02.png
│   ├── case_02.expected.json
│   └── ... (~20장)
└── ocr_eval.test.ts                 # Jest로 실행
```

**Expected JSON 형식**:
```json
{
  "courses": [
    {
      "name": "선형대수",
      "day": "MON",
      "start": "10:00",
      "end": "11:30",
      "room": "공학관 401"
    },
    {
      "name": "프로그래밍 입문",
      "day": "WED",
      "start": "13:00",
      "end": "14:30",
      "room": "정보관 205"
    }
  ]
}
```

**Eval 기준**: 정확도 ≥ 90% (course별 name·day·start·end·room 5개 필드 매치).

```ts
// tests/ocr/ocr_eval.test.ts
import { parseEverytimeOCR } from '@/lib/ocr/everytime';
import { readFileSync, readdirSync } from 'fs';

describe('Gemini Vision OCR accuracy', () => {
  const cases = readdirSync('tests/ocr/ground_truth')
    .filter(f => f.endsWith('.png'))
    .map(f => f.replace('.png', ''));

  cases.forEach(name => {
    it(`${name} matches expected`, async () => {
      const image = readFileSync(`tests/ocr/ground_truth/${name}.png`);
      const expected = JSON.parse(
        readFileSync(`tests/ocr/ground_truth/${name}.expected.json`, 'utf-8')
      );
      const actual = await parseEverytimeOCR(image);
      expect(diffAccuracy(actual, expected)).toBeGreaterThanOrEqual(0.9);
    });
  });
});
```
````

### 3.2. 만약 (b) 방안 — §6으로 추가하는 경우

위 내용을 `## §3.` 대신 `## §6. Framework별 예제`로 만들고, 각 서브절도 `### §6.1` ~ `### §6.4`로.

그리고 `.claude/rules/testing.md`의 §3.1~§3.4 참조를 §6.1~§6.4로 수정:

```bash
sed -i 's|TEST_PLAN\.md §3\.\([1-4]\)|TEST_PLAN.md §6.\1|g' .claude/rules/testing.md
```

(macOS의 경우 `sed -i ''` 사용)

### Task B 검증

```bash
# 1. §3.1~§3.4 (또는 §6.1~§6.4) 절이 실제로 만들어졌는지
grep -E "^### §[36]\.[1-4]" docs/TEST_PLAN.md
# 4줄 나와야 함

# 2. rules/testing.md의 anchor가 실제 절을 가리키는지
grep -oE "TEST_PLAN\.md §[0-9]+\.[0-9]+" .claude/rules/testing.md | sort -u
# 출력된 각 §X.Y가 TEST_PLAN.md에 실제 절로 존재해야 함

# 3. 코드 블록 수
grep -c '```' docs/TEST_PLAN.md
# 작업 전보다 최소 8개 증가 (4 framework × 평균 2 블록)
```

**Commit 메시지**:
```
docs(test): TEST_PLAN.md에 Framework별 예제 절 추가 (§3.1~§3.4)

- Jest + RN testing-library / Maestro E2E / Deno test / OCR ground truth
- rules/testing.md가 가리키던 broken link 해소
- 코드 예제의 SSoT 위치 명시

Closes: SSoT 누락 보강 Task B
```

---

## §4. Task C — design-guard.sh Phase 3 누출 grep 추가

### 4.1. 작업 위치

`.claude/hooks/design-guard.sh`의 기존 `# --- Non-Korean UI labels (Phase 1+2 한국어 only) ---` 절 **바로 위**에 새 절을 추가한다. 즉 121번 줄 부근(`case "$FILE_PATH"` 시작 직전).

### 4.2. 추가할 grep 패턴

```bash
# --- Phase 3 코드 누출 검출 (PROJECT_CONTEXT.md §6 절대 금지) ---
# Gate #2 ≥25% 통과 전까지 다음 패턴은 모두 차단.
# reviewer.md가 이 책임을 hook으로 이관함.
case "$FILE_PATH" in
  *.test.*|*.spec.*|*tests/*|*.md|*archive/*) ;;  # 테스트·문서·archive 제외
  *)
    # 1. 토스페이먼츠 SDK / 위젯 코드
    check '@tosspayments|tosspayments|TossPayments' \
      "🔒 Phase 3: 토스페이먼츠 SDK import 금지 (PROJECT_CONTEXT §6). Gate #2 ≥25% 후 commit."

    # 2. 금지 테이블 schema 참조 (D3 — Phase 3 schema lock-in 회피)
    check '(from|join|insert into|update|select.*from)[[:space:]]+(reservations|payments|payouts)[^a-zA-Z_]' \
      "🔒 Phase 3: reservations/payments/payouts 테이블 참조 금지 (D3). Phase 1+2은 partnerships만."

    # 3. groups.reservation_id column (Phase 3에서 추가)
    check 'groups\.reservation_id|reservation_id[[:space:]]*:' \
      "🔒 Phase 3: groups.reservation_id column은 Phase 3에서 추가 (D3)."

    # 4. F6/F7 push 알림 (Phase 1+2은 F1~F5만)
    check 'notify_f6|notify_f7|F6_|F7_|"f6"|"f7"|'\''f6'\''|'\''f7'\''' \
      "🔒 Phase 3: F6/F7 푸시 알림 금지 (Phase 1+2은 F1~F5)."

    # 5. 캐치테이블 직결 (D2 폐기)
    check 'catchtable|캐치테이블' \
      "🔒 폐기 결정 (D2): 캐치테이블 직결 금지."
  ;;
esac
```

### 4.3. 보수적으로 추가 검토 — 의도적 미포함 항목

다음은 false positive 위험이 높아 **이번 작업에서는 hook에 추가하지 않는다**. 사용자가 명시 요청하면 추가:

- **`memories` / `추억`**: 일반적인 변수명·코멘트에 자주 등장. 좁은 패턴(`MemoriesScreen`, `<Memories ` 등)으로 좁히려면 컴포넌트 명명 규칙 합의 필요. 일단 reviewer가 잡도록 둔다.
- **`payment` (단수)**: `partnerships`의 일부, `paymentMethod` 같은 향후 변수에 충돌. 이번엔 복수형 테이블명(`payments`)만 잡는다.
- **`refund` / `환불`**: Phase 1+2의 정책 안내 문구(`"환불 정책은..."`)에도 등장 가능. UI 문자열은 잡지 말 것.

### 4.4. PROJECT_CONTEXT.md 보강 (선택)

PROJECT_CONTEXT.md §6 절대 금지 목록의 끝에 1줄 추가:

```markdown
위반 시 → 사용자 즉시 확인. PROGRESS.md Gate KPI 진척 없으면 작성 보류.
**자동 차단**: `.claude/hooks/design-guard.sh`가 토스페이먼츠·reservations·F6/F7·캐치테이블 import/참조를 grep으로 차단 (exit 2).
```

선언적 정책 → 결정적 강제 연결을 명시. (선택사항 — 사용자에게 물어보고 진행)

### Task C 검증

#### 4.4.1. Syntax check

```bash
bash -n .claude/hooks/design-guard.sh && echo "Syntax OK"
```

#### 4.4.2. 차단 동작 시나리오

다음 5개 시나리오를 실제 실행해 모두 exit 2를 받는지 확인:

```bash
mkdir -p /tmp/phase3-test

# 시나리오 1: 토스페이먼츠 SDK import
cat > /tmp/phase3-test/payment.ts <<'EOF'
import { loadTossPayments } from '@tosspayments/payment-sdk';
const tossPayments = await loadTossPayments(clientKey);
EOF
echo '{"tool_input":{"file_path":"/tmp/phase3-test/payment.ts"}}' | bash .claude/hooks/design-guard.sh
[ $? -eq 2 ] && echo "✓ 시나리오 1 차단됨" || echo "✗ 시나리오 1 차단 실패"

# 시나리오 2: reservations 테이블 query
cat > /tmp/phase3-test/reserve.ts <<'EOF'
const { data } = await supabase.from('reservations').select('*');
EOF
echo '{"tool_input":{"file_path":"/tmp/phase3-test/reserve.ts"}}' | bash .claude/hooks/design-guard.sh
[ $? -eq 2 ] && echo "✓ 시나리오 2 차단됨" || echo "✗ 시나리오 2 차단 실패"

# 시나리오 3: F6 push
cat > /tmp/phase3-test/push.ts <<'EOF'
import { notify_f6 } from './notifications';
notify_f6(userId);
EOF
echo '{"tool_input":{"file_path":"/tmp/phase3-test/push.ts"}}' | bash .claude/hooks/design-guard.sh
[ $? -eq 2 ] && echo "✓ 시나리오 3 차단됨" || echo "✗ 시나리오 3 차단 실패"

# 시나리오 4: groups.reservation_id
cat > /tmp/phase3-test/group.ts <<'EOF'
const id = group.reservation_id;
EOF
# 이건 잡혀야 하지만, 위 grep이 groups.reservation_id로 좁아서 안 잡힐 수 있음
# group.reservation_id (단수)도 잡으려면 패턴 보강 필요 — 사용자 의견 받기

# 시나리오 5: false positive 체크 - partnerships만 사용
cat > /tmp/phase3-test/partner.ts <<'EOF'
const { data } = await supabase.from('partnerships').select('*');
const paymentMethod = 'card';  // 변수명에 payment 포함
EOF
echo '{"tool_input":{"file_path":"/tmp/phase3-test/partner.ts"}}' | bash .claude/hooks/design-guard.sh
[ $? -eq 0 ] && echo "✓ 시나리오 5 통과 (false positive 없음)" || echo "✗ 시나리오 5 오차단 발생"

# 정리
rm -rf /tmp/phase3-test
```

5개 모두 통과해야 작업 완료. 시나리오 4가 안 잡히면 사용자에게 패턴 보강 여부 의견 받기.

**Commit 메시지**:
```
feat(hook): design-guard.sh에 Phase 3 코드 누출 검출 추가

- 토스페이먼츠 SDK / reservations·payments·payouts 테이블 / F6/F7 push
- groups.reservation_id column / 캐치테이블 직결
- reviewer.md가 이관한 책임을 결정적 강제로 격상
- 5개 차단 시나리오 + 1개 false positive 시나리오 통과 확인

Closes: SSoT 누락 보강 Task C
```

---

## §5. 작업 완료 기준 (Definition of Done)

### 5.1. 정량 지표

| 지표 | 작업 전 (V2) | 목표 |
|---|---|---|
| DECISIONS.md 코드 블록 수 | 0 | ≥ 18 |
| TEST_PLAN.md §3.x(또는 §6.x) 절 수 | 0 | 4 (§3.1~§3.4 또는 §6.1~§6.4) |
| design-guard.sh의 "Phase 3" 또는 "토스" grep 줄 수 | 0 | ≥ 5 |
| design-guard.sh 줄 수 | 142 | ~165~180 (10~20% 증가) |

### 5.2. 정성 검증

- [ ] Task A: `.claude/rules/*.md`가 가리키는 모든 `[DECISIONS.md#d{N}]` anchor가 실제 절(`## D{N}`)에 도달하고, 그 절에 "### 구현 예제" 서브섹션이 존재
- [ ] Task A: D{N} 표 본문(`결정` / `근거` / `대안` 등)이 한 글자도 변경되지 않음 — `git diff docs/DECISIONS.md` 검토 시 표 row 변경 0
- [ ] Task B: `.claude/rules/testing.md`의 §3.1~§3.4 (또는 §6.1~§6.4) 링크가 실제 절을 가리킴
- [ ] Task C: 위 §4.4.2의 5개 차단 시나리오 모두 통과
- [ ] Task C: `bash -n .claude/hooks/design-guard.sh` syntax 통과

### 5.3. 기능 회귀 테스트

- [ ] 기존 hook 동작 보존: V1 위반 패턴(hex 직접, `new Date()`, 그라데이션 등)이 여전히 차단됨
- [ ] CLAUDE.md, PROJECT_CONTEXT.md, .claude/rules/ 파일들은 **변경 없음** (`git diff` 결과 비어 있음, 단 PROJECT_CONTEXT.md §6에 §4.4 보강 시 1줄 변경 허용)

### 5.4. 사용자에게 보고할 매트릭스

선행 작업에서 사용한 SSoT 매트릭스를 다시 측정:

```python
# 각 결정의 "본문" 또는 "참조"가 어디에 있는지
# Task A 후 기대: D{N}의 본문은 DECISIONS.md에만 존재 (구현 예제 포함)
```

표 형식:
| 결정 | DECISIONS.md (본문+예제) | rules/* (참조) | hook (grep) |
|---|---|---|---|
| D11 | ✓ (예제 추가됨) | supabase.md 참조 | — |
| D12 | ✓ (예제 추가됨) | react-native.md 참조 | — |
| D13 | ✓ (예제 추가됨) | ko-kr.md, supabase.md 참조 | new Date() 차단 |
| D14 | ✓ | supabase.md 참조 | — |
| D16 | ✓ | supabase.md 참조 | — |
| D17 | ✓ | supabase.md 참조 | — |
| D20 | ✓ | supabase.md 참조 | — |
| D25 | ✓ | react-native.md 참조 | — |
| Phase 3 금지 | PROJECT_CONTEXT §6 | reviewer.md 라우팅 | **NEW: 5개 패턴 차단** |

---

## §6. 절대 금지 사항 (Hard Deny)

1. **결정 표 본문 변경 금지** — D{N}의 `결정`/`근거`/`대안`/`소유자`/`결정일`/`의존`/`결과 영향`/`출처` 표는 한 글자도 바꾸지 않는다. 오직 표 아래 "### 구현 예제" 절만 추가.
2. **새 결정(D27~) 생성 금지** — 코드 예제는 새 결정이 아니다.
3. **archive 변경 금지**.
4. **앱 코드 변경 금지** — `src/`, `supabase/functions/` 등은 이 작업 범위 아님.
5. **rules/*.md 추가 변경 금지** — 선행 작업으로 안정된 상태 유지. 단 Task B의 (b) 방안 선택 시 `rules/testing.md`의 §3.x → §6.x anchor만 수정 가능.
6. **CLAUDE.md 변경 금지**.
7. **hook의 기존 패턴 삭제 금지** — Phase 3 grep은 **추가만**. 기존 D4·D5·D7·D13·D18·ko-KR 패턴은 그대로.
8. **false positive 위험이 큰 패턴 임의 추가 금지** — `memories`, `payment` 단수형 등은 사용자 명시 요청 시에만.
9. **Task A의 코드 예제 임의 수정 금지** — 이 문서에 명시된 코드를 그대로 사용. 더 좋은 패턴이 보이면 사용자에게 보고 후 결정.

---

## §7. 작업 보고 형식

각 Task 완료 시 다음 형식으로 보고:

```markdown
## Task {A/B/C} — {제목} 완료

### 변경된 파일
- docs/DECISIONS.md: {줄 수 변화, 코드 블록 수 변화}
- docs/TEST_PLAN.md: {동일}
- .claude/hooks/design-guard.sh: {동일}

### 검증 결과
- 코드 블록 수: {N} (목표 {M})
- 차단 시나리오 통과: {N}/5
- broken link 해소: {N}/{M} anchor 검증됨

### 사용자 결정 필요
- Task B: §3 vs §6 선택? (기본 권장: §6 — 비파괴적)
- Task C: PROJECT_CONTEXT.md §6 보강 진행? (1줄 추가)
- Task C: 시나리오 4 (group.reservation_id 단수) 패턴 보강?

### 발견 사항 (있을 시)
- ...
```

세 Task 모두 완료 후 매트릭스(§5.4) 재측정 결과 첨부.

---

## §8. 참고 — 자료조사 컨텍스트

이 작업이 따르는 원칙(선행 작업과 동일):

- **Hashimoto의 SSoT 원칙**: "에이전트가 실수를 저지를 때마다 환경 자체를 엔지니어링해 구조적으로 불가능하게 만든다." → Task C는 선언적 정책(절대 규칙 #6)을 결정적 강제(grep)로 격상.
- **Böckeler의 guides/sensors 분류**: Task A·B는 guides(피드포워드 가이드)의 구체성을 복구. Task C는 sensors(피드백 감지)를 추가.
- **VILA Lab의 1.6%/98.4%**: Task C는 결정론적 인프라(98.4%)에 패턴 추가. AI 의사결정(1.6%)이 환각으로 메우지 못하도록 함.
- **링크 무결성**: 모든 `[#anchor]` 링크가 실제 anchor를 가리켜야 한다는 일반 원칙. SSoT 격상이 의미를 가지려면 진실이 그 위치에 실제로 있어야 한다.

작업 받는 AI는 단순 mechanical 작업이 아니라, **"왜 이 grep 패턴이 필요한가" "왜 이 코드 예제가 SSoT에 있어야 하는가"**를 인지하고 작업한다. 더 나은 대안이 보이면 §7의 "사용자 결정 필요"로 보고.

---

**문서 작성**: 2026-05-22 (선행 작업 검증 후속)
**예상 작업 시간**: Task A 약 1시간 · Task B 약 30분 · Task C 약 45분 (총 2~3시간)
**최종 검토**: 사용자 (작업 결과의 git diff + 차단 시나리오 결과 검토)
