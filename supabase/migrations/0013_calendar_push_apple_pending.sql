-- 0013_calendar_push_apple_pending.sql
-- S06-worker-apple-trigger — Apple Calendar sync 클라 polling pattern ([D34](../../docs/DECISIONS.md#d34--apple-calendar-sync--클라-polling-패턴-q-b22-close))
--
-- 동작 spec:
--   - worker(calendar_push_worker)가 사용자 calendar_preference='apple_ios' 또는 'both'인 멤버에 대해
--     모임 확정 시 본 table에 row INSERT (group_id, user_id, payload)
--   - 클라이언트(`src/lib/calendar/applePending.ts`)가 app foreground 진입 시 본인 user_id의 미완료 row SELECT
--     → AppleCalendarProvider.insertEvent → completed_at UPDATE
--   - completed_at IS NULL = pending. 24h+ stale row는 호스트 알림 trigger 후보 (별도 운영 cron — Phase 3)
--
-- partial_fail_list와 의미 분리: pending ≠ failure (D34 본문)
--   - partial_fail_list는 "실패 누적" — retry max 3 후 stop, 호스트 알림 trigger
--   - calendar_push_apple_pending은 "대기" — 사용자가 앱 열면 자동 처리, 클라이언트가 진행
--
-- RLS:
--   - SELECT/UPDATE 본인 행만 (auth.uid() = user_id)
--   - INSERT/DELETE는 service_role only (worker 또는 운영 cleanup) — 클라이언트 RLS 미허용
--
-- 관련:
--   - `supabase/functions/calendar_push_worker/index.ts` — pushToMemberCalendar 분기 추가
--   - `src/lib/calendar/applePending.ts` — fetchPendingRows + processPendingRow (DI)
--   - `src/lib/calendar/apple.ts` — AppleCalendarProvider.insertEvent (S06-apple-expo-calendar)

CREATE TABLE public.calendar_push_apple_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- (group_id, user_id) UNIQUE — worker가 같은 모임·멤버 INSERT 시 idempotent
-- (ON CONFLICT (group_id, user_id) DO NOTHING으로 안전)
CREATE UNIQUE INDEX calendar_push_apple_pending_group_user_uniq
  ON public.calendar_push_apple_pending(group_id, user_id);

-- 클라 polling lookup 최적화: 본인 user_id 미완료 row.
-- 자주 SELECT(앱 foreground 진입마다)되는 query 대응.
CREATE INDEX calendar_push_apple_pending_user_unfinished_idx
  ON public.calendar_push_apple_pending(user_id)
  WHERE completed_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.calendar_push_apple_pending ENABLE ROW LEVEL SECURITY;

-- SELECT 본인만
CREATE POLICY calendar_push_apple_pending_select_self
  ON public.calendar_push_apple_pending FOR SELECT
  USING (auth.uid() = user_id);

-- UPDATE 본인만 (completed_at SET) — service_role도 우회 가능
CREATE POLICY calendar_push_apple_pending_update_self
  ON public.calendar_push_apple_pending FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT는 RLS 정책 없음 → anon/authenticated 차단. worker는 service_role로 우회.
-- DELETE도 정책 없음 → service_role only (운영 cleanup용).
