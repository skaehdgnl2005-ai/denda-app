-- 0006_votes_aggregate_trigger.sql — D11 votes INSERT/UPDATE/DELETE → Edge Function
--
-- 트리거: votes 변경 → PL/pgSQL 함수 → pg_net.http_post → votes_aggregate Edge Function
--         → group:${group_id} 채널에 heatmap_update broadcast.
--
-- D11 본문: 클라이언트 raw votes 합산 금지. Edge가 합산 후 broadcast.
-- D12: 클라이언트는 channel listen → useSharedValue 업데이트.
-- Edge가 매 호출 idempotent (SELECT + broadcast)이므로 SQL debounce 불필요.
--
-- ⚠️ SECRET HANDLING
--   - 실제 deploy 전에 Supabase Postgres의 GUC 또는 vault에 다음을 set:
--       ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--       ALTER DATABASE postgres SET app.service_role_key = '<service_role_jwt>';
--     (또는 vault.read('supabase_url') / vault.read('service_role_key') 패턴.
--      Supabase Vault: https://supabase.com/docs/guides/database/vault)
--   - 이 마이그레이션은 URL/key를 hardcode하지 않는다. current_setting()으로 lazy read.
--   - GUC 미설정 시 trigger는 silent skip (warning) — 개발 환경에서 Edge Function 미가동 시 INSERT가 깨지지 않도록.

-- pg_net extension (Supabase 기본 제공, 명시적으로 보장)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Trigger function: notify_votes_aggregate
--   - INSERT/UPDATE: NEW.group_id 사용
--   - DELETE: OLD.group_id 사용
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_votes_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_group_id UUID;
  v_url TEXT;
  v_key TEXT;
  v_endpoint TEXT;
BEGIN
  -- group_id 추출 (DELETE는 OLD, 그 외는 NEW)
  IF TG_OP = 'DELETE' THEN
    v_group_id := OLD.group_id;
  ELSE
    v_group_id := NEW.group_id;
  END IF;

  -- Supabase URL · service_role key 읽기 (GUC, missing_ok=true)
  -- TODO: vault.read() 패턴으로 교체 가능 — production에서는 vault 권장.
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.service_role_key', true);

  -- GUC 미설정 (local dev 등) → silent skip. votes INSERT/UPDATE/DELETE 자체는 성공.
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'notify_votes_aggregate: app.supabase_url / app.service_role_key not set — skip broadcast (group_id=%)', v_group_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_endpoint := v_url || '/functions/v1/votes_aggregate';

  -- pg_net 비동기 HTTP POST (fire-and-forget)
  PERFORM net.http_post(
    url := v_endpoint,
    body := jsonb_build_object('group_id', v_group_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    timeout_milliseconds := 5000
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.notify_votes_aggregate IS
  'D11: votes 변경 → votes_aggregate Edge Function 호출 → group:${group_id} 채널 broadcast. GUC 미설정 시 skip.';

-- ---------------------------------------------------------------------------
-- Trigger: AFTER INSERT/UPDATE/DELETE ON votes FOR EACH ROW
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS votes_aggregate_notify ON public.votes;

CREATE TRIGGER votes_aggregate_notify
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_votes_aggregate();

-- ---------------------------------------------------------------------------
-- 운영 NOTE
--   - pg_net 실패 (Edge down) → net.http_post는 비동기이므로 vote INSERT는 영향 없음.
--     실패 요청은 net._http_response 테이블에 status_code=null 로 기록 → 모니터링.
--   - 빈번한 votes 폭주 시 pg_net queue가 쌓일 수 있음. Edge가 idempotent이므로
--     중복 broadcast OK. 필요 시 후속 task에서 statement-level + debounce 도입.
--   - 본 trigger는 row-level: drag sweep 1회당 N rows INSERT 시 N회 호출됨.
--     클라이언트(D12)에서 drag 종료 시 1회 commit하므로 실제 호출 수는 제한적.
-- ---------------------------------------------------------------------------
