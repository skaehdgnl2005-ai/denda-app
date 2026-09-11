-- ============================================================================
-- 된다 (DenDa) — S21: accept_friend_request RPC (atomic)
-- 출처: TASK_BACKLOG.md S21 ("친구 시스템 실DB 전환") — friends/api.ts supabase 교체 prereq
-- 결정 의존: D16 (차단 helper — accept 시점 양방향 차단 차단), 0001 friendships 대칭(두 row), 0001 friend_requests status enum
--
-- 책임:
--   1. friend_requests row 존재 + 본인이 to_user_id + status='pending' 검증
--   2. 양방향 차단 차단 (수락 직전 누군가 차단했을 가능성)
--   3. friend_requests UPDATE status='accepted'
--   4. friendships INSERT 두 row (대칭, ON CONFLICT DO NOTHING)
--   단일 transaction (plpgsql function) → all-or-nothing
--
-- SECURITY DEFINER 정당화: friendships RLS INSERT는 user_id=auth.uid()만 허용.
--   대칭 양방향 INSERT에는 상대방 user_id row도 INSERT해야 함 → SECURITY DEFINER + auth.uid() 검증으로 위임.
--   p_request_id만 인자로, 호출자 검증은 auth.uid()로 수행 → 위변조 불가.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_from UUID;
  v_to UUID;
  v_status friend_request_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. friend_request 조회 + 잠금 (동시 accept/reject 경쟁 차단)
  SELECT from_user_id, to_user_id, status
    INTO v_from, v_to, v_status
    FROM public.friend_requests
    WHERE id = p_request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'friend_request_not_found';
  END IF;

  IF v_to <> v_caller THEN
    RAISE EXCEPTION 'not_recipient';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  -- 2. 양방향 차단 시 거부 (수락 직전 차단된 경우)
  IF public.is_blocked(v_from, v_to) OR public.is_blocked(v_to, v_from) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- 3. friend_requests UPDATE → accepted
  UPDATE public.friend_requests
    SET status = 'accepted'
    WHERE id = p_request_id;

  -- 4. friendships 대칭 INSERT (두 row, idempotent)
  INSERT INTO public.friendships (user_id, friend_id)
  VALUES (v_from, v_to), (v_to, v_from)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.accept_friend_request IS 'S21: friend_requests UPDATE accepted + friendships 대칭 INSERT. atomic. SECURITY DEFINER로 양방향 friendships INSERT 권한 위임.';

REVOKE ALL ON FUNCTION public.accept_friend_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(UUID) TO authenticated;
