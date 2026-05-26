// S06-ui-reauth-modal — Google 캘린더 재인증 필요 여부 판정.
//
// 검사 로직:
//   1. users.calendar_preference IN ('google', 'both')만 대상 (Google을 사용하려는 사용자)
//   2. user_oauth_tokens에 (user_id=me, provider='google_calendar') row가 없으면 reauth 필요
//      - row 부재 원인:
//        a. 사용자가 FirstTimeModal에서 Google 선택했지만 OAuth consent 중 cancelled (no upload)
//        b. worker가 invalid_grant 받아 deleteGoogleToken으로 row 삭제 (refresh token revoke 시)
//        c. 사용자가 Google 계정에서 직접 token revoke (외부 revoke)
//
// 에러는 silent false 반환 (모달 노출 보수적 — 일시 RLS 문제 등으로 거짓 모달 띄우지 않음).
//
// 본 helper는 profile 화면 mount 시 호출 → true면 ReauthModal 노출.

import type { SupabaseClient } from '@supabase/supabase-js';

const GOOGLE_PROVIDER = 'google_calendar';

interface UserPrefRow {
  calendar_preference: string | null;
}

export async function isGoogleReauthNeeded(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('calendar_preference')
    .eq('id', userId)
    .single();

  if (userErr || !user) return false;

  const pref = (user as UserPrefRow).calendar_preference;
  if (pref !== 'google' && pref !== 'both') return false;

  const { data: token, error: tokenErr } = await supabase
    .from('user_oauth_tokens')
    .select('user_id')
    .eq('user_id', userId)
    .eq('provider', GOOGLE_PROVIDER)
    .maybeSingle();

  if (tokenErr) return false;
  return token === null;
}
