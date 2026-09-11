// delete_account — 회원 탈퇴 (W1-14). service_role admin.deleteUser + best-effort Google 토큰 revoke.
//
// 흐름:
//   1) POST + preflight
//   2) anon client(JWT passthrough) → auth.getUser()로 사용자 식별
//      — user_id는 절대 요청 본문에서 안 받는다(타인 계정 삭제 IDOR 차단). CLAUDE.md 규칙7.
//   3) service_role → user_oauth_tokens에서 google refresh_token best-effort revoke (non-blocking)
//   4) service_role → auth.admin.deleteUser(userId)
//      → public.users FK ON DELETE CASCADE로 전 연관 테이블(groups·votes·comments·friendships·
//         schedules·push_tokens·reports·user_oauth_tokens 등) 자동 정리. RESTRICT FK 없음.
//
// 환경변수: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (표준)
//
// 실행 테스트: deno test supabase/functions/delete_account/_test.ts --no-check

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getAnonClient, getServiceRoleClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';

const GOOGLE_PROVIDER = 'google_calendar';

// Google OAuth refresh_token revoke — 제3자(구글 캘린더) 접근 권한 자체를 끊는다.
// 실패는 호출부에서 삼킨다(non-blocking) — 탈퇴를 막지 않는다.
export async function revokeGoogleToken(refreshToken: string): Promise<void> {
  const res = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );
  if (!res.ok) {
    throw new Error(`google token revoke 실패: ${res.status}`);
  }
}

export interface DeleteAccountDeps {
  getAnonClient: (authHeader: string | null) => SupabaseClient;
  getServiceRoleClient: () => SupabaseClient;
  revokeGoogleToken: (refreshToken: string) => Promise<void>;
}

const defaultDeps: DeleteAccountDeps = {
  getAnonClient,
  getServiceRoleClient,
  revokeGoogleToken,
};

export async function handleDeleteAccount(
  req: Request,
  deps: DeleteAccountDeps = defaultDeps,
): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('인증이 필요합니다.', 401);
  }

  // 사용자 식별 — anon client + JWT. 요청 본문에서 user_id를 받지 않는다(IDOR 차단).
  const anon = deps.getAnonClient(authHeader);
  const { data: userData, error: userError } = await anon.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse('인증이 만료되었어요. 다시 로그인해주세요.', 401);
  }
  const userId = userData.user.id;

  const service = deps.getServiceRoleClient();

  // best-effort: Google 캘린더 refresh_token revoke. cascade가 곧 토큰 행을 지우므로 삭제 전에 읽는다.
  try {
    const { data: tokenRow } = await service
      .from('user_oauth_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .eq('provider', GOOGLE_PROVIDER)
      .maybeSingle();
    const refreshToken = (tokenRow as { refresh_token?: string } | null)?.refresh_token;
    if (refreshToken) {
      await deps.revokeGoogleToken(refreshToken);
    }
  } catch (_e) {
    // non-blocking — revoke 실패는 탈퇴를 막지 않는다.
  }

  // auth.users 삭제 → public.users(id) FK CASCADE로 전 연관 테이블 자동 삭제.
  const { error: deleteError } = await service.auth.admin.deleteUser(userId);
  if (deleteError) {
    return errorResponse('회원 탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.', 500);
  }

  return jsonResponse({ ok: true });
}

if (import.meta.main) {
  serve((req) => handleDeleteAccount(req));
}

export { handleDeleteAccount as handler };
