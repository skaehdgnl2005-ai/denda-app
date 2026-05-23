-- ============================================================================
-- 된다 (DenDa) — Phase 1+2 Initial Schema
-- 출처: docs/ARCHITECTURE.md §2, docs/DECISIONS.md
-- 결정 의존: D3 (partnerships only), D13 (TIMESTAMPTZ UTC), D14 (15분 슬롯),
--           D15 (schedules.source enum), D16 (is_blocked helper), D17 (f4_sent_at),
--           D18 (좌표 WGS84)
-- 주의: D21 (synthetic email)은 supersede됨 — 0003_kakao_oidc_amend.sql 참조 (D29)
-- ============================================================================

-- 확장 활성화
-- UUID: PostgreSQL 13+ 내장 gen_random_uuid() 사용 (uuid-ossp 불필요).
-- Supabase에서 uuid-ossp는 extensions 스키마에 설치되어 search_path 안 잡혀 fail함.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 1. ENUM 타입 정의
-- ============================================================================

-- D15: schedules.source — Phase 1+2은 provider 구분 포기. apple_ios = multi-source bucket.
CREATE TYPE schedule_source AS ENUM ('manual', 'google', 'apple_ios', 'everytime');

-- 친구 요청 상태
CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- 모임 초대 상태
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- 신고 사유 (운영팀 카톡 manual 처리)
CREATE TYPE report_reason AS ENUM ('spam', 'harassment', 'inappropriate', 'fake_profile', 'other');

-- Push 플랫폼
CREATE TYPE push_platform AS ENUM ('ios', 'android');

-- 제휴 상태 (Phase 1+2 read-only)
CREATE TYPE partnership_status AS ENUM ('signed', 'paused', 'terminated');

-- ============================================================================
-- 2. 공통 유틸리티 함수
-- ============================================================================

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. users — 카카오 OIDC 사용자 프로필 (auth.users 확장)
-- 결정: [D29] OIDC + signInWithIdToken. auth.users.id를 PK로 1:1 연결.
--       synthetic_email 컬럼은 0003에서 DROP, email로 대체.
-- ============================================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kakao_id TEXT NOT NULL UNIQUE,
  synthetic_email TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  phone TEXT,
  profile_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_kakao_id_idx ON public.users(kakao_id);
CREATE INDEX users_nickname_trgm_idx ON public.users USING gin(nickname gin_trgm_ops);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. blocks — 차단 관계 (D16 helper의 기반)
-- ============================================================================

CREATE TABLE public.blocks (
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX blocks_blocked_id_idx ON public.blocks(blocked_id);

-- ============================================================================
-- 5. D16 핵심: is_blocked(viewer, target) helper function
-- 모든 RLS policy의 SELECT 절에 포함되어야 함.
-- 양방향 차단을 모두 체크 (A가 B 차단 OR B가 A 차단 → A는 B에게 invisible).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_blocked(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = viewer_id AND blocked_id = target_id)
       OR (blocker_id = target_id AND blocked_id = viewer_id)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.is_blocked IS 'D16: 모든 RLS SELECT policy에 포함. 양방향 차단 체크.';

-- ============================================================================
-- 6. friendships — 친구 관계 (대칭 — 두 row 저장)
-- ============================================================================

CREATE TABLE public.friendships (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE INDEX friendships_friend_id_idx ON public.friendships(friend_id);

-- ============================================================================
-- 7. friend_requests — 친구 요청
-- ============================================================================

CREATE TABLE public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status friend_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX friend_requests_to_user_status_idx ON public.friend_requests(to_user_id, status);
CREATE INDEX friend_requests_from_user_status_idx ON public.friend_requests(from_user_id, status);
CREATE UNIQUE INDEX friend_requests_unique_pending_idx
  ON public.friend_requests(from_user_id, to_user_id)
  WHERE status = 'pending';

CREATE TRIGGER friend_requests_set_updated_at
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. partnerships — 제휴 식당 (D3: Phase 1+2 read-only, 4 tables 중 유일)
-- ============================================================================

CREATE TABLE public.partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status partnership_status NOT NULL DEFAULT 'signed',
  contact_kakao_id TEXT,
  communication_log JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER partnerships_set_updated_at
  BEFORE UPDATE ON public.partnerships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 9. places — 장소 (Kakao Local API + Naver Map 표시)
-- D18: 좌표 WGS84 정규화. partnership_id FK nullable (D3 partnerships only).
-- ============================================================================

CREATE TABLE public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_place_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  category TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  partnership_id UUID REFERENCES public.partnerships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (lat BETWEEN -90 AND 90),
  CHECK (lng BETWEEN -180 AND 180)
);

CREATE INDEX places_kakao_place_id_idx ON public.places(kakao_place_id);
CREATE INDEX places_partnership_id_idx ON public.places(partnership_id) WHERE partnership_id IS NOT NULL;
-- viewport 검색용 (lat, lng range scan)
CREATE INDEX places_lat_lng_idx ON public.places(lat, lng);

CREATE TRIGGER places_set_updated_at
  BEFORE UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- partnerships → places 역참조 인덱스 (제휴 상태 변경 시 관련 places 조회)
-- partnerships.place_id 대신 places.partnership_id (FK 방향 ARCHITECTURE.md §2 따름)

-- ============================================================================
-- 10. groups — 모임
-- D17: f4_sent_at nullable (push F4 idempotency)
-- ============================================================================

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dates DATE[] NOT NULL,
  confirmed_at TIMESTAMPTZ,
  confirmed_start_at TIMESTAMPTZ,
  confirmed_end_at TIMESTAMPTZ,
  confirmed_place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  f4_sent_at TIMESTAMPTZ, -- D17: idempotent F4 push
  f5_sent_at TIMESTAMPTZ, -- 모임 확정 push (대칭성 위해)
  partial_fail_list JSONB DEFAULT '[]'::JSONB, -- D20: calendar push 부분 실패 멤버 list
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (array_length(dates, 1) > 0),
  CHECK (
    (confirmed_at IS NULL AND confirmed_start_at IS NULL AND confirmed_end_at IS NULL)
    OR (confirmed_at IS NOT NULL AND confirmed_start_at IS NOT NULL AND confirmed_end_at IS NOT NULL)
  ),
  CHECK (confirmed_end_at IS NULL OR confirmed_end_at > confirmed_start_at)
);

CREATE INDEX groups_host_id_idx ON public.groups(host_id);
CREATE INDEX groups_confirmed_at_idx ON public.groups(confirmed_at) WHERE confirmed_at IS NOT NULL;

CREATE TRIGGER groups_set_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 11. group_members — 모임 멤버 (회원)
-- ============================================================================

CREATE TABLE public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX group_members_user_id_idx ON public.group_members(user_id);

-- ============================================================================
-- 12. group_guests — 웹 게스트 (Branch.io 단축 URL 진입)
-- ============================================================================

CREATE TABLE public.group_guests (
  guest_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  converted_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX group_guests_group_id_idx ON public.group_guests(group_id);
CREATE INDEX group_guests_converted_idx ON public.group_guests(converted_user_id) WHERE converted_user_id IS NOT NULL;

-- ============================================================================
-- 13. group_invitations — 모임 초대 (회원 대상)
-- ============================================================================

CREATE TABLE public.group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (inviter_id <> invitee_id)
);

CREATE INDEX group_invitations_invitee_status_idx ON public.group_invitations(invitee_id, status);
CREATE UNIQUE INDEX group_invitations_unique_pending_idx
  ON public.group_invitations(group_id, invitee_id)
  WHERE status = 'pending';

CREATE TRIGGER group_invitations_set_updated_at
  BEFORE UPDATE ON public.group_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 14. votes — 시간 투표 (D14: 15분 슬롯 CHECK)
-- ============================================================================

CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  guest_token UUID REFERENCES public.group_guests(guest_token) ON DELETE CASCADE,
  day DATE NOT NULL,
  start_minute INTEGER NOT NULL,
  end_minute INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- D14: 15분 단위 강제
  CHECK (start_minute % 15 = 0),
  CHECK (end_minute % 15 = 0),
  -- 09:00 ~ 24:00 범위 (DESIGN §10.1)
  CHECK (start_minute >= 540 AND start_minute < 1440),
  CHECK (end_minute > start_minute AND end_minute <= 1440),
  -- 회원 또는 게스트 둘 중 정확히 하나
  CHECK (
    (user_id IS NOT NULL AND guest_token IS NULL)
    OR (user_id IS NULL AND guest_token IS NOT NULL)
  )
);

CREATE INDEX votes_group_id_day_idx ON public.votes(group_id, day);
CREATE INDEX votes_user_id_idx ON public.votes(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX votes_guest_token_idx ON public.votes(guest_token) WHERE guest_token IS NOT NULL;

-- ============================================================================
-- 15. schedules — 개인 일정 (D15 source enum)
-- D13: TIMESTAMPTZ UTC. KST 변환은 client.
-- ============================================================================

CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source schedule_source NOT NULL,
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  recurrence_rule TEXT, -- RRULE format (everytime 매주 반복 등)
  expires_at TIMESTAMPTZ, -- 학기 종료 자동 만료 (everytime)
  external_id TEXT, -- google event id, apple identifier 등 (provider 구분 포기지만 dedupe용)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

CREATE INDEX schedules_user_start_idx ON public.schedules(user_id, start_at);
CREATE INDEX schedules_user_source_idx ON public.schedules(user_id, source);

CREATE TRIGGER schedules_set_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 16. comments — 모임 댓글 (푸시 알림 안 함 — 의도적)
-- ============================================================================

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(content) BETWEEN 1 AND 1000)
);

CREATE INDEX comments_group_id_created_idx ON public.comments(group_id, created_at DESC);

-- ============================================================================
-- 17. push_tokens — Expo Push tokens
-- ============================================================================

CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform push_platform NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX push_tokens_user_id_idx ON public.push_tokens(user_id);

CREATE TRIGGER push_tokens_set_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 18. notification_settings — 알림 설정 (F6·F7는 Phase 3)
-- ============================================================================

CREATE TABLE public.notification_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  f1_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  f2_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  f3_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  f4_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  f5_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER notification_settings_set_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 19. reports — 신고 (운영팀 카톡 manual 처리)
-- ============================================================================

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason report_reason NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reporter_id <> target_id)
);

CREATE INDEX reports_target_id_idx ON public.reports(target_id);
CREATE INDEX reports_created_at_idx ON public.reports(created_at DESC);

-- ============================================================================
-- 20. branch_attributions — Branch.io 게스트→회원 전환
-- ============================================================================

CREATE TABLE public.branch_attributions (
  branch_link_id TEXT PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  guest_token UUID REFERENCES public.group_guests(guest_token) ON DELETE SET NULL,
  converted_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX branch_attributions_group_id_idx ON public.branch_attributions(group_id);
CREATE INDEX branch_attributions_converted_user_idx ON public.branch_attributions(converted_user_id) WHERE converted_user_id IS NOT NULL;

-- ============================================================================
-- 21. auth.users → public.users 자동 동기화 트리거
-- 카카오 OAuth Edge Function이 supabase.auth.signUp() 호출 시
-- public.users도 자동으로 row 생성 (kakao_id, nickname은 raw_user_meta_data에서).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, kakao_id, synthetic_email, nickname, profile_image_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'kakao_id',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', '익명'),
    NEW.raw_user_meta_data->>'profile_image_url'
  );
  -- 알림 설정 기본값
  INSERT INTO public.notification_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- 끝. RLS policy + Realtime publication은 0002_rls.sql에서.
-- ============================================================================
