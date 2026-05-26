-- 0011_users_calendar_preference.sql
-- S06 sub-task — users.calendar_preference 컬럼 추가
--
-- 동작 spec:
--   - NULL = 아직 결정 안 됨 (첫 모임 확정 시 모달 노출 — S06-ui-first-time-modal)
--   - 'google' / 'apple_ios' / 'both' = 사용자 선택 완료 → worker(Google) · 클라(Apple)가 분기
--   - 'none' = 명시적 거부 (모달에 다시 묻지 않음)
--
-- [D15] schedules.source enum 명칭과 동일하게 'apple_ios' 사용 — Phase 1+2은 iOS 디바이스의
-- 모든 캘린더 통합(iCloud + Google iOS + Outlook + Naver iOS)을 apple_ios bucket으로 처리.
-- provider 구분 차기.
--
-- 관련:
--   - S06-google-oauth (2026-05-26) — `src/lib/calendar/google.ts` 클라이언트 lib
--   - S06-worker-google-integration (다음 sub-task) — worker가 calendar_preference SELECT 후
--     'google' | 'both'면 events.insert 호출
--   - S06-apple-expo-calendar (다음 sub-task) — Apple은 worker 직접 push 불가 → client 측 sync
--     mechanism (Q-B22 결정 prereq)

ALTER TABLE public.users
  ADD COLUMN calendar_preference TEXT;

ALTER TABLE public.users
  ADD CONSTRAINT users_calendar_preference_chk
  CHECK (
    calendar_preference IS NULL
    OR calendar_preference IN ('google', 'apple_ios', 'both', 'none')
  );

-- preference가 'google' 또는 'both'인 사용자만 worker가 Google 처리 대상으로 SELECT.
-- 자주 조회되는 컬럼이라 partial index로 적은 비용에 빠른 lookup 보장.
-- ('none'·'apple_ios'·NULL은 index에서 자연 제외)
CREATE INDEX users_calendar_pref_google_idx
  ON public.users(id)
  WHERE calendar_preference IN ('google', 'both');
