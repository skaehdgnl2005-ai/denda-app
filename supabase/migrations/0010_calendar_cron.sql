-- 0010_calendar_cron.sql — S06 D20 background queue: pg_cron이 매 1분 calendar_push_worker 호출
--
-- 의존:
--   - 0009: groups.calendar_pushed_at + calendar_retry_count + partial index
--   - GUC: app.supabase_url, app.service_role_key 사전 설정 필요 (0006 patternmirror)
--       ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--       ALTER DATABASE postgres SET app.service_role_key = '<service_role_jwt>';
--   - extension pg_cron + pg_net (Supabase 기본 활성)
--
-- 동작:
--   - 매 1분 net.http_post로 calendar_push_worker Edge Function 호출
--   - Worker가 isCalendarPushPending 통과 row를 SELECT 후 fan-out (D20 background queue + retry max 3)
--   - GUC 미설정 시 schedule entry 자체는 등록되지만 net.http_post는 WHERE 절로 자연 skip

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 기존 schedule 제거 후 등록 (idempotent — 재실행 안전)
DO $$
DECLARE
  v_existing_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_existing_job_id
  FROM cron.job WHERE jobname = 'calendar_push_worker_tick';
  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'calendar_push_worker_tick',
  '*/1 * * * *',  -- 매 1분
  $cron$
    SELECT net.http_post(
      url := v.url || '/functions/v1/calendar_push_worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v.key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    FROM (
      SELECT
        current_setting('app.supabase_url', true) AS url,
        current_setting('app.service_role_key', true) AS key
    ) v
    WHERE v.url IS NOT NULL AND v.url <> ''
      AND v.key IS NOT NULL AND v.key <> '';
  $cron$
);

COMMENT ON EXTENSION pg_cron IS
  'S06: calendar_push_worker_tick — 매 1분 calendar_push_worker Edge Function 호출 (D20 background queue)';

-- ---------------------------------------------------------------------------
-- 운영 NOTE
--   - 본 schedule은 SQL level에서 GUC missing → fire 안 함 (WHERE 절). schedule entry는 등록.
--   - Worker 자체는 Edge Function이 60s timeout. 1분 주기와 worker 처리 시간 겹치면 두 instance 동시 실행 가능
--     → worker가 idempotent (UPDATE WHERE calendar_pushed_at IS NULL + atomic retry_count UPDATE)이라 OK.
--   - retry max 3 도달 후에도 calendar_pushed_at IS NULL이면 worker가 selectPendingFromRows에서 자연 제외
--     (calendar_retry_count < 3 조건). → 무한 polling 회피.
--   - 모니터링: cron.job_run_details 테이블 + net._http_response 테이블 (status_code IS NULL = 실패).
-- ---------------------------------------------------------------------------
