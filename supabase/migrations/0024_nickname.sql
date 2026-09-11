-- ============================================================================
-- 된다 (DenDa) — 닉네임 직접 설정
-- 스펙: docs/superpowers/specs/2026-07-29-nickname-design.md
-- 결정 의존: D13 (TIMESTAMPTZ + KST), D16 (users SELECT는 is_blocked 통과 — 0002 불변)
--
-- 문제:
--   카카오 로그인이 카톡 이름을 그대로 users.nickname에 넣는다. 사용자가 고른 이름이 아니고,
--   동명이인이 구분되지 않는다(친구 검색이 nickname ilike로 동작).
--
-- 이 마이그레이션이 하는 일:
--   1. users.nickname_set_at 추가 — "사용자가 직접 정했는가"의 서버측 진실
--   2. lower(nickname) 유니크 인덱스 — 대소문자 무시 중복 차단
--   3. 조건부 CHECK — 사용자가 정한 값만 길이·문자 규칙 강제
--   4. handle_new_auth_user 재작성 — 유니크 충돌로 가입이 깨지지 않게
--   5. set_my_nickname RPC — 검증·중복검사·타임스탬프를 서버 한 곳에서
--
-- ⚠️ 적용 전 필수: lower(nickname) 중복이 남아 있으면 2번 인덱스 생성이 실패하며 멈춘다.
--    이것은 의도된 안전장치다. 스펙 §8의 초기화 절차(auth.users 전체 삭제)를 먼저 수행할 것.
-- ============================================================================

-- ============================================================================
-- 1. nickname_set_at — 닉네임 설정 여부의 서버측 진실
-- ============================================================================
-- 기기 로컬 SecureStore 플래그(hasCompletedOnboarding)와 달리 재설치·기기 교체에도
-- 따라오고, 이미 가입해 있는 사용자도 다음 로그인에서 자동으로 설정 화면을 거친다.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nickname_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.nickname_set_at IS
  'NULL = 카카오 이름 그대로(미설정) → 클라이언트 게이트가 닉네임 화면으로 보냄. 값 = 사용자가 직접 정한 시각.';

-- ============================================================================
-- 2. 대소문자 무시 유니크
-- ============================================================================
-- lower()로 감싸지 않으면 Minsu / minsu가 공존해 유니크가 사실상 뚫린다.
-- 규칙상 공백이 불가하므로 공백 정규화는 필요 없다(§3 참조).
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_unique_idx
  ON public.users (lower(nickname));

-- ============================================================================
-- 3. 조건부 CHECK — 사용자가 정한 값만 검사
-- ============================================================================
-- 규칙 전체에 걸면 안 된다: 카톡 이름은 1자이거나 13자일 수 있고 이모지도 들어올 수 있어
-- 가입 트리거의 INSERT가 터진다(= 로그인 실패). 사용자가 직접 정한 값만 강제한다.
--
-- ⚠️ 이 규칙은 세 곳에 복제되어 있다. 하나를 바꾸면 셋 다 바꿀 것:
--    - src/lib/profile/nickname.ts   (입력 중 실시간 피드백)
--    - set_my_nickname()             (아래 5번 — 진짜 게이트)
--    - 이 CHECK                       (최후 방어선)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_nickname_format_check;
ALTER TABLE public.users ADD CONSTRAINT users_nickname_format_check CHECK (
  nickname_set_at IS NULL
  OR (
    char_length(nickname) BETWEEN 2 AND 12
    AND nickname ~ '^[가-힣a-zA-Z0-9_]+$'
  )
);

-- ============================================================================
-- 4. handle_new_auth_user 재작성 — 유니크 충돌이 가입을 깨뜨리지 않게
-- ============================================================================
-- 0003 버전은 카카오 nickname을 그대로 INSERT한다. 2번 유니크 인덱스가 걸린 뒤에는
-- 동명이인의 두 번째 가입에서 INSERT가 실패하고 → auth.users INSERT 트랜잭션이 롤백되어
-- **로그인 자체가 실패**한다. 충돌 시 id 앞 4자를 붙여 안전하게 착지시킨다.
--
-- 이 자동 생성 이름은 몇 초만 존재한다: nickname_set_at이 NULL이라 클라이언트 게이트가
-- 곧바로 닉네임 설정 화면으로 보낸다.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_base TEXT;
  v_nickname TEXT;
BEGIN
  -- nickname fallback chain: OIDC profile_nickname claim → name → preferred_username → 익명
  v_base := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'nickname', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'preferred_username', ''),
    '익명'
  );

  -- 충돌 시에만 suffix. 대소문자 무시 인덱스와 같은 기준(lower)으로 검사해야
  -- INSERT가 뒤늦게 터지지 않는다.
  v_nickname := v_base;
  IF EXISTS (SELECT 1 FROM public.users WHERE lower(nickname) = lower(v_nickname)) THEN
    v_nickname := v_base || '_' || substr(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO public.users (id, kakao_id, email, nickname, profile_image_url, nickname_set_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'sub',
    NEW.email,
    v_nickname,
    NEW.raw_user_meta_data->>'picture',
    -- 사용자가 정한 값이 아니다. 게이트가 이걸 보고 닉네임 화면으로 보낸다.
    NULL
  );

  -- 알림 설정 기본값
  INSERT INTO public.notification_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_auth_user IS
  '0024: 카카오 클레임으로 public.users row 생성. nickname 유니크 충돌 시 id 앞 4자 suffix(로그인 실패 방지). nickname_set_at은 NULL — 클라이언트가 설정 화면으로 유도.';

-- ============================================================================
-- 5. set_my_nickname RPC
-- ============================================================================
-- SECURITY DEFINER 정당화: users UPDATE는 RLS users_update_self(0002)로 본인 row가 이미
--   열려 있다. 그런데 RLS에는 컬럼 단위 제어가 없어서, 클라이언트가 직접 UPDATE할 수 있으면
--   nickname_set_at을 임의로 채워 설정 단계를 건너뛸 수 있다. 이 함수만 통과하도록 좁힌다.
--   인자는 닉네임 하나뿐이고 대상은 auth.uid()로 고정 → 남의 row를 건드릴 수 없다.
--
-- 에러는 안정적인 코드 문자열로 던진다. 한국어 카피는 클라이언트가 매핑한다
--   (src/lib/profile/api.ts::RPC_REASONS) — 예외 문자열에 UI 카피를 넣으면
--   문구 하나 바꾸는 데 마이그레이션이 필요해진다.
CREATE OR REPLACE FUNCTION public.set_my_nickname(p_nickname TEXT)
RETURNS VOID AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_value TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_value := btrim(COALESCE(p_nickname, ''));

  IF char_length(v_value) < 2 THEN
    RAISE EXCEPTION 'nickname_too_short';
  END IF;

  IF char_length(v_value) > 12 THEN
    RAISE EXCEPTION 'nickname_too_long';
  END IF;

  IF v_value !~ '^[가-힣a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'nickname_invalid_chars';
  END IF;

  UPDATE public.users
    SET nickname = v_value,
        nickname_set_at = NOW()
    WHERE id = v_caller;

  IF NOT FOUND THEN
    -- 계정이 삭제됐는데 아직 만료 안 된 access token으로 호출한 경우.
    RAISE EXCEPTION 'not_authenticated';
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'nickname_taken';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_my_nickname IS
  '0024: 본인 닉네임 설정/변경. 길이 2~12 + [가-힣a-zA-Z0-9_] 검증 후 nickname_set_at 기록. 중복 시 nickname_taken.';

REVOKE ALL ON FUNCTION public.set_my_nickname(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_nickname(TEXT) TO authenticated;
