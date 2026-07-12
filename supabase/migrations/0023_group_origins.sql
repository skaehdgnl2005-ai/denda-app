-- ============================================================================
-- 된다 (DenDa) — 0023 group_origins (S-MAP M5, D41)
-- 모임 멤버 각자 출발지 등록 → 중간지점 협업. Q-B23 온디바이스 설계 부분 supersede.
--
-- 보호선:
--   - RLS: 같은 모임 멤버/호스트만 SELECT (D16 is_blocked 통과), 본인 행만 쓰기
--   - self-EXISTS 금지 — 0022 SECURITY DEFINER 헬퍼(is_group_member/is_group_host)만 사용
--   - 모임 삭제 시 ON DELETE CASCADE로 출발지 자동 소거
--   - 멤버 탈퇴/강퇴 시 delete_group_origin_on_leave() 트리거로 소거
--   - UPDATE는 멤버십 재검사 (WITH CHECK) — group_id respoof 방지
--   - 좌표는 클라 normalizeWgs84(D18) 통과 후 저장. DB CHECK는 기본 범위만.
-- ============================================================================

BEGIN;

CREATE TABLE public.group_origins (
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  lat        DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)  -- 1인 1출발지. 수정 = upsert
);

COMMENT ON TABLE public.group_origins IS
  'S-MAP M5 (D41): 중간지점 협업용 멤버 출발지. 모임 멤버에게만 공개, cascade 삭제.';

ALTER TABLE public.group_origins ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 모임 멤버/호스트 + D16 차단 통과
CREATE POLICY group_origins_select_same_group
  ON public.group_origins FOR SELECT
  USING (
    (
      public.is_group_member(group_origins.group_id, auth.uid())
      OR public.is_group_host(group_origins.group_id, auth.uid())
    )
    AND (
      auth.uid() = user_id
      OR NOT public.is_blocked(auth.uid(), user_id)
    )
  );

-- INSERT: 본인 행만 + 해당 모임 멤버/호스트만
CREATE POLICY group_origins_insert_self
  ON public.group_origins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_group_member(group_origins.group_id, auth.uid())
      OR public.is_group_host(group_origins.group_id, auth.uid())
    )
  );

-- UPDATE/DELETE: 본인 행만 + 멤버십 재검사 (group_id respoof 방지)
CREATE POLICY group_origins_update_self
  ON public.group_origins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_group_member(group_origins.group_id, auth.uid())
      OR public.is_group_host(group_origins.group_id, auth.uid())
    )
  );

CREATE POLICY group_origins_delete_self
  ON public.group_origins FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 갱신 (관례: set_updated_at() 함수, 0001_initial 참조)
CREATE TRIGGER group_origins_set_updated_at
  BEFORE UPDATE ON public.group_origins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 탈퇴 시 출발지 소거 (D41): FK cascade는 groups/users 삭제만 커버하므로,
-- group_members DELETE(자진 탈퇴·호스트 강퇴)를 트리거로 보강.
-- SECURITY DEFINER: RLS delete_self 우회 필요 (호스트 강퇴 시 타인 행 삭제).
CREATE OR REPLACE FUNCTION public.delete_group_origin_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.group_origins
  WHERE group_id = OLD.group_id AND user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.delete_group_origin_on_leave IS
  'S-MAP M5 (D41): 모임 탈퇴/강퇴 시 해당 멤버 출발지 자동 소거.';

CREATE TRIGGER group_origins_on_member_leave
  AFTER DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_group_origin_on_leave();

COMMIT;

-- ============================================================================
-- 검증 (Supabase SQL editor에서 push 직후 수동 실행):
--
-- -- 1. 정책 4개 존재 확인
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.group_origins'::regclass;
-- -- Expected: select_same_group / insert_self / update_self / delete_self 4 rows
--
-- -- 2. 트리거 2개 존재 확인 (updated_at + member_leave cascade)
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.group_origins'::regclass;
-- -- Expected: group_origins_set_updated_at, group_origins_on_member_leave 2 rows
--
-- -- 3. anon 접근 차단 (RLS)
-- -- curl -H "apikey:<anon>" "https://<ref>.supabase.co/rest/v1/group_origins?select=*&limit=1"
-- -- Expected: HTTP 200 + []
--
-- -- 4. cascade: 테스트 모임 삭제 → group_origins 행 자동 소거
-- ============================================================================
