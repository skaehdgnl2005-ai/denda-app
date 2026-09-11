-- 0015_reset_calendar_retry.sql
-- Fail #9: retry_count max(3) 초과로 영구 stall된 calendar push row 복구 RPC.
--
-- 배경:
--   - S06 worker는 calendar_retry_count >= 3 row를 영구 skip (0009 partial index 빠른 lookup)
--   - 사용자가 ReauthModal로 user_oauth_tokens 복원해도 worker가 안 건드려 영구 fail 잔여
--   - SESSION_LOG S06-ui-reauth-modal Notes (line 212): "retry_count max(3) 초과한 row는 영구 stall — reset RPC 후속 sub-task로 검토"
--
-- 동작:
--   - 본인이 group_member인 모든 group 중 (calendar_pushed_at IS NULL AND calendar_retry_count >= 3) reset
--   - SECURITY DEFINER + auth.uid() 검증으로 본인 group만
--   - 반환값: reset된 row 수 (UI 토스트용)
--
-- 호출 시점:
--   - ReauthModal.tsx signInGoogleAndUpload 성공 후 자동 호출
--   - 다음 worker tick(1분 이내)에서 자동 재시도

CREATE OR REPLACE FUNCTION public.reset_my_stalled_calendar_retries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_count INTEGER;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  WITH updated AS (
    UPDATE public.groups g
    SET calendar_retry_count = 0
    FROM public.group_members gm
    WHERE g.id = gm.group_id
      AND gm.user_id = v_caller
      AND g.calendar_pushed_at IS NULL
      AND g.calendar_retry_count >= 3
    RETURNING g.id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_my_stalled_calendar_retries FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_my_stalled_calendar_retries TO authenticated;
