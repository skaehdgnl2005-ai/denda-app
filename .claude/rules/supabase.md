---
description: Supabase 패턴 — RLS, Realtime aggregation, Edge Function. 백엔드 작업 시 자동 로드.
globs:
  - "src/lib/supabase/**"
  - "supabase/**"
  - "supabase/functions/**"
  - "supabase/migrations/**"
---

# Supabase Rules

→ 결정: [D11 Realtime aggregation](../../docs/DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b), [D16 차단 helper](../../docs/DECISIONS.md#d16--차단신고-일관성-helper-function--rls), [D17 F4 idempotency](../../docs/DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column), [D20 Background queue](../../docs/DECISIONS.md#d20--calendar-push-fan-out--background-queue)

## 절대 규칙

### D11 — Realtime 히트맵 = Edge Function aggregation

클라이언트 raw votes 합산 금지. Edge Function이 합산 후 broadcast. 클라이언트는 broadcast만 listen → `useSharedValue` 업데이트 (rules/react-native.md 참조).

- 결정 본문 · 근거: [DECISIONS.md#d11](../../docs/DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b)
- 구현 위치: `supabase/functions/votes_aggregate/`
- 상세 구현 패턴: [ARCHITECTURE.md §4](../../docs/ARCHITECTURE.md)

### D16 — 모든 SELECT는 차단 helper 통과

`is_blocked(viewer_id, target_id)` helper function이 모든 RLS policy에 포함되어야 한다. 친구 검색·추천·모임 멤버·초대 모든 query에 적용.

- 결정 본문 · SQL 예제: [DECISIONS.md#d16](../../docs/DECISIONS.md#d16--차단신고-일관성-helper-function--rls)
- 마이그레이션 위치: `supabase/migrations/_lib/blocking.sql`

### D17 — F4 push idempotency

`groups.f4_sent_at` UPDATE를 조건부(`IS NULL`)로 처리. 0 rows 반환되면 이미 발송됨 → no-op.

- 결정 본문 · TS 예제: [DECISIONS.md#d17](../../docs/DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column)
- 구현 위치: `supabase/functions/notify_f4/`

### D14 — 시간 슬롯 = 15분 단위 CHECK

DB CHECK constraint `start_minute % 15 = 0` + application constant `SLOT_DURATION_MINUTES = 15` (server + client 공유).

- 결정 본문 · SQL 예제: [DECISIONS.md#d14](../../docs/DECISIONS.md#d14--시간-슬롯-단위-15분--db-check)

### D13 — TIMESTAMPTZ + KST

- DB는 항상 `TIMESTAMPTZ` (UTC 정규화)
- Edge Function에서 KST 변환 시 `Asia/Seoul` 명시
- Client는 luxon/date-fns-tz로 통일

결정 본문 · 예제: [DECISIONS.md#d13](../../docs/DECISIONS.md#d13--kst-강제-db는-timestamptz-utc)

### D20 — Calendar push fan-out = background queue

호스트 액션은 즉시 응답. pg_cron이 queue 처리 (별도 Edge Function). retry max 3, partial fail → `groups.partial_fail_list`에 기록.

- 결정 본문 · 패턴: [DECISIONS.md#d20](../../docs/DECISIONS.md#d20--calendar-push-fan-out--background-queue)

### Edge Function 단일 dispatcher 권고

Calendar push(S06) + Push 알림(S12) 둘 다 모임 확정 trigger를 듣는다. 단일 dispatcher EventBus pattern으로 충돌 회피.

- 미해결: [Q-B5](../../docs/OPEN_QUESTIONS.md#q-b5--edge-function-단일-dispatcher)
- 위치: `supabase/functions/_lib/dispatcher.ts`

## 디렉토리 구조

상세 트리: [ARCHITECTURE.md §3](../../docs/ARCHITECTURE.md) (supabase/migrations, functions/_lib·kakao_login·votes_aggregate·group_confirm·notify_f1~f5·calendar_push·click_log·branch_attribution·ocr_everytime, tests)

## API key 보안

| Key | 위치 |
|---|---|
| Kakao OAuth secret (HMAC) | Edge Function only |
| Kakao Local API key | Edge Function only (proxy Phase 1+2 미도입 — [Q-B8](../../docs/OPEN_QUESTIONS.md#q-b8)) |
| Naver Map SDK key | 클라이언트 (SDK 한계, public expose 인정) |
| Gemini Vision key | Edge Function only |
| Google Calendar OAuth | 클라이언트 동의 후 token은 SecureStore |
| Branch.io key | 클라이언트 + 서버 양쪽 |
| HMAC secret | Supabase secret (환경변수) |

## RLS Policy 패턴

모든 table에 RLS 활성화. 기본 policy:
- SELECT: 본인 + (차단 helper 통과)
- INSERT: 본인 + (제3자 차단 안 함)
- UPDATE/DELETE: 본인만 또는 호스트만 (groups 등)

## 금지 패턴

- 클라이언트에서 raw votes 받아 합산 (히트맵 broadcast 외)
- RLS 우회 (`SECURITY DEFINER` 남용)
- API key 클라이언트 expose (Naver Map SDK key 제외)
- Bare `Date()` insert → 항상 TIMESTAMPTZ
- 차단 helper 미통과 SELECT
