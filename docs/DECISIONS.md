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
| 결과 영향 | S01 (Auth) baseline = D29 OIDC 표준 (Q-A1 closed). S10 (Map): Q-A2 "허용" 답변 수신(2026-06-01 → [D37](#d37--q-a2-카카오-local-api-약관-허용-답변-수신--kakaolocalprovider-평가-트랙)). 현 primary = D36 NaverSearchProvider, KakaoLocalProvider 평가 트랙 개시(우위 시 교체). Step 16은 lazy interface 추상화만. Apple 심사 시 Apple ID 추가는 Phase 3 |
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
| Payload spec | `{ slots: [{day_index, start_minute, count}], updated_at }` — day_index는 `groups.dates DATE[]`의 0-based offset (가변 day 범위 지원). updated_at = KST ISO (+09:00, D13). [Q-B21 close](OPEN_QUESTIONS.md#q-b21--d11-heatmap-broadcast-payload에-day-차원-누락) (2026-05-26) |
| Channel / event | `group:${group_id}` channel · `heatmap_update` event |
| 결정일 | 2026-05-21 (payload spec 갱신 2026-05-26 — Q-B21 close) |
| 결과 영향 | Step 3 (시간 그리드 + 투표) Edge Function 추가. rules/supabase.md에 명시 |
| 출처 | ENG_REVIEW §1.4 |

### 구현 예제

**Edge Function (합산 + broadcast)**:

```ts
// supabase/functions/votes_aggregate/index.ts
// votes INSERT trigger → 합산 → broadcast

// 1) groups.dates SELECT (day_index 매핑용)
const { data: group } = await supabase
  .from('groups')
  .select('dates')
  .eq('id', groupId)
  .single();
const dates = group?.dates ?? []; // ['2026-06-15', '2026-06-16', ...]

// 2) votes SELECT — day + start_minute
const { data: votes } = await supabase
  .from('votes')
  .select('day, start_minute')
  .eq('group_id', groupId);

// 3) day → day_index 매핑 + 합산 (groups.dates에 없는 day는 skip)
const dayIdx = new Map(dates.map((d, i) => [d, i]));
const counts = new Map<string, { day_index: number; start_minute: number; count: number }>();
for (const v of votes ?? []) {
  const idx = dayIdx.get(v.day);
  if (idx === undefined) continue; // graceful skip
  const key = `${idx}:${v.start_minute}`;
  const existing = counts.get(key);
  if (existing) existing.count++;
  else counts.set(key, { day_index: idx, start_minute: v.start_minute, count: 1 });
}
const slots = Array.from(counts.values()).sort(
  (a, b) => a.day_index - b.day_index || a.start_minute - b.start_minute,
);

await supabase.channel(`group:${groupId}`).send({
  type: 'broadcast',
  event: 'heatmap_update',
  payload: { slots, updated_at: nowKst().toISO() },
});
```

**클라이언트 (broadcast만 listen)**:

```ts
// src/lib/heatmap/useHeatmapSubscription.ts
supabase.channel(`group:${groupId}`)
  .on('broadcast', { event: 'heatmap_update' }, ({ payload }) => {
    // payload.slots = [{day_index, start_minute, count}, ...]
    // applyHeatmapPayload로 60×N CellState[][] 변환 후 useSharedValue 업데이트
    setPayload(payload);
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

## D30 — §17 anti-AI-feel 디자인 원칙 신설 (DESIGN.md §17)

| 항목 | 내용 |
|---|---|
| 결정 | DESIGN.md §17에 6가지 anti-AI-feel 안티패턴 카탈로그 추가. §17.1 반복 CTA · §17.2 빈 placeholder · §17.3 위계 평탄화 · §17.4 시각 자산 0 · §17.5 disabled 가짜 affordance (revised: surface-2 회색 명시) · §17.6 무미건조 마이크로카피. 정성적 검증(design-check 스킬 + PR self-review). |
| 근거 | 1차 베타 화면 portfolio(로그인·온보딩·홈·친구탭) 회고 — "AI 생성물 같다"는 사용자 피드백 수렴. 토큰(D4·D5·D7)은 정합되지만 적용 화면에서 위계 평탄·반복 CTA·시각 자산 부재·시스템 톤 카피로 모드 전환 갭 발생. |
| 대안 | (A) 토큰만 보강 — 거부: 정성적 문제는 토큰 추가로 해결 불가. (B) 외부 디자이너 의뢰 — 거부: 솔로 빌드 + 베타 timeline. (C) 안티패턴 catalog 없이 ad-hoc polish — 거부: 일관성 없음. |
| 소유자 | Founder + Design |
| 결정일 | 2026-05-25 |
| 의존 | DESIGN.md §17 신설. Q-B12 (마이크로카피 일관 룰)와 §17.6 align. |
| 결과 영향 | (1) DESIGN.md §17 본문 추가 (+88줄). (2) `src/components/brand/` 신규 시각 자산 컴포넌트 5종 (BrandMark, HeatRampRow, MiniCalendar, MiniMap, MiniTimeGrid) — §17.4 대응. (3) 1차 적용: auth(login/onboarding/terms) + tabs 구조(_layout/index/friends/_layout/map/profile) + friends 컴포넌트 polish. (4) `design-check` 스킬 + design-guard hook은 정성적 §17 위반 자동 검출 불가 — PR self-review 체크리스트 의무 (§17.7). (5) §17.5 본문(revised 2026-05-25)이 §17.7 체크리스트와 모순됐던 부분은 같은 commit에서 fix됨. |
| Phase 3 전환 | §17 원칙 + 체크리스트는 Phase 3까지 유지. 정성적 평가라 design-check 스킬·PR 리뷰어 의존. |
| 출처 | 본 세션 (2026-05-25/26) — 1차 베타 화면 회고 + §17 신설 + 1차 적용 |

---

## D31 — 차단 호스트 모임 = 부분 노출 (groups SELECT 불변 + 클라이언트 호스트 mask)

| 항목 | 내용 |
|---|---|
| 결정 | A가 B를 차단한 뒤 B가 호스트인 모임에 A가 이미 멤버로 있을 때 — `groups` SELECT는 변경 없음(모임 카드 노출). 호스트 닉네임·프로필은 이미 `users SELECT`의 is_blocked로 자연 mask됨. 추가 UI 처리 불요 (자연 mask가 충분). 사용자가 떠나고 싶으면 모임 카드 진입 → 기존 leave 흐름. |
| 근거 | 멤버십 연속성이 차단 강도보다 우선. 진행 중 모임 일정·투표·확정 단절은 사용자 손해가 큼. `users SELECT`이 이미 호스트 row를 가리므로 D16 정신은 부분적으로 보존됨. |
| 대안 | (B) 능동 leave 라벨 — 거부: "차단한 사용자가 만든 모임" 명시는 자연 mask보다 시각 노이즈 ↑ + UX 결정권을 강요. 자연 mask가 더 절제됨. (C) 완전 숨김(groups SELECT에 NOT is_blocked 추가) — 거부: 참여 중 모임이 갑자기 사라져 일정/투표 단절 + 호스트가 멤버 list 변화로 차단을 간접 감지 가능 (사회 신호 leak). D16 정신과 멤버십 연속성 트레이드오프에서 후자 채택. |
| 소유자 | Founder (UX 결정) |
| 결정일 | 2026-05-26 |
| 의존 | D16 (차단·신고 helper). Q-A8 close. |
| 결과 영향 | (1) `supabase/migrations/0007_d16_propagation_audit.sql` 그대로 — `groups` SELECT 미변경 정당화 명시화. (2) 신규 migration 불요. (3) `src/screens/groups/` 또는 `app/(tabs)/index.tsx` 모임 list 코드 변경 없음 — `users SELECT` 자연 mask가 처리. (4) S07 acceptance "차단된 사용자가 만든 모임 초대 = hidden"의 "초대"는 group_invitations(0005에서 처리)만, "내 모임 list"는 본 결정으로 자연 mask 부분 노출. (5) Q-A8 OPEN_QUESTIONS에서 Closed by D31 표기. |
| Phase 3 전환 | 차단 정책 강화가 필요해지면 D31 supersede 후 (C) 옵션으로 전환 가능. 베타 사용자 데이터에서 "차단 호스트 모임 노출" 불만 발생 시 재평가. |
| 출처 | 본 세션 (2026-05-26) — S07-d16-audit 결과 Q-A8 등록 → founder 결정 |

---

## D32 — 베타 신고 = reports DB-only, 운영 통지 채널 deferred

| 항목 | 내용 |
|---|---|
| 결정 | 베타(Phase 1+2) 신고 flow는 **사용자 UI → reports table INSERT만** 진행. 운영팀 카톡 채널 자동 통지(`notify_admin` Edge Function + webhook)는 Sprint 0 #11 운영 카톡 채널 셋업 완료 후 별도 task로 deferred. 베타 동안 founder는 Supabase dashboard에서 weekly로 `SELECT * FROM reports WHERE created_at > NOW() - INTERVAL '7 days'`로 manual review. |
| 근거 | 운영팀 카톡 채널 셋업(카카오비즈 채널 인증 + webhook 토큰 발급)은 현 시점 시간·리소스 제약으로 어려움. 신고 UI는 단독으로 가치 있음(사용자가 즉시 신고+차단 가능, evidence가 DB에 누적). manual weekly review로 베타 trust&safety 최소 기준 충족. 베타 사용자 N=수십명 규모에서는 7일 SLA 수용 가능. |
| 대안 | (A) 신고 UI도 deferred — 거부: 차단(blocks)은 가능한데 신고가 없으면 evidence 누적 0, 운영 패턴 발견 불가. (B) Slack/Discord webhook 임시 도입 — 거부: 운영팀이 카톡 중심 + 또 다른 채널 도입 학습비용 + Phase 1+2 외부 의존 추가. (C) 이메일 fallback — 거부: founder 이메일 폭주 risk + 알림 latency. manual weekly review가 단순함. |
| 소유자 | Founder |
| 결정일 | 2026-05-26 |
| 의존 | S07 acceptance reframe. Sprint 0 #11 운영 카톡 채널 셋업이 prereq 해소되면 본 결정 supersede 후 D33 자동 통지 도입. |
| 결과 영향 | (1) S07 acceptance 마지막 항목 split: "✅ 신고 UI + reports INSERT" + "⏸️ 운영팀 카톡 채널 통지 (D32 deferred — Sprint 0 #11 prereq)". (2) S07 close 가능 (신고 UI ship 후). (3) 운영 SOP 추가 필요: weekly reports review checklist (별도 운영 문서 또는 founder 캘린더 reminder). (4) 신고 UI는 즉시 reports INSERT + 즉시 차단 toggle을 한 flow에 묶어 사용자가 본인 안전 즉시 확보 (운영 응답 지연을 우회). |
| Phase 3 전환 | 운영 카톡 채널 셋업 완료 + 자동 통지 Edge Function `notify_admin` 도입 시 D32 supersede. 신고 SLA 7일 → 24시간으로 단축. 신고 trend 자동 분석(weekly 운영 리포트) 추가 가능. |
| 출처 | 본 세션 (2026-05-26) — S07 acceptance 5번째 항목 prereq 확인 중 founder가 운영 채널 셋업 어려움 표명 |

---

## D33 — 모임 확정 fan-out = 단일 dispatcher (Q-B5 close)

| 항목 | 내용 |
|---|---|
| 결정 | "모임 확정" 같은 다중 listener 이벤트는 **`group_confirm` Edge Function 1곳에서만 publish**하고, 후속 fan-out(F5 push, Calendar push, 그 외)은 `supabase/functions/_lib/dispatcher.ts`의 `register(type, handler)` + `dispatch(event)` pattern으로 in-process 라우팅. DB trigger·중복 trigger·여러 Edge Function의 분산 listen 금지. F5 같은 즉시성 push는 dispatcher 내부에서 직접 호출 (low fan-out, <1s). Calendar push처럼 fan-out 큰 작업은 dispatcher가 `groups.calendar_pushed_at IS NULL` queue row만 표시하고 실제 외부 호출은 D20의 pg_cron worker가 처리. |
| 근거 | (1) DB trigger 분산 listen은 디버깅·관측 비용 ↑ (어떤 trigger가 어떤 순서로 발화했는지 추적 어려움). Edge Function 1곳 publish + in-process handler list가 stack trace + 로그 명확. (2) F5는 mailing list 작아(모임 N≤7) Edge Function 60s timeout 안에 충분. Calendar push는 D20 background queue로 분리 — dispatcher가 publish하고 worker는 별도 cron이 처리하는 2-layer로 책임 분리. (3) `dispatcher.ts` stub이 이미 0001 시점 작성됨 (Q-B5 대기 명시) — 본 결정으로 stub → real impl. (4) handler register는 group_confirm/index.ts 모듈 초기화 단계에서 진행 — `notify_f5` import 시 `register('group_confirmed', notifyF5Handler)` 호출. testability 확보. |
| 대안 | (A) DB trigger fan-out — 거부: groups.confirmed_at AFTER UPDATE → 여러 trigger에서 net.http_post로 각각 Edge Function 호출. trigger 순서·실패 격리·재시도 모두 SQL에서 처리 → 디버깅 cost ↑. Postgres에서 외부 HTTP 호출은 silent fail risk(D11의 GUC 패턴과 같은 GUC 사전 설정 의무 외에도 retry 정책 부재). (B) 2-trigger 단순 (deferred dispatcher) — 거부: S06/S12 ship 시 group_confirm Edge Function의 호출 경로를 다시 갈아엎어야 함 → ripping out 비용. (C) 외부 메시지 브로커 (RabbitMQ/Kafka) — 거부: Phase 1+2 인프라 단순성 원칙(D22) 위배. dispatcher in-process로 베타 충분. Phase 3 fan-out 폭증 시 재평가. |
| 소유자 | Backend (Founder approval) |
| 결정일 | 2026-05-26 |
| 의존 | [Q-B5](OPEN_QUESTIONS.md#q-b5--edge-function-단일-dispatcher) closed. [D17](DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column) (f4_sent_at idempotency pattern은 f5_sent_at에도 mirror), [D19](DECISIONS.md#d19--calendar-sync-단방향-부분-실패-명시) (partial fail), [D20](DECISIONS.md#d20--calendar-push-fan-out--background-queue) (calendar는 별도 queue), [D22](DECISIONS.md#d22--phase-12-tech-stack) (인프라 단순성) |
| 결과 영향 | (1) S04 `group_confirm` Edge Function이 dispatcher의 단일 publisher. (2) `_lib/dispatcher.ts` stub → real impl (register/dispatch + Promise.allSettled로 한 handler 실패가 다른 handler 차단 X). (3) `notify_f5` Edge Function이 dispatcher handler로 register. (4) S06 calendar push는 dispatcher에서 `groups.calendar_pushed_at IS NULL` 큐잉만 (D20 worker가 별도 발송). (5) S12 `notify_f1`/`f2`/`f3`도 같은 dispatcher pattern follow (각 trigger event type 별로 register). (6) F1-F3 trigger 위치 부분 정합 — [Q-B3](OPEN_QUESTIONS.md#q-b3--푸시-알림-트리거-위치)는 본 결정으로 partial 해소 (Edge Function 통일), F1/F2/F3의 publisher 식별은 S12 작업 시 결정. |
| 출처 | 본 세션 (2026-05-26) — S04 시작 전 Q-B5 closure 필요 → founder가 권고(단일 dispatcher) 채택. dispatcher stub은 0001 시점 작성된 placeholder |

---

## D34 — Apple Calendar sync = 클라 polling 패턴 (Q-B22 close)

| 항목 | 내용 |
|---|---|
| 결정 | Apple Calendar(`apple_ios` 또는 `both`) push는 worker가 직접 외부 API 호출 불가(`expo-calendar`는 클라이언트 권한) → worker가 `apple_pending` table에 row INSERT만 하고, 클라이언트가 foreground 진입 시 SELECT → `AppleCalendarProvider.insertEvent` 호출 → row UPDATE `completed_at`. partial_fail_list와 의미 분리(`pending ≠ failure`)를 위해 **별도 table** (`calendar_push_apple_pending`: `id`, `group_id`, `user_id`, `payload JSONB`, `created_at`, `completed_at`). 24시간 미완료 row는 호스트 알림 trigger 후보. |
| 근거 | (1) iOS silent push는 3/hour throttle + Android 호환성 부족 + ack endpoint 추가 복잡 → 자동성 가치보다 risk 큼. (2) F5 시간 확정 알림이 이미 사용자를 앱으로 유도 → 클라 polling이 자연 흐름. (3) 베타 N≤7 fan-out 작아 인프라 단순성 가치 ↑. (4) Realtime broadcast는 백그라운드 socket 끊김 + missed message 복구 안 됨 → 거부. (5) partial_fail_list channel='apple_pending' 재사용 vs 별도 table: pending은 "실패 누적" 의미와 다르고 lookup pattern(user_id 기준 SELECT)도 다름 → 별도 table 분리가 명료. |
| 대안 | (a) Silent push notification — 거부 (위 (1) 근거). (c) Realtime broadcast — 거부 (위 (4) 근거). (b-mixed) partial_fail_list channel='apple_pending' 재사용 — 거부: pending은 실패 누적과 의미 다르며 lookup pattern 다름. |
| 소유자 | Backend + Mobile (Founder approval) |
| 결정일 | 2026-05-26 |
| 의존 | [Q-B22](OPEN_QUESTIONS.md#q-b22--apple-calendar-sync-mechanism-worker--client-trigger-패턴) closed by D34. [D19](#d19--calendar-sync-단방향-부분-실패-명시) (partial fail report), [D20](#d20--calendar-push-fan-out--background-queue) (background queue), [D15](#d15--schedulessource-enum--phase-12은-provider-구분-포기) (apple_ios bucket) |
| 결과 영향 | (1) `supabase/migrations/0013_calendar_push_apple_pending.sql` 신규 (table + RLS 본인만 SELECT/UPDATE). (2) `calendar_push_worker.pushToMemberCalendar`이 `users.calendar_preference` SELECT → 'apple_ios'/'both' → `calendar_push_apple_pending` INSERT(별도 sub-task S06-worker-apple-trigger). (3) 클라 hook `src/lib/calendar/useApplePendingSync.ts` 신규 — app foreground 진입 시 SELECT → `AppleCalendarProvider.insertEvent` → `completed_at` UPDATE. (4) S06 acceptance "expo-calendar wrapper" 충족 + 24h 미완료 stale row 호스트 알림은 별도 worker 또는 pg_cron job. |
| 출처 | 본 세션 (2026-05-26) — S06-worker-google-integration 시작 전 Q-B22 closure 필요 |

---

## D35 — Google Calendar OAuth token 서버 측 저장 = user_oauth_tokens table

| 항목 | 내용 |
|---|---|
| 결정 | Google Calendar용 OAuth token은 `user_oauth_tokens` 신규 table에 저장: `user_id UUID`, `provider TEXT`(예: `'google_calendar'`), `access_token TEXT`, `refresh_token TEXT`, `expires_at TIMESTAMPTZ`, `scope TEXT`, `created_at`, `updated_at`. 클라이언트가 OAuth flow 완료 후 supabase RPC `upsert_user_oauth_tokens`로 업로드. worker(`calendar_push_worker`)는 service_role로 SELECT → `access_token` 만료 시 `refresh_token`으로 갱신 → `events.insert` 호출. RLS: 본인 행 SELECT/UPDATE/DELETE만 허용, INSERT/UPSERT는 RPC를 통해 (RPC가 user identity 검증). Encrypt-at-rest는 Phase 3에서 Supabase Vault로 격상(베타는 row-level RLS로 1차 격리). |
| 근거 | (1) Worker가 서버 측에서 events.insert 호출하려면 refresh_token 서버 접근 필요. (2) Supabase Auth `auth.identities`는 Kakao OIDC가 이미 사용 — Google Calendar OAuth를 linkIdentity로 추가하면 auth flow 의미 혼란(Google로 로그인 가능한 것처럼 보임) + auth.identities는 OAuth user 매칭 의도이지 외부 API token storage 의도가 아님. (3) Service account + 도메인 위임은 Google Workspace 도메인 한정 → 베타 일반 Google 계정 안 맞음. (4) `user_oauth_tokens` table은 단순 schema로 future Apple Sign-in(혹시 token 저장 필요해질 경우)·기타 OAuth provider에 자연 확장. (5) 베타 N≤7 fan-out 작아 encrypt overhead 미미하지만, refresh_token은 민감 — RLS + service_role-only SELECT 2중 격리. |
| 대안 | (a) `auth.identities` 활용 — 거부 (위 (2) 근거). (b) Service account + 도메인 위임 — 거부 (위 (3) 근거). (d) refresh_token 클라이언트 only + worker가 클라 호출 — 거부: D20 background queue 본 의도(즉시 응답 + 비동기 worker)를 깸. |
| 소유자 | Backend (Founder approval) |
| 결정일 | 2026-05-26 |
| 의존 | [D19](#d19--calendar-sync-단방향-부분-실패-명시) (단방향 + token 만료 명시), [D20](#d20--calendar-push-fan-out--background-queue) (worker가 events.insert 호출), [D29](#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede) (Kakao OIDC는 `auth.identities` 단독 사용 — Google은 별도 storage) |
| 결과 영향 | (1) `supabase/migrations/0012_user_oauth_tokens.sql` 신규: table + RLS + `upsert_user_oauth_tokens(p_provider, p_access_token, p_refresh_token, p_expires_at, p_scope)` RPC. (2) `supabase/functions/_lib/google_calendar.ts` 신규: server-side `refreshAccessToken` + `insertCalendarEvent` 순수 함수(Deno fetch 기반). (3) `src/lib/calendar/google.ts` 클라이언트에 OAuth 완료 후 token 서버 업로드 wrapper 추가는 별도 sub-task(S06-setup) — 본 sub-task는 server-side path만. (4) `calendar_push_worker.pushToMemberCalendar`이 `users.calendar_preference` + `user_oauth_tokens` SELECT → 분기 처리. (5) Token 갱신: `expires_at` 임박 또는 401 응답 시 `refresh_token`으로 POST `oauth2.googleapis.com/token` → `access_token` + 새 `expires_at` UPDATE. refresh_token 회전 시(응답에 새 refresh_token 포함) 함께 UPDATE. (6) refresh_token 만료(401 with `invalid_grant`) → D19 token 만료 path: `partial_fail_list`에 `reason='token_expired'` 마킹 → 호스트 알림 + 사용자 재인증 모달(S06-ui-reauth-modal) trigger. |
| 출처 | 본 세션 (2026-05-26) — S06-worker-google-integration prereq. worker가 events.insert 호출 위해 server-side token storage 결정 필요 |

---

## D36 — S16 장소 검색 fallback = NaverSearchProvider eager (Q-A2 no-answer) + Edge proxy

| 항목 | 내용 |
|---|---|
| 결정 | [D1](#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup)의 no-answer 액션을 발동: Q-A2(카카오 Local API on Naver Maps 약관) 답변 미수신 상태에서 장소 검색 데이터 소스를 **네이버 지역검색 Open API**로 eager 활성. `PlaceSearchProvider` 인터페이스(Phase a, 항상) 뒤에 `NaverSearchProvider`(Phase b)를 plug-in. 네이버 지역검색은 **Client Secret 필요 → Edge Function `naver_local_search` proxy 경유**(CLAUDE.md rule 7), 클라이언트는 `supabase.functions.invoke`만. 좌표는 Edge에서 WGS84 정규화([D18](#d18--좌표계-정규화-layer)) 후 반환. |
| 근거 | (1) 마감(2026-05-28) 하루 전이지만 founder가 선제 활성 결정(2026-05-27) — 인터페이스 추상화로 추후 카카오 "허용" 답변 시 `KakaoLocalProvider`를 같은 인터페이스로 추가 + provider 주입만 교체(caller 무변경)하면 되어 선제 진행의 매몰 비용 0. (2) `PlaceSearchProvider` 인터페이스 + 좌표 정규화는 카카오 채택 시에도 그대로 재사용(Phase a "항상"). (3) Naver secret은 client expose 절대 금지(rule 7) → Kakao(D26 "server proxy 미도입")와 달리 proxy 필수. (4) 시각 지도 화면(S10: Naver Maps SDK 렌더·뷰포트 debounce·클러스터링)은 native 모듈/EAS Build 의존이라 본 결정 범위 밖 — provider 레이어(검색·데이터)만 활성. |
| 대안 | (a) 마감(2026-05-28)까지 대기 후 활성 — 거부: 인터페이스 추상화로 선제 진행이 무위험 + 일정 여유 확보. (b) 카카오 REST key 클라이언트 expose하여 Kakao Local 강행 — 거부: 약관 미확인 + rule 7. (c) 클라이언트가 네이버 직접 호출 — 거부: Client Secret expose(rule 7). |
| 소유자 | Founder (활성 결정) + Backend (proxy 아키텍처) |
| 결정일 | 2026-05-27 |
| 의존 | [D1](#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup) (no-answer 액션 명시), [D18](#d18--좌표계-정규화-layer) (좌표 WGS84 정규화 — Naver는 Edge 측 mapx/mapy 변환), [Q-A2](OPEN_QUESTIONS.md#q-a2--kakao-local-api-약관-외부-지도-sdk-위-표시) (답변 미수신 → 본 fallback. 답변 수신 시 KakaoLocalProvider 추가 평가) |
| 결과 영향 | (1) `supabase/functions/_lib/naver_local.ts` 신규: stripHtmlTags + normalizeNaverCoord(WGS84×10^7 가정) + isPlausibleKoreaWgs84(좌표 format mismatch 안전망) + parseNaverLocalResponse + buildPlaceSearchResults + fetchNaverLocal(fetch DI). (2) `supabase/functions/naver_local_search/index.ts` Edge: POST {query, display?} → auth.getUser(quota 보호) → NAVER_CLIENT_ID/SECRET env → fetch → PlaceSearchResult[]. rate_limit→429("잠시 후 다시"), 그 외 외부 오류→502. (3) `src/lib/places/PlaceSearchProvider.ts` 인터페이스 + `NaverSearchProvider.ts` 클라이언트(invoke). (4) **운영 prereq(별도 트랙)**: NAVER_CLIENT_ID/SECRET 등록 + Edge env set + live API로 좌표 format(WGS84×10^7 vs TM128) 검증(isPlausibleKoreaWgs84가 mismatch 시 마커 제외로 조기 감지) + 지역검색 display 최대 5 한계 수용. (5) S10(지도 화면)이 본 provider를 소비 — S10 unblock 시 viewport debounce/캐싱(D26) + Naver Maps SDK 렌더 wire-up. |
| 출처 | 본 세션 (2026-05-27) — 사용자 "답변 안 옴 → fallback" 지시. D1 no-answer 액션 실행 |

---

## D37 — Q-A2 카카오 Local API 약관 허용 답변 수신 → KakaoLocalProvider 평가 트랙

| 항목 | 내용 |
|---|---|
| 결정 | Q-A2(네이버 지도 위 카카오 Local API 매장 데이터 표시) 카카오 디벨로퍼스 공식 답변 = **허용**(C.L 카카오 인증 계정, ≈2026-05-27 수신: "타사 API와 함께 사용 별도 제한 없음 / 서비스 이용 약관·운영 정책 준수 시 사용 가능 / 카카오맵 SDK 동반은 권고일 뿐 의무 아님"). [D1](#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup) "허용 시" 경로 + [D36](#d36--s16-장소-검색-fallback--naversearchprovider-eager-q-a2-no-answer--edge-proxy) "답변 수신 시 KakaoLocalProvider 추가 평가" 발동. `KakaoLocalProvider`를 동일 `PlaceSearchProvider` 인터페이스 + Edge proxy(`kakao_local_search`, REST key는 Edge env — rule 7) 패턴으로 추가해 NaverSearchProvider와 데이터 quality(카테고리·POI 밀도·display 한계) 비교, **우위 시 primary 교체 / 열위 시 Naver 유지**. 비교 확정 전까지 NaverSearchProvider(D36) primary 유지. |
| 근거 | (1) D1이 요구한 "Kakao 서면 답변" 충족 — 공식 인증 계정 서면. (2) D36 인터페이스 추상화로 provider 추가 매몰비용 0(caller 무변경). (3) Kakao Local은 stable place ID·카테고리 depth·display(최대 15/page + pagination)에서 네이버 지역검색(안정 ID 없음·display 최대 5)보다 구조적 우위 가능성 → 경험적 평가 가치. (4) 답변 #3 "가급적 카카오 지도와 같이"는 soft 권고지 의무 아님 → Naver Maps SDK 유지가 위반 아님. |
| 대안 | (a) 즉시 Kakao primary 전환(비교 생략) — 거부: 경험적 검증 없이 커밋. (b) 기록만·Naver 영구 유지 — 거부: D1·D36 명시 평가 경로 포기 + Kakao 데이터 우위 가능성 미활용. (c) 출처표기·표시범위 요건 정책문서 선검증 후 기록 — 보류: 사용자 판단으로 생략(답변 캡처 증빙 보관). |
| 소유자 | Founder |
| 결정일 | 2026-06-01 |
| 의존 | [Q-A2](OPEN_QUESTIONS.md#q-a2--kakao-local-api-약관-외부-지도-sdk-위-표시) (본 답변으로 closed), [D1](#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup), [D36](#d36--s16-장소-검색-fallback--naversearchprovider-eager-q-a2-no-answer--edge-proxy) (인터페이스·Edge proxy·좌표 정규화 재사용 = 평가 트랙 전제), [D18](#d18--좌표계-정규화-layer) (Kakao 좌표 WGS84 정규화), rule 7 (Kakao REST key Edge only) |
| 결과 영향 | (1) Q-A2 Closed by D37. (2) **신규 코드(평가 트랙·미착수)**: `supabase/functions/_lib/kakao_local.ts` + `kakao_local_search/index.ts` + `src/lib/places/KakaoLocalProvider.ts`(naver_local 미러, TDD). Kakao 키워드검색 `dapi.kakao.com/v2/local/search/keyword.json` — `Authorization: KakaoAK {KAKAO_REST_API_KEY}`, 응답 `documents[]`(x=lng/y=lat WGS84 decimal·stable `id`·`category_name`·`road_address_name`·`phone`). (3) **운영 prereq(별도 트랙·founder)**: NAVER_CLIENT_ID/SECRET는 **이미 Supabase Edge secret 등록 확인됨**(2026-06-01 `supabase secrets list` + placeholder 해시 불일치로 실값 검증 — SESSION_LOG·D36의 "미등록" 기재는 stale). 남은 운영 prereq는 **KAKAO_REST_API_KEY 등록**뿐 — 등록 즉시 live 데이터 quality 비교 가능. 비교 결과로 primary 확정(후속 D 또는 본 D37 갱신). (4) 답변 #2(출처표기 방식)는 직답 없이 정책문서로 갈음 → 미검증, 답변 캡처 증빙 보관. (5) S10·S16 provider 소비 코드 무변경(인터페이스 동일). |
| 출처 | 본 세션 (2026-06-01) — 카카오 1:1 문의 답변 캡처(C.L 카카오, "5일 전"≈2026-05-27) |

> ⚠️ **보류 by [D39](#d39--장소-검색-primary--naversearchprovider-확정-kakao-local-보류-카카오맵-심사-반려) (2026-06-08)**: 카카오맵 `OPEN_MAP_AND_LOCAL` 제품 심사 반려 + 출시 우선 → 본 "평가 트랙(우위 시 primary 교체)" 비활성, NaverSearchProvider primary 확정. Kakao 코드는 dormant 보존. Q-A2 ToS "허용"은 유효 — 막힌 건 제품 심사 게이트(별개).

---

## D38 — 지도 렌더 seam = MapHost 단일 경계 + MapScene 계약 + isMapAvailable() env 게이트

| 항목 | 내용 |
|---|---|
| 결정 | 네이티브 지도 렌더를 단일 경계 컴포넌트 `MapHost`로 격리. 화면은 순수 `MapScene`(markers/polylines/region) 데이터만 만들어 넘기고, `MapHost`만 `isMapAvailable()`로 분기해 `NaverMapScene`(lazy import — D25) 또는 `MapPlaceholder`를 렌더한다. `isMapAvailable()` = `EXPO_PUBLIC_MAP_ENABLED==='true'` && `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`가 placeholder 아님. `app.config.ts`의 네이버 플러그인은 키 있을 때만 포함(Kakao 조건부 플러그인 패턴 복제). → 네이버 Client ID 발급 + EAS 빌드 후 env만 켜면 **코드 변경 0으로 점등**(S1 설치+게이트). |
| 근거 | (1) S10·S15 데이터·로직은 완성·테스트 통과인데 native 렌더만 EAS deferred → 키 없이 검증 가능한 "주변"을 지금 활성화하면서 점등 경로를 staging. (2) 4대 확장(동선·일정/제휴 마커/검색→확정/중간지점)이 동일 렌더 경로(MapScene) 공유 → 일관성·검증 표면 최대. (3) 기존 `MapViewMode` 주석이 의도한 "placeholder 1줄 교체"를 형식화. (4) lazy import로 native 모듈 평가를 지도 진입 시점까지 지연(D25). |
| 대안 | (a) 화면별 인라인 조건부 — 거부: 2화면×4기능 렌더/마커 로직 중복·DESIGN 일관성 깨짐·재작업. (b) 렌더 전면 보류(리스트-only) — 거부: "키 오면 1-flip 점등" 불가(큰 빌드 회귀). (c) 패키지 비설치 간접화(S2) — 보류: 활성화가 1-flip 아님(설치+와이어링 필요). 속도 우선 방침으로 S1 채택. |
| 소유자 | Founder |
| 결정일 | 2026-06-08 |
| 의존 | [D18](#d18--좌표계-정규화-layer)(좌표 정규화), [D25](#d25--cold-start-target--2초--lazy-loading)(lazy), [D36](#d36--s16-장소-검색-fallback--naversearchprovider-eager-q-a2-no-answer--edge-proxy)·[D37](#d37--q-a2-카카오-local-api-약관-허용-답변-수신--kakaolocalprovider-평가-트랙)(provider), S10·S15(데이터 레이어), [Q-B23](OPEN_QUESTIONS.md)(④ 멤버 위치), [Q-B13](OPEN_QUESTIONS.md#q-b13--제휴-마커-png-export)(② 마커 PNG) |
| 결과 영향 | 신규 `src/lib/map/{mapScene,mapAvailability}.ts` + `src/components/map/{MapHost,MapPlaceholder,MapLoading,NaverMapScene}.tsx`(+테스트 14). `app/schedule/map.tsx` placeholder→MapHost(① 동선·일정 데이터 연결). `app.config.ts` 조건부 naver 플러그인 + `@mj-studio/react-native-naver-map@2.9.0` 설치. `.env.example` `EXPO_PUBLIC_MAP_ENABLED`. `tsconfig.json` `scripts` 제외(Deno). 설계: [2026-06-08-map-feature-activation-design.md](superpowers/specs/2026-06-08-map-feature-activation-design.md). 운영 prereq(별도 트랙): 네이버 Maps Client ID + Local ID/Secret 등록 + EAS 네이티브 빌드 + 실기기 60fps. ②(제휴 마커) partnership 데이터는 Phase 3(D3) → 시각 capability까지만. |
| 출처 | 본 세션 (2026-06-08) — 지도 기능 활성화 브레인스토밍 + 통합 로드맵 spec |

---

## D39 — 장소 검색 primary = NaverSearchProvider 확정 (Kakao Local 보류, 카카오맵 심사 반려)

| 항목 | 내용 |
|---|---|
| 결정 | 장소 검색 데이터 소스 primary = **NaverSearchProvider 확정**(Phase 1+2). [D37](#d37--q-a2-카카오-local-api-약관-허용-답변-수신--kakaolocalprovider-평가-트랙)의 "KakaoLocalProvider 평가 트랙(우위 시 primary 교체)"은 **보류** — 카카오맵 `OPEN_MAP_AND_LOCAL` 제품 심사 **반려** + 출시 우선순위. KakaoLocalProvider·`kakao_local`·`kakao_local_search` 코드는 **dormant**(삭제 X — `PlaceSearchProvider` 인터페이스 뒤 보존, 추후 카카오맵 승인 시 provider 주입 교체로 무비용 재활성). |
| 근거 | (1) 카카오맵 제품 심사 반려로 Kakao Local 즉시 사용 불가(403 `App disabled OPEN_MAP_AND_LOCAL service`). 재도전은 승인 불확실 + 출시 지연. (2) Naver raw API 검증 완료 — 6쿼리 5/5, 카테고리·주소 채움 100%(2026-06-08 `compare-place-providers`). 출시 데이터 품질 충분. (3) D36 인터페이스 추상화로 Kakao 코드 보존 비용 0 → 폐기보다 dormant가 합리적(재평가 옵션 유지). (4) 출시 timeline > 데이터 소스 최적화(founder 판단). |
| 대안 | (a) 카카오맵 심사 재도전(스크린샷 보강) — 거부: 출시 지연 + 승인 불확실. (b) Kakao 코드 삭제 — 거부: 인터페이스 뒤 보존이 무비용, 재활성 옵션 상실. (c) Naver+Kakao 병행 — 거부: 미승인 Kakao는 호출 불가(403), 무의미. |
| 소유자 | Founder |
| 결정일 | 2026-06-08 |
| 의존 | [D36](#d36--s16-장소-검색-fallback--naversearchprovider-eager-q-a2-no-answer--edge-proxy)(NaverSearchProvider + 인터페이스), [D37](#d37--q-a2-카카오-local-api-약관-허용-답변-수신--kakaolocalprovider-평가-트랙)(평가 트랙 — 본 결정으로 보류), [Q-A2](OPEN_QUESTIONS.md#q-a2--kakao-local-api-약관-외부-지도-sdk-위-표시)(ToS "허용"은 유효, 제품 심사는 별개 게이트), [D38](#d38--지도-렌더-seam--maphost-단일-경계--mapscene-계약--ismapavailable-env-게이트)(MapHost provider 소비) |
| 결과 영향 | (1) **출시 prereq**: `naver_local_search` Edge 함수 **배포 필요**(현재 미배포) — NAVER_CLIENT_ID/SECRET은 등록 완료(검증됨). 배포 즉시 앱 장소 검색 동작. (2) Kakao 자산 dormant: `src/lib/places/KakaoLocalProvider.ts`, `supabase/functions/_lib/kakao_local.ts`, `supabase/functions/kakao_local_search/`(ACTIVE 배포돼 있으나 호출 시 403 → 미사용). Supabase `KAKAO_REST_API_KEY` secret 유지 무해. (3) S10·S20·MapHost(D38) provider = NaverSearchProvider 주입, caller 무변경. (4) Kakao 자산은 TDD green 상태로 보존 — 재활성 시 인터페이스 동일이라 즉시 평가 가능. |
| 출처 | 본 세션 (2026-06-08) — 카카오맵 제품 심사 반려 + founder "출시 우선, Naver로 간다" 결정 |

---

## D40 — 지도 마커 = NaverMapMarkerOverlay children 커스텀 뷰 (PNG 래스터 대체)

| 항목 | 내용 |
|---|---|
| 결정 | 네이버 지도 마커를 **PNG 래스터 에셋 대신 `NaverMapMarkerOverlay`의 children(RN 커스텀 뷰)로 렌더**한다. `MapMarkerView`(brand-500 원 + 흰 inner stroke 2pt + order 숫자)를 children으로 넘기면 네이티브가 래스터화 → 색·크기·stroke를 DESIGN 토큰으로 직접 제어. DESIGN §10.2의 "PNG 래스터(Naver SDK 제약)" 가정을 **무효화** — `@mj-studio/react-native-naver-map`은 children 마커를 지원. |
| 근거 | (1) 기본 `image={{symbol:'green'}}` 프리셋이라 tintColor로도 브랜드 보라톤이 안 나옴(실기기서 teal 확인). (2) children 뷰 = DESIGN 토큰 직접 적용 → brand-500/흰 stroke/숫자 배지를 코드로 정확히 구현(§10.5·§10.2·§12.6). (3) **PNG 에셋(Q-B13) 의존 제거** — 디자인 1.5x/2x/3x export 대기 없이 출시 가능, 다크모드 stroke(surface-0)도 토큰으로 자동. (4) 실기기 검증 완료(2026-06-09 에뮬레이터 — starbucks 검색 → 보라 마커 렌더). |
| 대안 | (a) PNG 래스터 에셋(원안 §10.2) — 거부: 에셋 export 대기 + 동적 숫자 배지 불가 + 다크모드 별도 에셋 + Q-B13 블로커. (b) tintColor on symbol — 거부: symbol 프리셋 색만(보라 없음), 실기기서 미적용 확인. (c) `image={require(png)}` — 거부: (a)와 동일 + 동적성 상실. |
| 소유자 | Founder (2026-06-09 "PNG 구하지 말고 보라톤 맞는 걸로 만들어줘") |
| 결정일 | 2026-06-09 |
| 의존 | [D38](#d38--지도-렌더-seam--maphost-단일-경계--mapscene-계약--ismapavailable-env-게이트)(MapHost/NaverMapScene seam), [Q-B13](OPEN_QUESTIONS.md#q-b13--제휴-마커-png-export)(본 결정으로 close — PNG 불필요), DESIGN §10.2/§10.5/§12.6(토큰 적용) |
| 결과 영향 | (1) `src/components/map/MapMarkerView.tsx`(신규) + `NaverMapScene.tsx`(children wire, tintColor/image/width/height 제거). (2) **Q-B13 close** — 제휴 마커 PNG export 불필요(디자인 자산 1건 제거). (3) DESIGN §10.2 "PNG 래스터" → "children 커스텀 뷰(토큰)" 갱신. (4) rules/design.md 6 커스텀 아이콘 목록서 "제휴 마커 PNG" 제거. (5) order 마커 숫자(§10.5) + 제휴 1.4× 강조(§10.2) 모두 코드로 구현 — 점등 시 코드 변경 0. (6) inner stroke = surface-0(라이트 흰/다크 0F0F12) 토큰으로 다크모드 §10.2 자동 충족. |
| 출처 | 본 세션 (2026-06-09) — S-MAP M4 후속 실기기 검증 중 teal 마커 발견 → founder "PNG 없이 보라톤" 지시 → @mj-studio children 마커 지원 확인 |

---

## D41 — 모임 출발지 서버 저장 (group_origins, Q-B23 부분 supersede)

| 항목 | 내용 |
|---|---|
| 결정 | 중간지점 협업(S-MAP M5)을 위해 **멤버 출발지(라벨+정확 좌표)를 모임 스코프 `group_origins` 테이블에 서버 저장**한다. 1인 1출발지(PK group_id+user_id, upsert). 보호선 = RLS(같은 모임 멤버/호스트만 SELECT + D16 차단 통과 + 본인 행만 쓰기) + ON DELETE CASCADE(모임 삭제·탈퇴 시 소거) + privacy 고지 개정. recentOrigins(최근 출발지 칩)는 여전히 온디바이스 — Q-B23의 해당 부분은 유지. |
| 근거 | (1) 멤버 각자 입력→자동 취합이 핵심 요구 — 온디바이스로는 멤버 간 공유 불가. (2) 출발지는 검색으로 고른 장소(역·동네)라 원시 GPS보다 민감도 낮고, 모임 스코프 격리+cascade로 최소보유 원칙 충족. (3) 사용자 확정(2026-07-12): "그대로 저장 + RLS". |
| 대안 | (a) ~500m 격자 뭉갬 저장 — 거부: 마커가 실위치와 어긋나 보이는 UX 혼란 대비 이득 작음. (b) Realtime broadcast만(비영속) — 거부: 비동기 모임 앱과 불일치(앞서 입력한 멤버 오프라인 시 취합 불가). |
| 소유자 | Founder (2026-07-12) |
| 결정일 | 2026-07-12 |
| 의존 | [Q-B23](OPEN_QUESTIONS.md#q-b23--멤버-중간지점-추천의-위치-데이터-소스--pipa)(부분 supersede), 0022 RLS 헬퍼, [D16](#d16--차단신고-일관성-helper-function--rls), [D18](#d18--좌표계-정규화) |
| 결과 영향 | (1) `supabase/migrations/0023_group_origins.sql` 신규. (2) `src/lib/map/groupOrigins.ts` 클라 모듈. (3) midpoint 화면 서버 연동 + 진입 버튼 전 멤버 노출. (4) **privacy.tsx 고지 개정 필수** — "기기 내 보관" 문구를 모임 출발지(서버)/최근 칩(온디바이스)으로 이원화. (5) 지하철역 스냅 + 자동 추천(맛집/카페/술집)은 D39 Naver 스택 재사용. |
| 출처 | 브레인스토밍 세션 (2026-07-12) — specs/2026-07-12-midpoint-collab-design.md |

---

## D42 — 홈 = 나만의 캘린더 (PRD §5.1 복귀) + 수동 개인 일정 활성

| 항목 | 내용 |
|---|---|
| 결정 | 로그인 후 첫 화면을 **월간 캘린더 + 선택일 일정 목록 + 다가오는 모임 요약**으로 되돌린다. 캘린더에 뜨는 것 = 모임(확정/투표 중) · 에브리타임 수업 · **수동 개인 일정(`schedules.source='manual'`, 추가/수정/삭제 UI 신설)**. 기존 홈의 인사말 2줄 · 보라 "새 모임 만들기" 카드 · "이번 달 모임" 스탯 칩은 제거(모임 생성 동선은 탭바 중앙 GroupFab이 담당). 이번 범위에서 **주간 뷰·출처 필터·외부 캘린더 읽기는 제외**. |
| 근거 | (1) [PRD](PRD.md) §4·§5.1이 처음부터 "홈 = 캘린더 + 내 일정 + 모임 일정"으로 명세했고 현 구현이 이탈해 있었다 — 새 방향이 아니라 원안 복귀. (2) 이탈의 실제 손실: `schedules` 테이블(에브리타임 OCR 산출물)의 앱 내 소비처가 **0**이었다 — P1 페르소나가 OCR로 시간표를 넣어도 볼 곳이 없었다. (3) 사용자 확정(2026-07-28): "로그인 후 진입 화면에 나만의 캘린더". |
| 대안 | (a) 캘린더를 기존 홈 위에 얹기 — 거부: 스크롤만 길어지고 §17.3 위계 평탄화. (b) 모임 목록을 친구 탭으로 완전 이관(PRD §4 문자 그대로) — 보류: Gate #1 진입 동선을 홈에서 잃는 비용이 커 '다가오는 모임' 압축 섹션으로 유지. (c) Google/Apple 일정까지 표시 — 거부: [D19](#d19--calendar-sync-단방향-부분-실패-명시) 단방향(push 전용) + iOS write-only 권한 전제라 권한 모델 재설계가 선행돼야 함. |
| 소유자 | Founder (2026-07-28) |
| 결정일 | 2026-07-28 |
| 의존 | [D13](#d13--kst-강제-db는-timestamptz-utc)(KST), [D14](#d14--시간-슬롯-단위-15분--db-check)(15분 단위 시간 입력), [D19](#d19--calendar-sync-단방향-부분-실패-명시)(유지 — 외부 캘린더 읽기 없음), [D5](#d5--purple-discipline)(보라는 '확정'에만) |
| 결과 영향 | (1) `src/lib/calendar/recurrence.ts`(주간 RRULE 전개)·`agenda.ts`(병합/마커) 신규. (2) `src/components/calendar/` MonthCalendar·DayAgenda·PersonalScheduleSheet 신규. (3) `src/lib/schedules/personal.ts` 수동 CRUD 신규 — 테이블·enum·RLS는 기존 자산이라 **마이그레이션 0**. (4) `fetchMyGroups` select에 `confirmed_start_at·confirmed_end_at·places(name)` 추가. (5) `countGroupsThisMonthKst`(stats.ts) dead code 제거. (6) 월 그리드 마커에서 **수업 제외** — 매주 반복이라 점을 찍으면 달 전체가 균일해져 정보량이 0. |
| 출처 | 브레인스토밍 세션 (2026-07-28) — specs/2026-07-28-home-calendar-design.md |

---

## D43 — RN → Figma 이식은 정적 트리 덤프 + Auto Layout 재구성 (일회성 부트스트랩)

| 항목 | 내용 |
|---|---|
| 결정 | 앱 컴포넌트·화면을 Figma로 옮길 때 **Jest에서 렌더한 RTL 트리를 정적으로 덤프해 Figma Auto Layout으로 재구성**한다(`tools/figma-export/`). 실기기 실측 좌표를 쓰지 않는다. **일회성 부트스트랩**이며 재동기화·컴포넌트 자동 인스턴스화는 범위 밖. 표현 불가한 스타일은 조용히 근사하지 않고 경고 + 레이어명 `⚠️` 표식을 남긴다. |
| 근거 | (1) 목표가 "컴포넌트 먼저 → 화면은 그 조합"이라 결과물이 **편집 가능한 Auto Layout**이어야 한다 — 절대 좌표는 박제돼 이 목표와 양립 불가. (2) 앱 스타일이 전부 인라인 객체라 렌더 시점에 값이 완전히 해석된다(`Button.tsx:119-134`). (3) `tests/screens/` 22스위트가 이미 통과하므로 화면 렌더 mock 세트를 재사용할 수 있어 추가 인프라가 0. (4) 서브에이전트 12개 적대적 검증(조사 6 → 반박 6)에서 6주제 중 5건 major 반박 → 정정 후 확정. |
| 대안 | (a) 실기기 `measureInWindow` 실측 좌표 — 거부: 픽셀 정확하지만 절대 배치라 Figma에서 편집·variant 생성 불가. (b) 하이브리드(구조는 Auto Layout, 실측은 검증용) — 거부: 일회성 부트스트랩에 과하고, 어긋난 곳은 Figma에서 손으로 고치는 편이 빠름. (c) html.to.design + Expo Web — 거부: `react-dom`/`react-native-web` 부재 + naver-map·kakao 네이티브 모듈 웹 stub 비용이 이득보다 큼. (d) yoga-layout 재구현으로 좌표 계산 — 거부: 절대 배치 16곳을 위해 레이아웃 엔진을 다시 짜는 비용이 수동 보정보다 큼. |
| 소유자 | Founder (2026-07-28) |
| 결정일 | 2026-07-28 |
| 의존 | [D4](#d4--디자인-원칙-토스-풍-절제)·[D5](#d5--purple-discipline)(토큰이 곧 이식 대상), [D7](#d7--typography-pretendard-variable-단일-패밀리-셀프호스팅)(폰트명 매핑 — `'PretendardVariable'`는 expo-font 키이며 OS 폰트명은 `'Pretendard Variable'`), [D13](#d13--kst-강제-db는-timestamptz-utc)(덤프 `generatedAt`은 luxon KST), [D24](#d24--test-framework)(순수 로직 TDD) |
| 결과 영향 | (1) `tools/figma-export/` 신규 — `ir.ts`(계약)·`color.ts`·`svg.ts`·`style.ts`·`normalize.ts`·`emit.ts`·`fixtures.tsx`·`*.dump.tsx`·`plugin/`. (2) `jest.config.js` testMatch에 `tools/figma-export/**/*.test.{ts,tsx}` 추가 — 순수 로직 104테스트가 CI 그린 대상. (3) `jest.figma.config.js` 신규 — 덤프 러너 전용(`npm test` 미포함). (4) `tsconfig.json` exclude에 `tools/figma-export/plugin` 추가(플러그인은 자체 tsconfig + 공식 Figma 타이핑). (5) devDependency `@figma/plugin-typings`·`esbuild` 추가. (6) npm scripts `figma`·`figma:dump`·`figma:merge`·`figma:typecheck`·`figma:build`. (7) `.gitignore`에 생성물(`out/`, `plugin/code.js`). **앱 런타임 코드 변경 0**. |
| 출처 | 브레인스토밍 + 적대적 검증 세션 (2026-07-28) — specs/2026-07-28-rn-figma-export-design.md |

---

## D44 — 닉네임 = 사용자 지정 유니크 값, public.users가 단일 진실

| 항목 | 내용 |
|---|---|
| 결정 | 카카오 이름을 그대로 쓰던 것을 **사용자가 직접 정하는 유니크 닉네임**으로 바꾼다. (1) `lower(nickname)` UNIQUE 인덱스 — 대소문자 무시 중복 차단. (2) 가입 직후 **필수 설정 단계**(게이트 순서 `terms → nickname → onboarding`), 서버측 진실은 `users.nickname_set_at`(NULL=미설정). (3) 규칙 = 2~12자 · `[가-힣a-zA-Z0-9_]` · 변경 무제한. (4) **`public.users`가 닉네임 단일 진실** — 세션의 `user.nickname`을 로그인·콜드 스타트에 DB 값으로 교체. (5) 쓰기는 `set_my_nickname` RPC 단일 경로. 별도 친구코드·전화번호 검색·금칙어 필터는 범위 밖. |
| 근거 | (1) 카톡 이름은 사용자가 고른 이름이 아니고 동명이인이 구분되지 않는데 친구 검색이 `nickname ilike`로 동작한다 — 잘못된 사람에게 요청을 보낼 수 있다. (2) **더 큰 결함**: 닉네임 소스가 갈라져 있었다 — 프로필 화면·카톡 초대 문구는 auth `user_metadata`(카카오 클레임 캐시), 친구 검색·모임 멤버·푸시 F1~F3은 `public.users`. `public.users`만 고쳐도 프로필에는 반영되지 않는 구조였다. (3) `nickname_set_at`을 서버에 두면 기기 로컬 SecureStore 플래그와 달리 재설치·기기 교체에도 따라오고 기존 사용자도 자동으로 한 번 거친다. (4) RPC로 좁히는 이유 — RLS에 컬럼 단위 제어가 없어 클라이언트 UPDATE를 허용하면 `nickname_set_at`을 위조해 설정 단계를 건너뛸 수 있다. |
| 대안 | (a) 닉네임 자유 + 자동 생성 친구코드(`denda#4821`, 카톡 ID·디스코드 방식) — 거부: 마찰은 0이지만 새 컬럼·생성 로직·공유 UI가 붙는데, 베타 규모에서 유니크 닉네임이 같은 문제를 새 개념 0개로 푼다. (b) 중복 허용 + 검색 UX로 흡수 — 거부: 제기된 문제가 그대로 남는다. (c) auth 메타데이터를 함께 갱신하는 RPC(읽기는 메타데이터 유지, 콜드 스타트 비용 0) — 거부: auth 스키마를 직접 건드리고 토큰 갱신 전까지 구 값이 남는다. (d) 클라이언트가 `users` UPDATE + `auth.updateUser` 둘 다 호출 — 거부: 원자성이 없어 한쪽만 성공하면 지금의 드리프트가 재발한다. (e) 30일 1회 변경 제한 — 거부: 베타에서 오타 하나에 한 달을 갇히는 비용이 사칭 리스크보다 크다. |
| 소유자 | Founder (2026-07-29) |
| 결정일 | 2026-07-29 |
| 의존 | [D13](#d13--kst-강제-db는-timestamptz-utc)(`nickname_set_at` TIMESTAMPTZ + `deps.now()`), [D16](#d16--차단신고-일관성-helper-function--rls)(`users` SELECT의 is_blocked 불변), [D25](#d25--cold-start-target--2초--lazy-loading)(콜드 스타트에서 프로필 조회를 await하지 않는 이유), [D29](#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)(카카오 클레임이 초기값) |
| 결과 영향 | (1) `0024_nickname.sql` — 컬럼·유니크 인덱스·조건부 CHECK·`handle_new_auth_user` 재작성(유니크 충돌 시 `이름_<id앞4자>` 폴백으로 **로그인 실패 방지**)·`set_my_nickname` RPC. (2) `src/lib/profile/` 신규(`nickname.ts` 검증 · `api.ts` RPC·조회). (3) `authStore`에 `fetchProfile` DI + `applyNickname` 액션 — `signIn`은 await, `bootstrap`은 백그라운드(D25). (4) `gate.ts`에 `nickname` 단계 + `nicknameSetAt` 3-상태(`undefined`=판단 보류로 콜드 스타트 깜빡임 방지). (5) `app/(auth)/nickname.tsx` 1개 화면이 가입·수정 두 모드 겸용(모드는 `nicknameSetAt`에서 파생 — 게이트와 입력이 같아야 어긋나지 않음). (6) `terms.tsx`의 다음 라우트가 onboarding → nickname. (7) 프로필 설정 섹션에 `닉네임 변경` 행. (8) 규칙이 3곳(클라 검증·RPC·CHECK)에 복제됨 — 각 위치에 상호 참조 주석. (9) **배포 시 1회성 `auth.users` 전체 삭제 필요** — 기존 중복이 있으면 유니크 인덱스 생성이 실패(의도된 안전장치). |
| 출처 | 브레인스토밍 세션 (2026-07-29) — specs/2026-07-29-nickname-design.md |

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
