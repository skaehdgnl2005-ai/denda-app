-- ============================================================================
-- 된다 (DenDa) — Migration 0004: Web Guest RLS & RPC
-- 이 마이그레이션은 웹 게스트 페이지(S14)의 anonymous access를 지원하기 위해
-- groups, group_guests, votes 테이블에 RLS 정책을 추가하고,
-- 게스트가 본인의 투표를 안전하게 저장할 수 있는 SECURITY DEFINER RPC를 정의합니다.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. public.groups 테이블 RLS 추가 정책
-- anonymous 사용자가 group_id를 아는 경우 모임 상세 정보를 SELECT 할 수 있도록 허용합니다.
-- ============================================================================
CREATE POLICY groups_select_anon
  ON public.groups FOR SELECT
  USING (true);

-- ============================================================================
-- 2. public.group_guests 테이블 RLS 추가 정책
-- anonymous 사용자가 group_id를 아는 경우 참여한 게스트 목록을 SELECT 할 수 있게 하고,
-- 신규 게스트(닉네임 입력)를 등록(INSERT)할 수 있도록 허용합니다.
-- ============================================================================
CREATE POLICY group_guests_select_anon
  ON public.group_guests FOR SELECT
  USING (true);

CREATE POLICY group_guests_insert_anon
  ON public.group_guests FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 3. public.votes 테이블 RLS 추가 정책
-- anonymous 사용자가 실시간 히트맵 렌더링을 위해 다른 이들의 votes를 SELECT 할 수 있게 허용합니다.
-- direct INSERT/UPDATE/DELETE는 차단하고 save_guest_votes RPC를 사용하도록 유도합니다.
-- ============================================================================
CREATE POLICY votes_select_anon
  ON public.votes FOR SELECT
  USING (true);

-- ============================================================================
-- 4. save_guest_votes SECURITY DEFINER 함수 정의
-- 게스트가 본인의 guest_token을 전달해 투표를 저장(delete & insert)할 때 사용됩니다.
-- SECURITY DEFINER로 실행되므로 RLS를 우회하되, 함수 내부에서 guest_token이
-- 해당 group_id에 속하는지 엄격히 검증하여 다른 사람의 투표를 수정하는 것을 방지합니다.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_guest_votes(
  p_group_id UUID,
  p_guest_token UUID,
  p_votes JSONB
)
RETURNS VOID AS $$
DECLARE
  v_exists BOOLEAN;
  v_vote RECORD;
BEGIN
  -- A. 전달받은 guest_token이 해당 group_id의 유효한 게스트인지 검증
  SELECT EXISTS(
    SELECT 1 FROM public.group_guests
    WHERE guest_token = p_guest_token AND group_id = p_group_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION '유효하지 않은 게스트 토큰입니다. 이 모임의 게스트가 아닙니다.';
  END IF;

  -- B. 기존 투표 정보 삭제 (해당 guest_token에 매칭되는 행만 삭제)
  DELETE FROM public.votes
  WHERE guest_token = p_guest_token;

  -- C. 신규 투표 정보 삽입 (JSONB array parsing)
  FOR v_vote IN SELECT * FROM jsonb_to_recordset(p_votes) AS x(day DATE, start_minute INT, end_minute INT) LOOP
    INSERT INTO public.votes (group_id, guest_token, day, start_minute, end_minute)
    VALUES (p_group_id, p_guest_token, v_vote.day, v_vote.start_minute, v_vote.end_minute);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.save_guest_votes IS
  'S14 Web Guest: 게스트 투표 저장용 RPC. 해당 guest_token의 기존 투표 삭제 후 신규 일괄 삽입.';

COMMIT;
