-- ============================================================================
-- 된다 (DenDa) — S18: create_group RPC (atomic group + host member)
-- 출처: docs/superpowers/specs/2026-05-28-journey-spine-roadmap-design.md (S18)
--       docs/superpowers/plans/2026-05-28-journey-spine-s18-s19.md (Task 2)
--
-- 책임: groups INSERT + 호스트 본인 group_members INSERT를 단일 transaction으로 처리.
--   plpgsql function = single tx → all-or-nothing (멤버 INSERT 실패 시 orphan group 방지).
--   invite_code는 0016(groups_set_invite_code) BEFORE INSERT 트리거가 자동 채움.
--
-- SECURITY INVOKER 정당화: 두 INSERT 모두 호출자(host=auth.uid) 기준 RLS 통과
--   (0002: groups_insert_as_host[host_id=auth.uid] + group_members_insert_self[user_id=auth.uid]).
--   권한 상승 불필요 → INVOKER가 안전. host_id는 인자가 아닌 auth.uid()에서 추출 → 위변조 불가.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_group(p_name TEXT, p_dates DATE[])
RETURNS UUID AS $$
DECLARE
  v_host_id UUID := auth.uid();
  v_group_id UUID;
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Group name required';
  END IF;
  IF p_dates IS NULL OR array_length(p_dates, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one date required';
  END IF;

  -- 1. groups INSERT (invite_code는 0016 BEFORE INSERT 트리거가 자동 채움)
  INSERT INTO public.groups (host_id, name, dates)
  VALUES (v_host_id, btrim(p_name), p_dates)
  RETURNING id INTO v_group_id;

  -- 2. 호스트 본인을 group_members에 추가 (RLS group_members_insert_self 통과)
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group_id, v_host_id);

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMENT ON FUNCTION public.create_group IS 'S18: groups + 호스트 group_members 원자적 생성. host_id=auth.uid(). invite_code는 0016 트리거 자동.';

-- 권한: authenticated 사용자만 호출 가능 (anon 차단)
REVOKE ALL ON FUNCTION public.create_group(TEXT, DATE[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT, DATE[]) TO authenticated;
