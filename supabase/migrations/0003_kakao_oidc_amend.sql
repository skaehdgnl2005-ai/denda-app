-- ============================================================================
-- 된다 (DenDa) — Migration 0003: Kakao OIDC amend (D29 supersede D21)
-- 출처: docs/superpowers/specs/2026-05-22-kakao-oidc-design.md
-- 결정 의존: D29 (Kakao OIDC + Supabase signInWithIdToken)
--
-- 변경 사항:
--   1. public.users.synthetic_email 컬럼 DROP (D21 잔재)
--   2. public.users.email 컬럼 ADD (nullable, Phase 3 비즈앱 후 채움)
--   3. handle_new_auth_user trigger 함수 재작성
--      - kakao_id = raw_user_meta_data->>'sub' (OIDC standard claim)
--      - nickname = raw_user_meta_data->>'nickname'/'name' fallback chain
--      - email = NEW.email (베타는 null, Phase 3에서 자동 채워짐)
--      - profile_image_url = raw_user_meta_data->>'picture'
--
-- 안전성:
--   S00 (0001_initial) 적용 후 user 데이터 없음 (2026-05-22 same day) →
--   synthetic_email DROP은 데이터 손실 없음. Production user 0명 가정.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. users.synthetic_email DROP + email ADD
-- ============================================================================

-- UNIQUE constraint와 NOT NULL이 함께 정의된 컬럼이므로 그대로 DROP
ALTER TABLE public.users DROP COLUMN IF EXISTS synthetic_email;

-- email 컬럼 추가 (nullable, UNIQUE — Postgres에서 NULL은 UNIQUE 중복 검사 제외)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON public.users(email) WHERE email IS NOT NULL;

COMMENT ON COLUMN public.users.email IS
  'D29: 베타는 null (scope=openid+profile_nickname). Phase 3 비즈앱 등록 후 account_email scope 추가 시 카카오에서 받은 이메일 채움.';

-- ============================================================================
-- 2. handle_new_auth_user trigger 함수 재작성
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, kakao_id, email, nickname, profile_image_url)
  VALUES (
    NEW.id,
    -- OIDC standard claim. Supabase signInWithIdToken은 id_token.sub을 raw_user_meta_data.sub에 저장.
    -- Sprint 0 스모크 테스트에서 실제 claim 키 확인 의무 (provider_id, sub, kakao_id 중 무엇인지).
    NEW.raw_user_meta_data->>'sub',
    -- email = NEW.email (베타에는 null; Phase 3 account_email scope 추가 후 자동 채워짐)
    NEW.email,
    -- nickname fallback chain: OIDC profile_nickname claim → name → 익명
    COALESCE(
      NEW.raw_user_meta_data->>'nickname',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'preferred_username',
      '익명'
    ),
    -- OIDC standard picture claim
    NEW.raw_user_meta_data->>'picture'
  );
  -- 알림 설정 기본값 (변경 없음 — 0001 initial에서 그대로 가져옴)
  INSERT INTO public.notification_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 자체는 0001에서 정의됨 — 함수만 재작성하므로 CREATE TRIGGER 재실행 불필요

COMMENT ON FUNCTION public.handle_new_auth_user IS
  'D29: Supabase signInWithIdToken({provider: kakao}) → auth.users INSERT 시 public.users 자동 동기화. raw_user_meta_data claim 키는 Sprint 0 스모크 테스트로 검증.';

-- ============================================================================
-- 3. kakao_id NOT NULL 보장 (0001에서 이미 NOT NULL 이지만 확인 차원)
--    OIDC sub claim이 항상 존재해야 함 — null 들어오면 trigger 실패하도록.
-- ============================================================================

-- 0001에서 ALREADY NOT NULL, idempotent로 ensure
ALTER TABLE public.users ALTER COLUMN kakao_id SET NOT NULL;

COMMIT;

-- ============================================================================
-- Sprint 0 스모크 테스트 (psql 또는 Supabase SQL editor에서 수동 실행):
--
-- -- 1. column 검증
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='users'
--   AND column_name IN ('synthetic_email','email','kakao_id');
-- Expected: synthetic_email 행 0개, email 행 (YES, text), kakao_id 행 (NO, text)
--
-- -- 2. trigger 함수 시그니처 확인
-- \df public.handle_new_auth_user
--
-- -- 3. 실제 Kakao OIDC 로그인 1회 후 raw_user_meta_data 구조 확인
-- SELECT id, email, raw_user_meta_data
-- FROM auth.users
-- ORDER BY created_at DESC LIMIT 1;
-- Expected: raw_user_meta_data에 'sub' (또는 'provider_id'), 'nickname',
--           'picture' 등 카카오 OIDC claim 존재. claim 키가 'sub'이 아니면
--           handle_new_auth_user 함수의 ->>'sub' 부분을 실제 키로 수정 후 재배포.
-- ============================================================================
