// attribution_resolve — D28 자체 deferred deep link 회원 전환.
//
// RN 앱 첫 실행 직후(또는 로그인 직후) 호출. 두 가지 모드:
//   - mode='fingerprint': server 측 IP+UA hash로 최근 24시간 클릭 row 매칭
//   - mode='invite_code': 사용자가 입력한 4자리 코드로 group 직접 매칭
// 매칭 성공 시:
//   1) branch_attributions.converted_user_id + converted_at UPDATE (fingerprint 모드만)
//   2) group_guests.converted_user_id UPDATE (guest_token이 있을 때)
//   3) group_members INSERT (group_id, user_id) ON CONFLICT DO NOTHING
//
// Request: POST {
//   mode: 'fingerprint' | 'invite_code',
//   code?: string   // mode='invite_code' 일 때 4자리
// }
// Authorization: Bearer <user JWT>
// Server extracts: client IP + User-Agent (fingerprint 모드만 사용)
// Response: { matched: boolean, group_id?: uuid, guest_token?: uuid | null } | { error: string }
//
// 환경변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY — 자동
//   HMAC_SECRET                                                 — fingerprint hash salt

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { DateTime } from 'npm:luxon@3.4.4';

import { getAnonClient, getServiceRoleClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import {
  computeFingerprintHashes,
  extractClientIp,
  extractUserAgent,
} from '../_lib/fingerprint.ts';
import {
  FINGERPRINT_MATCH_WINDOW_HOURS,
  fingerprintMatchSince,
  parseResolveRequest,
  type ResolveRequest,
  type ResolveRequestRaw,
} from '../_lib/attribution.ts';

interface MatchResult {
  matched: boolean;
  groupId?: string;
  guestToken?: string | null;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('인증이 필요합니다.', 401);
  }

  // 사용자 식별 — anon client로 auth.getUser()
  const anon = getAnonClient(authHeader);
  const { data: userData, error: userError } = await anon.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse('인증이 필요합니다.', 401);
  }
  const userId = userData.user.id;

  let rawBody: ResolveRequestRaw;
  try {
    rawBody = (await req.json()) as ResolveRequestRaw;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  let parsed: ResolveRequest;
  try {
    parsed = parseResolveRequest(rawBody);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 400);
  }

  const service = getServiceRoleClient();

  let matchResult: MatchResult;
  try {
    if (parsed.mode === 'fingerprint') {
      matchResult = await matchByFingerprint({ req, service, userId });
    } else {
      matchResult = await matchByInviteCode({ service, code: parsed.code });
    }
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : String(err),
      500,
    );
  }

  if (!matchResult.matched || !matchResult.groupId) {
    return jsonResponse({ matched: false });
  }

  // 매칭 성공 → group_members INSERT (멤버 cascade)
  // group_guests.converted_user_id UPDATE는 fingerprint 모드에서 guest_token 있을 때만
  try {
    if (matchResult.guestToken) {
      const { error: guestUpdateErr } = await service
        .from('group_guests')
        .update({ converted_user_id: userId })
        .eq('guest_token', matchResult.guestToken);
      if (guestUpdateErr) {
        return errorResponse(
          `group_guests 전환 실패: ${guestUpdateErr.message}`,
          500,
        );
      }
    }

    const { error: memberInsertErr } = await service
      .from('group_members')
      .upsert(
        { group_id: matchResult.groupId, user_id: userId },
        { onConflict: 'group_id,user_id', ignoreDuplicates: true },
      );
    if (memberInsertErr) {
      return errorResponse(
        `모임 합류 실패: ${memberInsertErr.message}`,
        500,
      );
    }
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : String(err),
      500,
    );
  }

  return jsonResponse({
    matched: true,
    group_id: matchResult.groupId,
    guest_token: matchResult.guestToken ?? null,
  });
}

// --- match helpers ---------------------------------------------------------

interface MatchFingerprintArgs {
  req: Request;
  service: ReturnType<typeof getServiceRoleClient>;
  userId: string;
}

async function matchByFingerprint(args: MatchFingerprintArgs): Promise<MatchResult> {
  const salt = Deno.env.get('HMAC_SECRET');
  if (!salt) {
    throw new Error('서버 설정 오류 (HMAC_SECRET 미설정)');
  }

  const ip = extractClientIp(args.req);
  const ua = extractUserAgent(args.req);
  if (ip.length === 0) {
    return { matched: false };
  }
  const { ipHash, uaHash } = await computeFingerprintHashes({ ip, ua, salt });

  const sinceIso = fingerprintMatchSince(
    DateTime.utc().toJSDate(),
    FINGERPRINT_MATCH_WINDOW_HOURS,
  );

  // 최근 24시간 클릭 중 ip+ua 일치하고 아직 미전환된 row → 가장 최근 1건
  const { data, error } = await args.service
    .from('branch_attributions')
    .select('branch_link_id, group_id, guest_token')
    .eq('ip_hash', ipHash)
    .eq('ua_hash', uaHash)
    .is('converted_user_id', null)
    .gte('clicked_at', sinceIso)
    .order('clicked_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`fingerprint 매칭 query 실패: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { matched: false };
  }

  const row = data[0] as {
    branch_link_id: string;
    group_id: string | null;
    guest_token: string | null;
  };
  if (!row.group_id) {
    return { matched: false };
  }

  // branch_attributions converted_user_id + converted_at UPDATE
  const { error: updateErr } = await args.service
    .from('branch_attributions')
    .update({
      converted_user_id: args.userId,
      converted_at: DateTime.utc().toISO() ?? '',
    })
    .eq('branch_link_id', row.branch_link_id);

  if (updateErr) {
    throw new Error(`branch_attributions 전환 UPDATE 실패: ${updateErr.message}`);
  }

  return {
    matched: true,
    groupId: row.group_id,
    guestToken: row.guest_token,
  };
}

interface MatchInviteCodeArgs {
  service: ReturnType<typeof getServiceRoleClient>;
  code: string;
}

async function matchByInviteCode(args: MatchInviteCodeArgs): Promise<MatchResult> {
  const { data, error } = await args.service
    .from('groups')
    .select('id')
    .eq('invite_code', args.code)
    .limit(1);

  if (error) {
    throw new Error(`invite_code 조회 실패: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return { matched: false };
  }

  const groupId = (data[0] as { id: string }).id;
  return { matched: true, groupId, guestToken: null };
}

if (import.meta.main) {
  serve(handler);
}
