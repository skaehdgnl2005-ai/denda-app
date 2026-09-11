// attribution_click_log — D28 자체 deferred deep link 클릭 로깅.
//
// web-guest (Vercel `/g/[token]`) 진입 시 호출. server 측에서 IP+UA hash 계산 후
// branch_attributions UPSERT. clicked_at = NOW().
//
// 클라이언트(anon)가 직접 branch_attributions에 INSERT 못 함 (RLS service_role only).
// 따라서 본 Edge가 service_role로 처리.
//
// Request: POST {
//   branch_link_id: string,    // 단축 URL token (= group_token 8자)
//   group_id: uuid,
//   guest_token: uuid          // group_guests row
// }
// Server extracts: client IP (X-Forwarded-For 또는 X-Real-IP) + User-Agent
// Response: { ok: true } | { error: string }
//
// 환경변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — 자동
//   HMAC_SECRET                              — fingerprint hash salt

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { DateTime } from 'npm:luxon@3.4.4';

import { getServiceRoleClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import {
  computeFingerprintHashes,
  extractClientIp,
  extractUserAgent,
} from '../_lib/fingerprint.ts';
import { parseClickLogRequest, type ClickLogRequestRaw } from '../_lib/attribution.ts';

export async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  let rawBody: ClickLogRequestRaw;
  try {
    rawBody = (await req.json()) as ClickLogRequestRaw;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  let parsed;
  try {
    parsed = parseClickLogRequest(rawBody);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 400);
  }

  const salt = Deno.env.get('HMAC_SECRET');
  if (!salt) {
    return errorResponse('서버 설정 오류 (HMAC_SECRET 미설정)', 500);
  }

  const ip = extractClientIp(req);
  const ua = extractUserAgent(req);
  const { ipHash, uaHash } = await computeFingerprintHashes({ ip, ua, salt });

  const service = getServiceRoleClient();

  // UPSERT on branch_link_id PK — 동일 게스트 재클릭 시 clicked_at·ip_hash·ua_hash 갱신
  const { error } = await service
    .from('branch_attributions')
    .upsert(
      {
        branch_link_id: parsed.branchLinkId,
        group_id: parsed.groupId,
        guest_token: parsed.guestToken,
        ip_hash: ipHash,
        ua_hash: uaHash,
        clicked_at: DateTime.utc().toISO() ?? '',
      },
      { onConflict: 'branch_link_id' },
    );

  if (error) {
    return errorResponse(`click_log 저장 실패: ${error.message}`, 500);
  }

  return jsonResponse({ ok: true });
}

if (import.meta.main) {
  serve(handler);
}
