-- ============================================================================
-- 된다 (DenDa) — RLS Policies (Phase 1+2 skeleton)
-- 출처: docs/ARCHITECTURE.md (§3-§4), docs/DECISIONS.md
-- 결정 의존: D16 (is_blocked helper 모든 SELECT 통과)
-- 구조: auth.uid() = public.users.id (Supabase Auth 1:1 매핑 — D29 OIDC trigger)
--
-- 패턴:
--   SELECT: 본인 + (is_blocked 통과)
--   INSERT: 본인
--   UPDATE/DELETE: 본인 또는 호스트
-- ============================================================================

-- ============================================================================
-- users
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_visible
  ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR NOT public.is_blocked(auth.uid(), id)
  );

CREATE POLICY users_update_self
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT는 handle_new_auth_user 트리거(SECURITY DEFINER)가 처리. 클라이언트 INSERT 금지.

-- ============================================================================
-- blocks (차단 — 본인만 조회·추가·해제)
-- ============================================================================

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocks_select_self
  ON public.blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY blocks_insert_self
  ON public.blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY blocks_delete_self
  ON public.blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- ============================================================================
-- friendships
-- ============================================================================

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY friendships_select_involving_self
  ON public.friendships FOR SELECT
  USING (
    (auth.uid() = user_id OR auth.uid() = friend_id)
    AND NOT public.is_blocked(auth.uid(), CASE WHEN auth.uid() = user_id THEN friend_id ELSE user_id END)
  );

CREATE POLICY friendships_insert_self
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY friendships_delete_self
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================================================
-- friend_requests
-- ============================================================================

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY friend_requests_select_involving_self
  ON public.friend_requests FOR SELECT
  USING (
    (auth.uid() = from_user_id OR auth.uid() = to_user_id)
    AND NOT public.is_blocked(auth.uid(), CASE WHEN auth.uid() = from_user_id THEN to_user_id ELSE from_user_id END)
  );

CREATE POLICY friend_requests_insert_self
  ON public.friend_requests FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND NOT public.is_blocked(from_user_id, to_user_id)
  );

CREATE POLICY friend_requests_update_recipient
  ON public.friend_requests FOR UPDATE
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- ============================================================================
-- partnerships (Phase 1+2 read-only: 클라이언트는 read만, service_role만 write)
-- ============================================================================

ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY partnerships_select_all
  ON public.partnerships FOR SELECT
  USING (status = 'signed');

-- INSERT/UPDATE/DELETE는 service_role bypass RLS

-- ============================================================================
-- places (공개 — 검색 + 모임 멤버 추가 가능)
-- ============================================================================

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

CREATE POLICY places_select_all
  ON public.places FOR SELECT
  USING (TRUE);

CREATE POLICY places_insert_authenticated
  ON public.places FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE/DELETE는 service_role bypass

-- ============================================================================
-- groups
-- ============================================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_select_member_or_host
  ON public.groups FOR SELECT
  USING (
    auth.uid() = host_id
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id AND user_id = auth.uid()
    )
  );

CREATE POLICY groups_insert_as_host
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY groups_update_host
  ON public.groups FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY groups_delete_host
  ON public.groups FOR DELETE
  USING (auth.uid() = host_id);

-- ============================================================================
-- group_members
-- ============================================================================

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_members_select_same_group
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members AS my
      WHERE my.group_id = group_members.group_id AND my.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id AND groups.host_id = auth.uid()
    )
  );

CREATE POLICY group_members_insert_self
  ON public.group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY group_members_delete_self_or_host
  ON public.group_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id AND groups.host_id = auth.uid()
    )
  );

-- ============================================================================
-- group_guests (게스트 토큰 기반 — 인증 사용자는 조회만)
-- ============================================================================

ALTER TABLE public.group_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_guests_select_same_group
  ON public.group_guests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_guests.group_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_guests.group_id AND host_id = auth.uid()
    )
  );

-- INSERT/UPDATE는 Edge Function (service_role)이 게스트 토큰 검증 후 처리

-- ============================================================================
-- group_invitations
-- ============================================================================

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_invitations_select_involving_self
  ON public.group_invitations FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY group_invitations_insert_as_inviter
  ON public.group_invitations FOR INSERT
  WITH CHECK (
    auth.uid() = inviter_id
    AND NOT public.is_blocked(inviter_id, invitee_id)
  );

CREATE POLICY group_invitations_update_invitee
  ON public.group_invitations FOR UPDATE
  USING (auth.uid() = invitee_id)
  WITH CHECK (auth.uid() = invitee_id);

-- ============================================================================
-- votes (모임 멤버는 같은 그룹의 모든 votes 조회. INSERT는 본인만)
-- ============================================================================

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY votes_select_same_group
  ON public.votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = votes.group_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = votes.group_id AND host_id = auth.uid()
    )
  );

CREATE POLICY votes_insert_self
  ON public.votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY votes_update_self
  ON public.votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY votes_delete_self
  ON public.votes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- schedules (개인 일정 — 본인만)
-- ============================================================================

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedules_select_self
  ON public.schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY schedules_insert_self
  ON public.schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY schedules_update_self
  ON public.schedules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY schedules_delete_self
  ON public.schedules FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- comments
-- ============================================================================

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select_same_group
  ON public.comments FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = comments.group_id AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = comments.group_id AND host_id = auth.uid()
      )
    )
    AND NOT public.is_blocked(auth.uid(), comments.user_id)
  );

CREATE POLICY comments_insert_self_in_group
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = comments.group_id AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = comments.group_id AND host_id = auth.uid()
      )
    )
  );

CREATE POLICY comments_delete_self
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- push_tokens
-- ============================================================================

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_select_self
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY push_tokens_insert_self
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_tokens_update_self
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_tokens_delete_self
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- notification_settings
-- ============================================================================

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_settings_select_self
  ON public.notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY notification_settings_update_self
  ON public.notification_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT는 handle_new_auth_user 트리거가 처리

-- ============================================================================
-- reports (본인이 작성한 신고만 조회. 처리는 운영팀 service_role)
-- ============================================================================

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_select_own
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY reports_insert_self
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================================================
-- branch_attributions (보안 민감 — service_role only)
-- 클라이언트는 직접 read/write 불가. Edge Function이 처리.
-- ============================================================================

ALTER TABLE public.branch_attributions ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = 모든 client 접근 차단 (service_role만 bypass)

-- ============================================================================
-- Realtime publication (D11: Edge Function이 broadcast — table replication X)
-- votes는 Edge Function이 합산 후 channel.send()로 broadcast.
-- 즉 publication에 추가하지 않음. 필요 시 별도 channel 패턴.
-- ============================================================================

-- 의도적으로 supabase_realtime publication에 table 추가하지 않음 (D11)
-- (예시: ALTER PUBLICATION supabase_realtime ADD TABLE public.votes — 사용 안 함)
