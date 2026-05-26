-- ============================================================================
-- 된다 (DenDa) — S07-block-supabase: block_user RPC (atomic cascade)
-- 출처: docs/SESSION_LOG.md (S07-report, 2026-05-26) "Next: S07-block-supabase"
-- 결정 의존: D16 (차단 helper). is_blocked는 0001:94 SELECT 시점에만 작동 — INSERT 정합성은 본 RPC가 담당
--
-- 책임:
--   1. blocks INSERT (idempotent — PK conflict 무시)
--   2. friendships 양방향 DELETE (대칭 — 두 row 모두 정리)
--   3. friend_requests 양방향 DELETE (양쪽 pending request 모두 정리)
--   단일 transaction (plpgsql function = single tx) → all-or-nothing
--
-- SECURITY DEFINER 정당화: friendships/friend_requests의 RLS DELETE policy는 본인 row만 허용.
--   양방향 정리에는 상대방 row도 삭제해야 함 → SECURITY DEFINER + auth.uid()로 호출자 검증.
--   p_target_id는 인자로만, 호출자(blocker)는 auth.uid()에서 추출 → 위변조 불가.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.block_user(p_target_id UUID)
RETURNS VOID AS $$
DECLARE
  v_blocker_id UUID := auth.uid();
BEGIN
  IF v_blocker_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_blocker_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot block self';
  END IF;

  -- 1. blocks INSERT (PK = (blocker_id, blocked_id) → 중복 차단 호출 idempotent)
  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (v_blocker_id, p_target_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- 2. friendships 양방향 cascade (대칭 두 row 모두 — 0001:106 주석 참조)
  DELETE FROM public.friendships
  WHERE (user_id = v_blocker_id AND friend_id = p_target_id)
     OR (user_id = p_target_id AND friend_id = v_blocker_id);

  -- 3. friend_requests 양방향 cascade (pending request 양쪽 모두)
  DELETE FROM public.friend_requests
  WHERE (from_user_id = v_blocker_id AND to_user_id = p_target_id)
     OR (from_user_id = p_target_id AND to_user_id = v_blocker_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.block_user IS 'S07-block-supabase: blocks INSERT (idempotent) + friendships/friend_requests 양방향 cascade DELETE. atomic transaction. SECURITY DEFINER로 상대방 row 삭제 권한 위임.';

-- 권한: authenticated 사용자만 호출 가능 (anon 차단)
REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;
