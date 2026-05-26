-- ============================================================================
-- 된다 (DenDa) — D16 propagation audit (S07-d16-audit)
-- 출처: docs/SESSION_LOG.md (S07-backend, 2026-05-26) "Next: D16 propagation audit"
-- 결정 의존: D16 (is_blocked helper 모든 SELECT 통과)
--
-- Audit 결과 (0002 RLS 대비):
--   - group_members SELECT  → is_blocked 누락 ★ D16 명시 ("모임 멤버") 위반 → 보강
--   - votes SELECT          → is_blocked 누락 (Edge Function 우회 + RLS hardening) → 보강
--   - groups SELECT (host)  → UX 결정 필요 (멤버십 연속성 vs 차단 강도) → Q-A8로 등록, 본 migration 변경 없음
--
-- 패턴: DROP POLICY IF EXISTS → CREATE POLICY (PostgreSQL은 정책 ALTER USING 미지원)
-- Self exception: 본인 멤버십·투표는 항상 보여야 → `auth.uid() = user_id OR NOT is_blocked(...)`
-- ============================================================================

-- ============================================================================
-- group_members SELECT — 차단된 사용자 멤버는 차단자(viewer)에게 숨김
-- D16 명시: "모임 멤버" 통과
-- ============================================================================

DROP POLICY IF EXISTS group_members_select_same_group ON public.group_members;

CREATE POLICY group_members_select_same_group
  ON public.group_members FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.group_members AS my
        WHERE my.group_id = group_members.group_id AND my.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups
        WHERE groups.id = group_members.group_id AND groups.host_id = auth.uid()
      )
    )
    AND (
      auth.uid() = user_id
      OR NOT public.is_blocked(auth.uid(), user_id)
    )
  );

-- ============================================================================
-- votes SELECT — 차단된 사용자의 vote는 raw로도 차단자에게 숨김
-- D11 (Edge Function 합산 + broadcast)이 raw vote 클라이언트 합산을 금지하지만,
-- service_role bypass 외 모든 SELECT path를 hardening
-- ============================================================================

DROP POLICY IF EXISTS votes_select_same_group ON public.votes;

CREATE POLICY votes_select_same_group
  ON public.votes FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = votes.group_id AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = votes.group_id AND host_id = auth.uid()
      )
    )
    AND (
      auth.uid() = user_id
      OR NOT public.is_blocked(auth.uid(), user_id)
    )
  );

-- ============================================================================
-- Audit out-of-scope (변경 없음, 의도 기록)
--   - groups SELECT host_id 차단    → Q-A8 (UX 결정 대기) — 멤버십 연속성 우선 권고
--   - group_guests SELECT           → 게스트는 user_id 없음(닉네임만), is_blocked 적용 불가
--   - schedules / push_tokens / notification_settings / reports SELECT
--                                   → 모두 self only, is_blocked 적용 불요
--   - users SELECT / friendships / friend_requests / comments / group_invitations(0005)
--                                   → 이미 is_blocked 통과 (0002 또는 0005)
-- ============================================================================
