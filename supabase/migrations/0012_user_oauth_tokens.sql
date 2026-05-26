-- 0012_user_oauth_tokens.sql
-- S06-worker-google-integration — Google Calendar OAuth token 서버 측 저장 ([D35](../../docs/DECISIONS.md#d35--google-calendar-oauth-token-서버-측-저장--user_oauth_tokens-table))
--
-- 동작 spec:
--   - 클라이언트가 Google OAuth flow 완료 후 `upsert_user_oauth_tokens` RPC 호출 → row INSERT/UPDATE
--   - worker(`calendar_push_worker`)는 service_role로 SELECT → access_token 만료 시 refresh → events.insert
--   - access_token 갱신 시 expires_at·access_token UPDATE. refresh_token 회전 시 refresh_token도 UPDATE
--   - refresh_token 401 invalid_grant → partial_fail_list에 reason='token_expired' 마킹 (worker 측)
--
-- RLS:
--   - SELECT/UPDATE/DELETE 본인 행만 (auth.uid() = user_id)
--   - INSERT는 직접 금지 — `upsert_user_oauth_tokens` RPC만 (RPC가 auth.uid() 검증 + provider별 unique 보장)
--   - service_role은 RLS 우회 (worker가 SELECT)
--
-- 보안:
--   - 베타: row-level RLS로 1차 격리. access_token/refresh_token은 column-level encrypt 없음
--   - Phase 3: Supabase Vault로 column-level encrypt 격상 ([D35](../../docs/DECISIONS.md#d35) 결과 영향)
--   - refresh_token은 service_role-only SELECT 의도 — RLS는 본인 SELECT도 허용하지만 클라이언트가 굳이 SELECT할 일 없음 (token은 한 번 업로드 후 worker가 관리)
--
-- 관련:
--   - `supabase/functions/_lib/google_calendar.ts` — server-side refresh + events.insert
--   - `calendar_push_worker/index.ts` — pushToMemberCalendar Google 분기
--   - S06-setup sub-task (별도) — `src/lib/calendar/google.ts` 클라이언트가 OAuth 완료 후 본 RPC 호출

CREATE TABLE public.user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (user_id, provider) unique — 사용자당 provider 1행
CREATE UNIQUE INDEX user_oauth_tokens_user_provider_uniq
  ON public.user_oauth_tokens(user_id, provider);

-- worker가 매 1분 SELECT할 lookup 최적화 (id PK + user_provider unique만으로 충분, 별도 index 불필요)

-- provider enum 강제 (현재는 'google_calendar'만, 미래 'apple_calendar' 등 확장 시 CHECK 갱신)
ALTER TABLE public.user_oauth_tokens
  ADD CONSTRAINT user_oauth_tokens_provider_chk
  CHECK (provider IN ('google_calendar'));

-- updated_at 자동 갱신 trigger (기존 set_updated_at 함수 활용 — 0001에서 정의됨)
CREATE TRIGGER user_oauth_tokens_set_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- SELECT 본인만
CREATE POLICY user_oauth_tokens_select_self
  ON public.user_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- UPDATE 본인만 (예: worker가 access_token 갱신 후 클라가 expires_at 확인 등 운영 케이스 — 거의 안 씀)
CREATE POLICY user_oauth_tokens_update_self
  ON public.user_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE 본인만 (Google 연동 해제 시 클라가 호출 — 명시적 unlink)
CREATE POLICY user_oauth_tokens_delete_self
  ON public.user_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT는 RLS로 금지 — RPC만 (RPC는 SECURITY DEFINER로 우회)
-- (별도 INSERT policy 없으면 anon/authenticated 모두 INSERT 차단)

-- ---------------------------------------------------------------------------
-- upsert_user_oauth_tokens RPC
-- ---------------------------------------------------------------------------

-- 클라이언트가 OAuth flow 완료 후 호출. auth.uid()로 user_id 검증.
-- 같은 (user_id, provider)면 access_token·refresh_token·expires_at·scope·updated_at 갱신.
CREATE OR REPLACE FUNCTION public.upsert_user_oauth_tokens(
  p_provider TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_at TIMESTAMPTZ,
  p_scope TEXT
) RETURNS public.user_oauth_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_row public.user_oauth_tokens;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '42501';
  END IF;

  IF p_provider IS NULL OR length(trim(p_provider)) = 0 THEN
    RAISE EXCEPTION 'provider가 필요합니다.' USING ERRCODE = '22023';
  END IF;
  IF p_access_token IS NULL OR length(trim(p_access_token)) = 0 THEN
    RAISE EXCEPTION 'access_token이 필요합니다.' USING ERRCODE = '22023';
  END IF;
  IF p_refresh_token IS NULL OR length(trim(p_refresh_token)) = 0 THEN
    RAISE EXCEPTION 'refresh_token이 필요합니다.' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NULL THEN
    RAISE EXCEPTION 'expires_at이 필요합니다.' USING ERRCODE = '22023';
  END IF;
  IF p_scope IS NULL OR length(trim(p_scope)) = 0 THEN
    RAISE EXCEPTION 'scope가 필요합니다.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_oauth_tokens(
    user_id, provider, access_token, refresh_token, expires_at, scope
  ) VALUES (
    v_user_id, p_provider, p_access_token, p_refresh_token, p_expires_at, p_scope
  )
  ON CONFLICT (user_id, provider) DO UPDATE
    SET access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 클라이언트(authenticated)가 호출 가능
GRANT EXECUTE ON FUNCTION public.upsert_user_oauth_tokens(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_user_oauth_tokens(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM anon, public;
