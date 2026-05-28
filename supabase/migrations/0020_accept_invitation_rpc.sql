-- ============================================================================
-- 된다 (DenDa) — S22: accept_group_invitation RPC (atomic)
-- 출처: TASK_BACKLOG.md S22 ("인앱 모임 초대 / 합류") — invitations.acceptInvitation prereq
-- 결정 의존: D16 (차단 helper — accept 시점 inviter↔invitee 양방향 차단 차단), D31
--           (차단 호스트 모임 부분 노출 — RLS 0005가 이미 SELECT 단계에서 hide)
--
-- 책임:
--   1. group_invitations row 존재 + 본인이 invitee_id + status='pending' 검증 (FOR UPDATE lock)
--   2. inviter↔invitee 양방향 차단 차단 (수락 직전 차단 가능성)
--   3. group_invitations UPDATE status='accepted'
--   4. group_members INSERT (group_id, invitee) — 이미 멤버면 idempotent (ON CONFLICT DO NOTHING)
--   단일 transaction (plpgsql function) → all-or-nothing
--
-- SECURITY INVOKER 정당화: 두 작업 모두 호출자(invitee=auth.uid()) 기준 RLS 통과
--   (0002 group_invitations_update_invitee[auth.uid()=invitee_id]
--    + 0002 group_members_insert_self[auth.uid()=user_id]). 권한 상승 불필요.
--   p_invitation_id만 인자로, invitee 검증은 auth.uid()로 수행 → 위변조 불가.
--
-- 반환: 합류한 group_id (클라가 navigation push에 사용)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_group_invitation(p_invitation_id UUID)
RETURNS UUID AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_group_id UUID;
  v_inviter UUID;
  v_invitee UUID;
  v_status invitation_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. 초대 row 조회 + 잠금 (동시 accept/reject 경쟁 차단)
  SELECT group_id, inviter_id, invitee_id, status
    INTO v_group_id, v_inviter, v_invitee, v_status
    FROM public.group_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF v_invitee <> v_caller THEN
    RAISE EXCEPTION 'not_invitee';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'invitation_not_pending';
  END IF;

  -- 2. 양방향 차단 시 거부
  IF public.is_blocked(v_inviter, v_invitee) OR public.is_blocked(v_invitee, v_inviter) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- 3. group_invitations UPDATE → accepted
  UPDATE public.group_invitations
    SET status = 'accepted'
    WHERE id = p_invitation_id;

  -- 4. group_members INSERT (idempotent — 이미 멤버면 no-op)
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group_id, v_invitee)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMENT ON FUNCTION public.accept_group_invitation IS 'S22: group_invitations UPDATE accepted + group_members INSERT 원자적. invitee=auth.uid() 검증. 양방향 차단 차단(D16).';

REVOKE ALL ON FUNCTION public.accept_group_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(UUID) TO authenticated;
