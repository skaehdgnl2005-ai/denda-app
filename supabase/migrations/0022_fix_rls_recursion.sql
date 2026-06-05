-- ============================================================================
-- 된다 (DenDa) — Fix RLS infinite recursion (0002 + 0007 latent bug surface)
-- 출처: 2026-06-05 디버깅 — 사용자 모임 생성 실패. 0016 BEFORE INSERT trigger
--   set_group_invite_code가 generate_invite_code() 호출 → SELECT FROM groups →
--   groups_select_member_or_host RLS → EXISTS (SELECT FROM group_members) →
--   group_members_select_same_group RLS USING 안에 EXISTS (SELECT FROM group_members AS my) →
--   같은 RLS 정책이 자기 자신을 재참조 → PostgreSQL 42P17 무한 재귀.
--
-- 이 버그는 0002 day-1부터 latent했음. 0007 D16 propagation audit 시 self-EXISTS
-- 패턴을 그대로 두고 is_blocked AND만 추가했기에 재귀 그대로. push 전엔 trigger
-- (0016)가 미배포라 미발화. push 직후 첫 모임 생성에서 즉시 발화.
--
-- 처치: PostgreSQL RLS 표준 패턴 — SECURITY DEFINER 헬퍼로 self-table EXISTS를
--   감싸 정책 평가 시 RLS 재진입을 차단.
--   - is_group_member(group_id, user_id) helper (NEW)
--   - is_group_host(group_id, user_id) helper (NEW)
--   - groups_select_member_or_host 재작성 → 헬퍼 사용
--   - group_members_select_same_group 재작성 → 헬퍼 사용 + D16(is_blocked) 유지
--   - generate_invite_code() SECURITY DEFINER 추가 (방어 1중복 — helper만으로도 unblock 되지만 함수 자체도 RLS 회피해 미래 회귀 차단)
--
-- 다른 정책 영향:
--   - votes_select_same_group / group_guests_select_same_group / comments_select_same_group /
--     comments_insert_self_in_group / group_members_delete_self_or_host
--     → EXISTS (SELECT FROM group_members) 사용하지만 outer policy가 다른 테이블이라
--       group_members policy를 *호출*. 호출된 group_members policy가 helper로 변경되어
--       내부에선 추가 RLS 진입 없음 → 자연 해소.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SECURITY DEFINER 헬퍼 — RLS 재진입 차단용
--    오너 = postgres (superuser) → BYPASS RLS → 안전
--    SET search_path = public 으로 search_path 공격 방어
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_group_member IS
  'RLS 재귀 차단용 헬퍼 (0022). SECURITY DEFINER로 group_members RLS 회피. group_members_select_same_group + groups_select_member_or_host에서 사용.';

CREATE OR REPLACE FUNCTION public.is_group_host(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = p_group_id AND host_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_group_host IS
  'RLS 재귀 차단용 헬퍼 (0022). SECURITY DEFINER로 groups RLS 회피. group_members_select_same_group에서 사용.';

-- ============================================================================
-- 2. groups_select_member_or_host 재작성 (헬퍼 사용)
--    원본 (0002): EXISTS (SELECT FROM group_members) → group_members RLS 재진입.
--    수정: is_group_member(SECURITY DEFINER) → RLS 회피.
-- ============================================================================

DROP POLICY IF EXISTS groups_select_member_or_host ON public.groups;

CREATE POLICY groups_select_member_or_host
  ON public.groups FOR SELECT
  USING (
    auth.uid() = host_id
    OR public.is_group_member(groups.id, auth.uid())
  );

-- ============================================================================
-- 3. group_members_select_same_group 재작성 (헬퍼 사용 + D16 유지)
--    원본 (0007): EXISTS (SELECT FROM group_members AS my) ← self-recursion source
--                + EXISTS (SELECT FROM groups) AND NOT is_blocked
--    수정: 두 EXISTS 모두 헬퍼로 교체. D16 is_blocked AND절 유지.
-- ============================================================================

DROP POLICY IF EXISTS group_members_select_same_group ON public.group_members;

CREATE POLICY group_members_select_same_group
  ON public.group_members FOR SELECT
  USING (
    (
      public.is_group_member(group_members.group_id, auth.uid())
      OR public.is_group_host(group_members.group_id, auth.uid())
    )
    AND (
      auth.uid() = user_id
      OR NOT public.is_blocked(auth.uid(), user_id)
    )
  );

-- ============================================================================
-- 4. generate_invite_code() SECURITY DEFINER 추가
--    0016 trigger가 호출 시 함수 내부 SELECT가 groups RLS를 발화하지 않도록.
--    헬퍼 fix만으로도 recursion은 해소되지만, 함수 자체도 SECURITY DEFINER로
--    RLS 회피해 미래 정책 변경 시 회귀 방어 (defense in depth).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS CHAR(4)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code CHAR(4);
  v_attempts INT := 0;
  v_max_attempts INT := 50;
BEGIN
  LOOP
    v_code := lpad(floor(random() * 10000)::INT::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.groups WHERE invite_code = v_code
    );
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Invite code generation failed: collision retry exhausted (% attempts). invite_code pool nearly full.', v_max_attempts;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION public.generate_invite_code IS
  'S15-deeplink (D28): 4자리 numeric invite_code 발급. 0022에서 SECURITY DEFINER 추가 (RLS 회피, recursion defense in depth).';

COMMIT;

-- ============================================================================
-- 검증 (psql 또는 Supabase SQL editor에서 수동 실행 — push 직후):
--
-- -- 1. 헬퍼 존재 + DEFINER 확인
-- SELECT proname, prosecdef
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('is_group_member','is_group_host','generate_invite_code');
-- -- Expected: 3 rows, prosecdef=true 모두
--
-- -- 2. 정책 재작성 확인
-- SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
-- FROM pg_policy
-- WHERE polrelid = 'public.group_members'::regclass
--   AND polname = 'group_members_select_same_group';
-- -- Expected: using_expr 안에 is_group_member, is_group_host 호출
--
-- -- 3. 수동 SELECT 테스트 (anon — 더 이상 42P17 안 나야 함)
-- -- curl로:
-- --   curl -H "apikey:..." -H "Authorization:Bearer ..." \\
-- --     "https://<ref>.supabase.co/rest/v1/groups?select=invite_code&limit=0"
-- -- Expected: HTTP 200 + 빈 array []  (anon은 호스트도 멤버도 아니라 0 row 반환)
-- ============================================================================
