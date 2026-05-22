# Decisions Log

> **이 문서는 된다 앱 모든 결정의 진실의 단일 위치(SSoT)다.**
> D1~D28, G1·G2의 본문은 오직 여기에만 존재한다.
> 다른 파일(`CLAUDE.md`, `.claude/rules/*.md`, `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`, `docs/PROJECT_CONTEXT.md`)은 결정 ID(`D{N}`, `G{N}`)와 1줄 요약 + 이 문서의 해당 절 링크만 가질 수 있다.
>
> 본문(근거·대안·코드 예제 등)을 복제하는 행위는 금지한다.
> 만약 결정이 바뀌면 이 문서만 수정하고, 다른 파일은 참조 링크만 검증한다.
>
> 출처: ENG_REVIEW(D1~D3), DESIGN(§16), OFFICE_HOURS(게이트)
> 최신순으로 정렬.

---

## D1 — Kakao OAuth · Local API 정책 (Verify-track + Lazy backup)

| 항목 | 내용 |
|---|---|
| 결정 | Kakao OIDC native OAuth (Supabase `signInWithIdToken` — [D29](#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)) + Kakao Local API on Naver Maps를 baseline으로 진행하되, 동시에 backup 인터페이스를 추상화 |
| 근거 | 정책 위반 시 auth/지도 둘 다 무너짐 (CRITICAL). 1주 안에 Kakao 디벨로퍼스 서면 답변 확보 + 답변 없으면 즉시 eager fallback |
| 대안 | (a) eager fallback (Apple ID + Naver Search API)부터 시작 — 거부: backup이 핵심 UX 열화 (지도 카테고리 빈약) (b) 정책 답변 대기만 — 거부: 출시 timeline 위협 |
| 소유자 | Founder |
| 결정일 | 2026-05-21 |
| 마감 게이트 | **2026-05-28 (W1 deadline)** — Kakao 답변 미수신 시 즉시 Step 16 (backup providers) lane eager 활성 |
| 의존 | OPEN: Kakao 디벨로퍼스 1:1 문의 2건 답변 |
| 결과 영향 | S01 (Auth) baseline = D29 OIDC 표준 (Q-A1 closed). S10 (Map) baseline = Kakao Local API (Q-A2 답변 대기). Step 16은 lazy interface 추상화만. Apple 심사 시 Apple ID 추가는 Phase 3 |
| 출처 | ENG_REVIEW §1.2 |

---

## D2 — Phase 1+2 Scope Reduction (다크 디테일만 reduce)

| 항목 | 내용 |
|---|---|
| 결정 | (1) 다크모드 디테일 검증(마커·차트·맵 두 톤 일치) → Phase 3로 이연. 시스템 자동 ON만 유지. (2) 에브리타임 OCR → Phase 1+2 **유지**. (3) "지도로 내 일정 보기" → Phase 1+2 **유지** |
| 근거 | Eng review가 3건 reduce 권고했으나 OCR (P1 학생 마찰)·지도-일정 mode(P5 검증)는 founder가 가치 인정. 다크 디테일은 Gate #2 < 10% 시 재출시 회피용으로 deferred |
| 대안 | 3건 모두 reduce (5-13일 절약) — 거부: P1·P5 검증 손실. 3건 모두 유지 — 거부: 4주 timeline 압박 |
| 소유자 | Founder |
| 결정일 | 2026-05-21 |
| 의존 | — (확정) |
| 결과 영향 | Phase 1+2 timeline 4주 → 3.5주 (3-5일 절약). Step 14 (OCR), Step 15 (지도-일정 mode) Phase 1+2 critical path에 유지. 다크 토큰 두 세트는 정의만 (Step 12) |
| 출처 | ENG_REVIEW Step 0.2 + Decisions Resolved D2 |

---

## D3 — Phase 3 Schema 설계 시점 (옵션 B — partnerships only)

| 항목 | 내용 |
|---|---|
| 결정 | Phase 1+2은 `partnerships` table만 신규 추가. `reservations`/`payments`/`payouts`는 Phase 3 진입 시 설계 |
| 근거 | β-compact의 "5개 premise 동시 베팅 회피" 원칙. 미검증 Phase 3 도메인을 schema에 잠그면 reframe 자유도 ↓. Gate #2 < 10% 시 coordination-only pivot 시 매몰비용. Migration cost 작음 (3 tables ADD + groups에 1 column ADD) |
| 대안 | (옵션 A) 4 tables 모두 schema 정의 — 거부: Phase 3 spec lock-in, 수수료율 1500원 hard-code 위험 |
| 소유자 | Founder |
| 결정일 | 2026-05-21 |
| 의존 | — (확정) |
| 결과 영향 | S00 (backend foundation)에 partnerships만. groups.confirmed_place_id 유지. Phase 3 진입 시 마이그레이션 1회 추가 |
| 출처 | ENG_REVIEW §1.3 |

---

## G1 — Gate #1 (모임 확정 → 장소 확정 비율)

| 항목 | 내용 |
|---|---|
| 결정 | Phase 1+2 W2-W8 모니터링. ≥40% 강한 신호 / 20-39% 보류(UX 개선 + 2주 추가) / <20% 장소 기능 가설 무너짐 |
| 근거 | 한국 모임 문화에서 시간 확정 후 장소 결정의 자연스러운 funnel 가설 검증. baseline W0-W2 수집 후 W2에 final calibrate |
| 신뢰도 | 중 (한국 모임 문화 가정 의존) |
| 소유자 | Founder + Data |
| 측정 시작 | Phase 1+2 W0 (launch 시점) |
| 결과 영향 | Gate #1 < 20% 시 장소 기능 자체 재검토 |
| 출처 | OFFICE_HOURS §9.2 |

---

## G2 — Gate #2 (장소 확정 → "예약하기" click-through) **★ 가장 critical**

| 항목 | 내용 |
|---|---|
| 결정 | ≥25% 강한 신호 → **Phase 3 full commit** / 10-24% 보류 (P1 학생 vs P2 직장인 segment 분리 측정) / **<10% 즉시 3-path 결정**: (a) coordination-only product reframe (b) 식당 20곳 timeline 재조정 (c) P2 segment 별도 acquisition |
| 근거 | Cold read의 falsifiable prediction. 결제 의향(P3) 검증의 단일 측정 지점. <10% 시 토스/변호사/통신판매업 burn 회피 |
| 신뢰도 | 중하 (산업 benchmark × intent boost factor 곱셈 — Phase 2 결과 보고 재설정) |
| 소유자 | Founder |
| 측정 시작 | Phase 1+2 W0 (launch 시점) |
| 의존 | "예약하기" click event 로깅 정확도 (idempotent, 더블탭 무관) |
| 결과 영향 | Phase 3 commit 여부의 단일 게이트. Pre-mortem communication script 필요 (OPEN_QUESTIONS Q13) |
| 출처 | OFFICE_HOURS §7 (cold read) + §9.2 |

---

## D4 — 디자인 원칙: 토스 풍 절제

| 항목 | 내용 |
|---|---|
| 결정 | 표현은 타이포 위계·여백·곡률로. **그라데이션·글래스모피즘·장식 패턴 금지** |
| 근거 | 시각 앵커: 토스(절제·고대비·여백) + Linear(밀도·정밀). 슈퍼휴먼·노션 아님 |
| 적용 | 모든 UI 컴포넌트. design-guard hook이 `bg-gradient`, `backdrop-filter`, `backdrop-blur` 적중 시 차단 |
| 결정일 | 2026-05-21 |
| 출처 | DESIGN §0.1 + §16 |

---

## D5 — Purple Discipline

| 항목 | 내용 |
|---|---|
| 결정 | 보라(#7C3AED brand-500)는 **의미가 있을 때만**: CTA, 제휴 강조, 히트맵 최고치(heat-4), 모임 확정. **장식 보라 금지** |
| 근거 | "무게 있는 보라" — 의미 dilution 방지 |
| 결정일 | 2026-05-21 |
| 출처 | DESIGN §0.2 + §16 |

---

## D6 — 다크모드 = 시스템 자동, 독립 디자인

| 항목 | 내용 |
|---|---|
| 결정 | 다크는 라이트의 색 반전이 아니라 **독립 디자인** (채도 10~20% 낮춤, 보라는 살짝 밝힘). 수동 토글 없음 (시스템 자동만) |
| 근거 | 두 모드 동등 품질 확보. 수동 토글은 차기 |
| 결정일 | 2026-05-21 |
| 결과 영향 | Phase 1+2은 토큰 두 세트만 정의 (Step 12). 디테일 검증은 D2에 따라 Phase 3 |
| 출처 | DESIGN §0.3 + §3.2 + §16 |

---

## D7 — Typography: Pretendard Variable 단일 패밀리, 셀프호스팅

| 항목 | 내용 |
|---|---|
| 결정 | Pretendard Variable WOFF2 셀프호스팅. **CDN 의존 금지** (오프라인 첫화면 보호) |
| 금지 | System font fallback 단독, Inter, Noto Sans KR, Apple SD Gothic Neo, Spoqa Han Sans |
| 근거 | 한국어 + Latin + 숫자 단일 패밀리. 가변 폰트 = 1 파일 번들 |
| 결정일 | 2026-05-21 |
| 출처 | DESIGN §2.1 + §16 |

---

## D8 — 아이콘 = Lucide + 6 커스텀

| 항목 | 내용 |
|---|---|
| 결정 | Lucide 2px stroke 시스템 + 6개 커스텀(브랜드 마크, 제휴 마커 PNG, FAB 글리프, 히트맵 칩, 노쇼 뱃지, 환불 핀) |
| 근거 | 2px stroke 절제 톤이 토스 풍과 매치. Phosphor 4-weight는 과잉. 네이버 SDK는 SVG 마커 불가 → 마커만 PNG 1.5x/2x/3x |
| 결정일 | 2026-05-21 |
| 출처 | DESIGN §9 + §16 |

---

## D9 — 시간 그리드: 8pt 시각 셀 + 44pt hit area

| 항목 | 내용 |
|---|---|
| 결정 | 시각 셀 높이 8pt, 터치 hit area 44pt (`hitSlop`으로 확장, 인접 셀 겹침 허용) |
| 근거 | WCAG 2.5.5 + iOS HIG 44pt 터치 타깃 + PRD sweep 제스처 보존 |
| 결정일 | 2026-05-21 |
| 출처 | DESIGN §5.2 + §10.1 + §16 |

---

## D10 — 히트맵 5단계 색 램프, heat-0 = 중립 그레이

| 항목 | 내용 |
|---|---|
| 결정 | 5-stop ramp(heat-0~4). heat-0은 surface-3 중립 그레이(빈 슬롯). **본인 선택은 ramp가 아닌 별도 시각**(보라 보더 2pt + brand-50 fill) |
| 근거 | 100단계 grayscale 인지 불가, 5단계가 인지 가능한 최대 해상도. 빈 슬롯과 본인 슬롯의 시각 충돌 방지 |
| 결정일 | 2026-05-21 |
| 출처 | DESIGN §4 + §16 |

---

## D11 — Realtime 히트맵 = Edge Function 합산 후 broadcast (옵션 B)

| 항목 | 내용 |
|---|---|
| 결정 | votes INSERT → 트리거 → Edge Function이 group_id로 votes 합산 → broadcast. 클라는 receive → `useSharedValue` 업데이트. 100ms debounce |
| 근거 | 클라이언트 합산은 7명 모임 × 1000 events = 7000 events/s 처리 불가 (60fps 무너짐). Edge에서 합산하면 broadcast payload는 aggregate만 |
| 대안 | (A) Postgres LISTEN/NOTIFY raw broadcast — 거부: 클라 합산 부담. (C) Materialized view + postgres_changes — 거부: 복잡도, PG 11+ 의존 |
| 결정일 | 2026-05-21 |
| 결과 영향 | Step 3 (시간 그리드 + 투표) Edge Function 추가. rules/supabase.md에 명시 |
| 출처 | ENG_REVIEW §1.4 |

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

---

## D12 — 60fps 시간 그리드 구현 spec

| 항목 | 내용 |
|---|---|
| 결정 | (1) `react-native-gesture-handler` + Reanimated **worklet** (UI thread, JS 영향 0) (2) 셀 상태 = `useSharedValue` (3) Vote commit = drag 종료 시 1회 + 100ms debounce (4) 가상화 = `FlashList` 또는 React.memo 셀 (5) Heatmap receive도 별도 shared value |
| 근거 | 60슬롯 × 7일 = 420셀에서 매 터치 setState → 16ms 예산 초과 |
| 측정 기준 | Hermes profile/Flipper frame drop 측정. 부하: 7명 모임 동시 투표. 저사양 baseline: iPhone SE 2, Galaxy A14 |
| 결정일 | 2026-05-21 |
| 결과 영향 | rules/react-native.md에 Reanimated worklet 의무 명시 |
| 출처 | ENG_REVIEW §4.1 |

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

---

## D13 — KST 강제, DB는 TIMESTAMPTZ (UTC)

| 항목 | 내용 |
|---|---|
| 결정 | DB는 `TIMESTAMPTZ` UTC 저장. Client는 `Asia/Seoul` 강제 (`luxon` or `date-fns-tz`). 해외 사용자도 모든 시간 KST로 표시 + "KST 기준" 작은 라벨 |
| 근거 | 한국 내수 베타지만 해외 출장 P2 직장인 corner case 존재. 시간 그리드 09:00~24:00은 항상 KST |
| 결정일 | 2026-05-21 |
| 결과 영향 | rules/ko-kr.md에 KST 강제 + design-guard hook이 `new Date(` (timezone 미명시) 적중 시 차단 |
| 출처 | ENG_REVIEW §2.5 |

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

---

## D14 — 시간 슬롯 단위 강제: 15분 + DB CHECK constraint

| 항목 | 내용 |
|---|---|
| 결정 | DB column에 `CHECK (start_minute % 15 = 0)`. Application constant `SLOT_DURATION_MINUTES = 15`. Prior MVP 30분 데이터 미이전 (fresh DB) |
| 근거 | type system + DB 없이는 30분 슬롯 데이터가 들어오면 UI 깨짐 |
| 결정일 | 2026-05-21 |
| 출처 | ENG_REVIEW §2.1 |

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

---

## D15 — `schedules.source` enum + Phase 1+2은 provider 구분 포기

| 항목 | 내용 |
|---|---|
| 결정 | `source` enum = `'manual' \| 'google' \| 'apple_ios' \| 'everytime'`. **Phase 1+2은 apple_ios 안의 provider 구분 포기** ("Apple Calendar (iOS 디바이스 모든 일정 통합)"으로 UX 표시) |
| 근거 | `expo-calendar`는 iOS 디바이스의 모든 캘린더 통합 접근 → apple_ios가 multi-source bucket. Provider 구분은 복잡도 ↑ |
| 결정일 | 2026-05-21 |
| 결과 영향 | "Google 일정만 끄기" 토글은 차기. external_account_provider 컬럼 추가는 차기 |
| 출처 | ENG_REVIEW §2.2 |

---

## D16 — 차단·신고 일관성: Helper function + RLS

| 항목 | 내용 |
|---|---|
| 결정 | Supabase RLS + helper `is_blocked(viewer_id, target_id) returns boolean`. 모든 SELECT(친구 검색·추천·모임 멤버·초대)가 이 함수 통과 |
| 보존 동작 | 같은 모임 멤버 = 이미 참여 중이면 차단 후에도 표시 유지, 단 코멘트 hidden + 푸시 silent. 모임 떠나야 사라짐 |
| 결정일 | 2026-05-21 |
| 출처 | ENG_REVIEW §2.4 |

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

---

## D17 — Push F4 idempotency: `groups.f4_sent_at` column

| 항목 | 내용 |
|---|---|
| 결정 | `groups.f4_sent_at` (timestamp nullable). Edge Function이 UPDATE WHERE `f4_sent_at IS NULL AND all_member_voted` 트랜잭션 내 처리 |
| 근거 | trigger보다 명시적 → 디버깅 ↑. race condition 회피 |
| 결정일 | 2026-05-21 |
| 출처 | ENG_REVIEW §1.8 |

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

---

## D18 — 좌표계 정규화 layer

| 항목 | 내용 |
|---|---|
| 결정 | 모든 카카오 Local API 호출에 `?x={lng}&y={lat}` (WGS84) 명시. `coords/normalize.ts` 단일 진입점 통과 |
| 근거 | 카카오 Local API는 WTM/TM/KTM/BESSEL/WCONGNAMUL 모두 지원 → 명시 안 하면 마커 km 단위 어긋남 |
| 결정일 | 2026-05-21 |
| 출처 | ENG_REVIEW §1.5 |

---

## D19 — Calendar sync: 단방향, 부분 실패 명시

| 항목 | 내용 |
|---|---|
| 결정 | (1) Read + Push 단방향. 외부 수정/삭제 sync X (사용자에게 명시) (2) Token 만료 시 silent fail 금지 — 프로필 → 캘린더 연결 관리에 "재인증 필요" + 다음 진입 시 모달 (3) Push 부분 실패 시 호스트에게 "일부 멤버 추가 실패" + 멤버 list |
| 근거 | iOS 17+ write-only 권한 + Google Calendar token 만료가 일상적 |
| 결정일 | 2026-05-21 |
| 출처 | ENG_REVIEW §1.7 |

---

## D20 — Calendar push fan-out = background queue

| 항목 | 내용 |
|---|---|
| 결정 | Edge Function 1회 호출이 15개 외부 API trigger → background queue (Supabase Function Hook + `pg_cron`)로 분리. 호스트 액션은 즉시 응답, push는 비동기. retry max 3, partial fail report |
| 근거 | Edge Function 60s timeout + Google Calendar QPS limit |
| 결정일 | 2026-05-21 |
| 출처 | ENG_REVIEW §4.4 |

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

---

## D21 — Kakao OAuth synthetic email + HMAC (베타는 카카오 only) ⚠️ Superseded by D29 (2026-05-22)

> **이 결정은 폐기되었습니다.** 카카오 비즈앱 우회 OAuth 대신 표준 OIDC + `supabase.auth.signInWithIdToken`을 채택. 본문은 이력 보존을 위해 그대로 둠.

| 항목 | 내용 |
|---|---|
| 결정 | `email = f"kakao_{id}@denda.synthetic"` + `HMAC(secret, id) = signature`. Supabase Auth는 일반 user처럼 동작, 외부 발송 불가. 베타는 카카오 only. Apple ID 추가는 정식 출시 시점 (App Store guideline 4.8 준수) |
| 근거 | 카카오 비즈앱 신청 회피. 정책 위반 아님 (이메일 권한 요청 X) |
| 의존 | D1 (Kakao 정책 답변 7일 안에) |
| 결정일 | 2026-05-21 |
| 출처 | OFFICE_HOURS §9.1 + ENG_REVIEW §7.2 |

---

## D22 — Phase 1+2 Tech Stack

| 항목 | 내용 |
|---|---|
| 결정 | RN + Expo SDK 53+ · Supabase (Postgres + Realtime + Edge Functions + Auth) · `@mj-studio/react-native-naver-map` · Kakao Local API · expo-calendar (iOS) + Google Calendar API · **자체 deferred deep link** (Attribution SaaS 회피 — [D28](#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)) · Expo Push · zustand · Pretendard Variable · Lucide. **Toss Payments는 Phase 3**. Web guest: Next.js + Vercel |
| 근거 | OFFICE_HOURS §9.1 채택 |
| 결정일 | 2026-05-21 |
| 출처 | OFFICE_HOURS §9.1 |

---

## D23 — Web Guest Page = Next.js (별도 codebase)

| 항목 | 내용 |
|---|---|
| 결정 | Vercel + Next.js. 모바일 RN과 별도 codebase. 시간 그리드는 별도 구현 (디자인 토큰·동작 spec만 공유) |
| 근거 | 카톡 viral funnel의 fallback. 게스트는 앱 설치 전 투표 가능 (Branch.io로 deferred deep link 매칭) |
| Conflict flag | Step 3(RN) ↔ Step 10(Web) — spec drift 위험. 토큰·behavior spec을 Step 1과 같은 sprint에 정의 |
| 결정일 | 2026-05-21 |
| 출처 | OFFICE_HOURS §9.1 + ENG_REVIEW §9.4 |

---

## D24 — Test Framework

| 항목 | 내용 |
|---|---|
| 결정 | Unit/Integration: **Jest + @testing-library/react-native**. E2E mobile: **Maestro**. Web E2E: **Playwright**. Supabase Edge: **Deno test**. (OCR eval: D2에서 유지된 경우만 — Gemini Vision JSON 비교 + ground truth set) |
| 근거 | Maestro = 현재 한국 RN 커뮤니티 표준 Layer 1. Detox 대안 |
| 결정일 | 2026-05-21 |
| 결과 영향 | rules/testing.md에 명시 + TDD 의무 |
| 출처 | ENG_REVIEW §3.2 |

---

## D25 — Cold start target: < 2초 + lazy loading

| 항목 | 내용 |
|---|---|
| 결정 | **Always load:** expo-router, react-native, supabase-js, zustand, expo-secure-store. **Lazy:** naver-map (지도 탭 진입), expo-calendar (모임 확정), Branch SDK (첫 진입 attribution), Gemini Vision (OCR 진입), 토스 webview (Phase 3). Target: cold start < 2초 (EAS production binary, iOS/Android × 저사양/중사양) |
| 결정일 | 2026-05-21 |
| 출처 | ENG_REVIEW §4.3 |

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

---

## D26 — Kakao Local API quota: client debounce + viewport cache

| 항목 | 내용 |
|---|---|
| 결정 | Viewport 이동 300-500ms debounce + 5분 viewport 격자 캐싱(client). Quota 한도 도달 시 "잠시 후 다시" + 캐시 결과 fallback. Server proxy는 Phase 1+2 미도입 (TODO) |
| 추정 | 베타 1000 DAU × 평균 10회 viewport = 10000 호출/일 < 30만 무료 한도 |
| 결정일 | 2026-05-21 |
| 출처 | ENG_REVIEW §4.2 |

---

## D27 — Attribution SaaS = Singular (베타 한정, Phase 3 재평가)

> **Status**: ❌ Superseded by [D28](#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피) (2026-05-22). Singular도 work email 강제 정책 발견 → "Gmail OK" 근거 invalid. 본 결정 무효.

| 항목 | 내용 |
|---|---|
| 결정 | Phase 1+2 attribution SaaS = **Singular** (free tier). Branch.io 거부 사유 = 개인 이메일 도메인 차단 (Gmail/Naver 차단, 회사 도메인 강제) → 솔로 개발자 마찰. Singular = Gmail OK + free tier. Phase 3 진입 시 광고 채널 운영 여부 결정 후 재평가 (필요 시 AppsFlyer/Branch 마이그레이션). |
| 근거 | (1) 베타는 광고 acquisition 없음 — 카톡 viral funnel + organic만. SaaS의 광고 채널 통합 기능 무관. (2) BM (식당 commission, 거래당 ₩1000 수준) ↔ install 광고비 (₩3000+/install) — LTV/CAC 회수 어려워 Phase 3에서도 광고 사용 가능성 낮음. (3) Singular 한국 시장 데이터 부족은 광고 채널 통합 영역만 — deferred deep link 자체 동작에는 무관. |
| 대안 | (A) Branch.io + 도메인 구매 — 거부: 도메인 마케팅 가치는 있으나 단순 attribution 위한 외부 도메인 셋업 마찰. (C) 자체 deferred deep link 구축 — 거부: iOS Universal Links + AASA + IDFA 운영 부담 + G2 게이트 측정 노이즈 위험 (Q-A6 정확도 50% 이하 가능, viral funnel UX 마찰). |
| 소유자 | Founder |
| 결정일 | 2026-05-22 |
| 의존 | Q-A6 closure (이 결정이 close) |
| 결과 영향 | (1) D22 stack의 "Branch.io" → "Singular". (2) Q-A6 PoC 대상 변경 (Singular의 한국 NAT 정확도). (3) S15 SDK 이름 + setup 변경 (logical flow 동일). (4) Phase 3 진입 시점 재평가 trigger — 광고 launch 결정 동시. (5) `.env.example` 변수명 `EXPO_PUBLIC_BRANCH_KEY` → `EXPO_PUBLIC_SINGULAR_API_KEY`. |
| 출처 | 본 세션 (2026-05-22) — Branch.io Gmail 차단 발견 후 평가 |

---

## D28 — 자체 deferred deep link 구축 (attribution SaaS 회피, 도메인 구매 회피)

| 항목 | 내용 |
|---|---|
| 결정 | Attribution SaaS 사용하지 않음. 게스트→회원 attribution을 자체 구축. 단축 URL host = Vercel default subdomain (`denda.vercel.app/g/<token>`) — 별도 도메인 구매 회피. 명시적 4자리 모임 코드 fallback 의무 활성 (Attribution miss 시 100% 보장 경로). |
| 근거 | (1) Branch / Singular / AppsFlyer / Adjust 모두 work email 강제 (개인 Gmail/Naver 차단) → 솔로 개발자 가입 자체 차단. (2) 도메인 구매도 회피 의사 (마케팅 사이트는 Phase 3에 결정). (3) 베타 광고 acquisition 0 → SaaS 광고 채널 통합 무관. (4) BM (식당 commission ₩1000/거래 vs install 광고비 ₩3000+/install) — Phase 3 광고 launch 가능성 낮음. SaaS 비용 정당화 어려움. |
| 수용된 Risk | **명시적으로 acknowledge한 trade-off**: (a) G2 측정 노이즈 — Branch.io 가정 70% → 자체 구축 50% 이하 가능. (b) viral funnel UX 마찰 — 모든 게스트가 명시적 4자리 코드 입력 강제 (자연스러운 deferred deep link UX 손실). (c) 1-2주 추가 개발 시간 (iOS Universal Links + AASA + assetlinks.json + fingerprint 매칭 + ATT/PIPA 직접 대응). (d) Phase 3 광고 launch 시 SKAdNetwork/Play Install Referrer 미지원 → 그때 SaaS 추가 도입 필요. |
| 대안 | (A) Branch.io + 도메인 구매 — 거부: 도메인 구매 회피 의사. (B) Singular — 거부: [D27](#d27--attribution-saas--singular-베타-한정-phase-3-재평가) 무효 (work email 강제). |
| 소유자 | Founder |
| 결정일 | 2026-05-22 |
| 의존 | [D27](#d27--attribution-saas--singular-베타-한정-phase-3-재평가) supersede. Q-A6 재정의 (자체 구축 정확도 PoC). |
| 결과 영향 | (1) ARCHITECTURE.md §3.5 재작성 (자체 구축 spec). (2) S15 자체 구축 acceptance — Singular SDK 통합 → 자체 fingerprint 매칭 + 4자리 코드 fallback 의무. (3) `branch_attributions` table 이름 유지 (schema 변경 cost 회피, 의미적으로 generic attribution id 저장). (4) `.env.example`에서 Singular 변수 제거. (5) Sprint 4 일정 1-2주 추가 가능 — S05 (회사 운명 60fps) critical path 보호 필요. (6) `denda.vercel.app/g/<token>` URL pattern — web-guest (S14)가 이 endpoint 처리. (7) AASA (`apple-app-site-association`) + Android `assetlinks.json` 직접 작성 + Vercel public hosting. |
| 출처 | 본 세션 (2026-05-22) — Singular work email 정책 발견 + 사용자 자체 구축 선택. 4가지 risk 명시적 수용 |

---

## D29 — Kakao OIDC OAuth via Supabase signInWithIdToken (D21 supersede)

| 항목 | 내용 |
|---|---|
| 결정 | 카카오 OIDC 표준 OAuth + `supabase.auth.signInWithIdToken({ provider: 'kakao', token: id_token, nonce })`. 베타는 `scope=openid profile_nickname`만 요청 (비-비즈앱 가능). 비즈앱 등록 + `account_email` scope 추가는 Phase 3 진입 시점 (Gate #2 ≥ 25% 통과). D21 (synthetic email + HMAC) 폐기, `supabase/functions/kakao_login/` 삭제, `users.synthetic_email` 컬럼 제거. |
| 근거 | (1) Supabase가 카카오를 native id_token provider로 공식 지원 — 자체 검증·HMAC 구현 제거 (2) 카카오 OIDC 표준 flow는 정책 회색지대 없음 — Q-A1 답변 의존 해소 (3) `account_email` consent만 비즈앱 제약이라 베타에서 이메일 미수신 trade-off로 비즈앱 신청을 Phase 3에 align (사업자등록·토스 가맹 심사와 동기) (4) D21 채택 결정일(2026-05-21) 이후 1일 만에 사용자가 정석 경로 선호 명시 |
| 대안 | (a) D21 유지 — Q-A1 답변 지연·표준 이탈 risk (b) 베타에서 비즈앱 즉시 등록 — 사업자등록 timing 압박·launch 1-2주 지연 risk |
| 의존 | Sprint 0 인프라 체크리스트: 카카오 디벨로퍼스 portal에서 OpenID Connect 활성화 + Supabase Auth dashboard에서 Kakao provider Enable. 둘 다 수동 작업, founder 소유 |
| 결정일 | 2026-05-22 |
| 영향 | S01 BLOCKED → TODO, Q-A1 Closed, D1 결정 본문 (auth 부분만) update, `supabase/functions/kakao_login/` 삭제, `users.synthetic_email` DROP (migration 0003), HMAC secret 용도 변경 (D21 → D28 fingerprint salt) |
| Phase 3 전환 | 비즈앱 신청 → 승인 → `account_email` scope 추가 → 기존 user 재로그인 시 `auth.users.email` 자동 채움. Schema 변경 불필요 (`email` 이미 nullable) |
| 출처 | docs/superpowers/specs/2026-05-22-kakao-oidc-design.md, 사용자 결정 2026-05-22 |

---

## 향후 결정 추가 템플릿

새 결정을 추가할 때 다음 형식을 복사:

```markdown
## D{N} — {제목}

| 항목 | 내용 |
|---|---|
| 결정 | (한 문장으로) |
| 근거 | (왜 이 결정인가) |
| 대안 | (고려했지만 거부된 옵션 + 거부 이유) |
| 소유자 | (의사결정 책임자) |
| 결정일 | YYYY-MM-DD |
| 의존 | (다른 결정이나 OPEN_QUESTIONS 항목) |
| 결과 영향 | (어떤 코드/문서/태스크에 영향) |
| 출처 | (어떤 문서/논의에서 비롯됐나) |
```

새 결정은 OPEN_QUESTIONS.md의 해당 항목을 닫고 (Closed by D{N}) 그 결정 ID를 명시.

---

## 폐쇄된 게이트·결정

(현재 없음 — 새로 닫히면 여기로 이동, ID는 유지)
