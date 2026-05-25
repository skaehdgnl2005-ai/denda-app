-- 0005_group_invitations_blocking.sql — D16 propagation gap fix (group_invitations SELECT)
-- 현재 group_invitations_select_involving_self은 is_blocked 체크 누락 → 차단한 사용자의 초대도 노출됨
-- 0002:215-216 보강. INSERT policy(0002:218-223)는 이미 is_blocked 체크 포함 → 변경 없음.

DROP POLICY IF EXISTS group_invitations_select_involving_self ON public.group_invitations;

CREATE POLICY group_invitations_select_involving_self
  ON public.group_invitations FOR SELECT
  USING (
    (auth.uid() = inviter_id OR auth.uid() = invitee_id)
    AND NOT public.is_blocked(
      auth.uid(),
      CASE WHEN auth.uid() = inviter_id THEN invitee_id ELSE inviter_id END
    )
  );

COMMENT ON POLICY group_invitations_select_involving_self ON public.group_invitations IS
  'D16: 본인 관련 초대만 + 양방향 차단 체크 (0002:215-216 보강)';
