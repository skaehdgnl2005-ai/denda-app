-- ============================================================================
-- 된다 (DenDa) — Migration 0016: S15-deeplink schema (D28 자체 deferred deep link)
-- 출처: docs/TASK_BACKLOG.md S15-deeplink, docs/DECISIONS.md D28, docs/ARCHITECTURE.md §3.5
--
-- 책임:
--   1. groups.invite_code CHAR(4) UNIQUE 컬럼 추가 — Universal Link + fingerprint 매칭
--      둘 다 miss 시 사용자가 카톡 메시지에서 본 4자리 코드로 fallback 매칭
--   2. generate_invite_code() SQL function + groups BEFORE INSERT trigger —
--      신규 모임 생성 시 invite_code 자동 채움 (collision retry max 50)
--   3. branch_attributions에 fingerprint 컬럼 3종 추가 (ip_hash, ua_hash, clicked_at) —
--      Universal Link miss 시 IP + UA hash + 시점으로 게스트→회원 매칭
--   4. branch_attributions (group_id, clicked_at DESC) 인덱스 — 매칭 쿼리 최적화
--
-- RLS:
--   - groups: 기존 정책 (0002, 0004) 그대로. invite_code 컬럼 추가만이라 변경 불필요
--   - branch_attributions: 0002에서 RLS ENABLE + 정책 없음 = service_role only.
--     attribution_match Edge Function이 service_role로 처리 — 변경 불필요
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. groups.invite_code CHAR(4) 컬럼 추가
-- ============================================================================

-- nullable로 추가 (기존 row backfill 위해)
ALTER TABLE public.groups
  ADD COLUMN invite_code CHAR(4);

-- UNIQUE constraint (NULL 허용 — 4자리 numeric pool 10000개)
ALTER TABLE public.groups
  ADD CONSTRAINT groups_invite_code_unique UNIQUE (invite_code);

-- 형식 CHECK (4자리 numeric only — TS-level inviteCode.ts와 정합)
ALTER TABLE public.groups
  ADD CONSTRAINT groups_invite_code_format CHECK (
    invite_code IS NULL OR invite_code ~ '^[0-9]{4}$'
  );

-- ============================================================================
-- 2. generate_invite_code() SQL function
--    4자리 numeric "0000" ~ "9999" random + UNIQUE 충돌 회피 (max 50회 retry)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS CHAR(4) AS $$
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
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.generate_invite_code IS 'S15-deeplink (D28): 4자리 numeric invite_code 발급. UNIQUE 충돌 시 max 50회 retry.';

-- ============================================================================
-- 3. groups BEFORE INSERT trigger — invite_code 자동 채움
--    NEW.invite_code IS NULL일 때만 generate (호출자 명시 시 그대로 유지)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_group_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := public.generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER groups_set_invite_code
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_group_invite_code();

-- ============================================================================
-- 4. 기존 groups row backfill (베타 dev DB safety — production은 empty 가정 가능하지만)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.groups WHERE invite_code IS NULL LOOP
    UPDATE public.groups
      SET invite_code = public.generate_invite_code()
      WHERE id = r.id;
  END LOOP;
END $$;

-- backfill 완료 후 NOT NULL 강제
ALTER TABLE public.groups
  ALTER COLUMN invite_code SET NOT NULL;

-- ============================================================================
-- 5. branch_attributions fingerprint 컬럼 추가
--    Universal Link miss 시 IP hash + UA hash + clicked_at으로 매칭
-- ============================================================================

ALTER TABLE public.branch_attributions
  ADD COLUMN ip_hash TEXT,
  ADD COLUMN ua_hash TEXT,
  ADD COLUMN clicked_at TIMESTAMPTZ;

-- 매칭 쿼리 최적화: 같은 group의 최근 클릭들
CREATE INDEX branch_attributions_group_clicked_idx
  ON public.branch_attributions(group_id, clicked_at DESC)
  WHERE clicked_at IS NOT NULL;

-- 매칭 쿼리: WHERE ip_hash = ? AND ua_hash = ? AND clicked_at >= NOW() - INTERVAL '24h'
CREATE INDEX branch_attributions_fingerprint_idx
  ON public.branch_attributions(ip_hash, ua_hash, clicked_at DESC)
  WHERE ip_hash IS NOT NULL AND ua_hash IS NOT NULL;

COMMIT;
