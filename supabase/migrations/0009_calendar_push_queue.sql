-- 0009_calendar_push_queue.sql
-- S06 — D20 background queue 기반: groups에 calendar push 추적 컬럼 추가
--
-- 동작 spec:
--   - confirmed_at NOT NULL AND calendar_pushed_at IS NULL = push 대기 (pg_cron worker 큐 selection 대상)
--   - calendar_pushed_at SET = 모든 멤버 push 완료 (성공)
--   - retry max 3 (calendar_retry_count, _lib/calendar_queue.ts::CALENDAR_PUSH_MAX_RETRY와 동기화)
--   - retry_count = 3 도달 + calendar_pushed_at IS NULL = 영구 fail (groups.partial_fail_list 참조 — D19)
--
-- 관련:
--   - groups.partial_fail_list (0001:209) — 실패 멤버 list (이미 존재)
--   - supabase/functions/_lib/calendar_queue.ts — 순수 함수 (isCalendarPushPending · nextRetryState · buildCalendarEventPayload)
--   - calendar_push_worker Edge Function + pg_cron schedule — S06-worker-integration에서 추가

ALTER TABLE public.groups
  ADD COLUMN calendar_pushed_at TIMESTAMPTZ,
  ADD COLUMN calendar_retry_count INTEGER NOT NULL DEFAULT 0;

-- retry_count 음수 방지 (defensive — _lib/calendar_queue.ts::nextRetryState도 검증)
ALTER TABLE public.groups
  ADD CONSTRAINT groups_calendar_retry_count_nonneg
  CHECK (calendar_retry_count >= 0);

-- Worker가 매 1분 SELECT할 pending 큐: confirmed_at NOT NULL AND calendar_pushed_at IS NULL.
-- partial index로 push 완료된 row를 평소 무시 → 인덱스 크기 ↓ + scan 비용 ↓.
CREATE INDEX groups_calendar_push_pending_idx
  ON public.groups(confirmed_at)
  WHERE confirmed_at IS NOT NULL AND calendar_pushed_at IS NULL;
