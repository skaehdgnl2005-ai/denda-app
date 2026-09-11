// notify_f2 — 친구 수락 push (F2)
//
// S12. friendships INSERT trigger 또는 publisher API에서
// `dispatcher.dispatch({type:'friend_accepted', fromUserId, toUserId})` 호출 시
// 본 handler가 in-process 발송 (D33).
//
// 의미: from_user_id가 보낸 요청을 to_user_id가 수락 → from_user_id에게 알림.
// 즉 recipient = fromUserId, accepter = toUserId (요청을 받아서 수락한 쪽).
//
// Request: POST { from_user_id: uuid, to_user_id: uuid }
//   - from_user_id = 원래 요청을 보냈던 사람 (수락 알림을 받을 사람)
//   - to_user_id = 요청을 수락한 사람 (닉네임 출처)
// Response: { ok: true, sent: number, failed: number, skipped: boolean }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getServiceRoleClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import { nowKst } from '../_lib/kst.ts';
import {
  buildPartialFailList,
  partitionPushResponses,
  sendExpoPushAll,
  type ExpoPushMessage,
} from '../_lib/expo_push.ts';

// ---------------------------------------------------------------------------
// 순수 함수
// ---------------------------------------------------------------------------

export interface ShouldSendArgs {
  f2Enabled: boolean | null;
}

export function shouldSendF2(args: ShouldSendArgs): boolean {
  return args.f2Enabled === true;
}

export function formatF2Title(): string {
  return '친구 수락';
}

export interface F2BodyArgs {
  accepterNickname: string;
}

export function formatF2Body(args: F2BodyArgs): string {
  const nickname = args.accepterNickname.trim() || '상대방';
  return `${nickname}님이 친구 요청을 수락했어요`;
}

export interface F2Recipient {
  userId: string;
  tokens: string[];
}

export interface BuildF2MessagesArgs {
  recipient: F2Recipient;
  accepterNickname: string;
}

export function buildF2PushMessages(args: BuildF2MessagesArgs): ExpoPushMessage[] {
  const title = formatF2Title();
  const body = formatF2Body({ accepterNickname: args.accepterNickname });
  return args.recipient.tokens.map((token) => ({
    to: token,
    title,
    body,
    userId: args.recipient.userId,
  }));
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

interface NotifyF2Request {
  from_user_id?: string;
  to_user_id?: string;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  let body: NotifyF2Request;
  try {
    body = (await req.json()) as NotifyF2Request;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  const fromUserId = body.from_user_id;
  const toUserId = body.to_user_id;
  if (!fromUserId || !isUuid(fromUserId)) {
    return errorResponse('from_user_id (UUID)가 필요합니다.', 400);
  }
  if (!toUserId || !isUuid(toUserId)) {
    return errorResponse('to_user_id (UUID)가 필요합니다.', 400);
  }

  const supabase = getServiceRoleClient();

  // 1) accepter(to_user_id) 닉네임 + recipient(from_user_id) opt-in + 토큰 병렬
  const [accepterResult, settingsResult, tokenResult] = await Promise.all([
    supabase.from('users').select('nickname').eq('id', toUserId).single(),
    supabase
      .from('notification_settings')
      .select('f2_enabled')
      .eq('user_id', fromUserId)
      .maybeSingle(),
    supabase.from('push_tokens').select('token').eq('user_id', fromUserId),
  ]);

  if (accepterResult.error) {
    return errorResponse(`users 조회 실패: ${accepterResult.error.message}`, 500);
  }
  if (settingsResult.error) {
    return errorResponse(
      `notification_settings 조회 실패: ${settingsResult.error.message}`,
      500,
    );
  }
  if (tokenResult.error) {
    return errorResponse(`push_tokens 조회 실패: ${tokenResult.error.message}`, 500);
  }

  const accepterNickname =
    (accepterResult.data as { nickname: string } | null)?.nickname ?? '';
  const f2Enabled =
    (settingsResult.data as { f2_enabled: boolean } | null)?.f2_enabled ?? null;

  if (!shouldSendF2({ f2Enabled })) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  const tokens = ((tokenResult.data ?? []) as Array<{ token: string }>).map(
    (r) => r.token,
  );
  if (tokens.length === 0) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  const messages = buildF2PushMessages({
    recipient: { userId: fromUserId, tokens },
    accepterNickname,
  });
  const tickets = await sendExpoPushAll(messages);
  const { successfulCount, failures } = partitionPushResponses(messages, tickets);

  if (failures.length > 0) {
    const occurredAt = nowKst().toISO() ?? '';
    buildPartialFailList({
      failures,
      channel: 'f2_push',
      occurredAtKstIso: occurredAt,
    });
  }

  return jsonResponse({
    ok: true,
    sent: successfulCount,
    failed: failures.length,
    skipped: false,
  });
}

if (import.meta.main) {
  serve(handler);
}

export { handler };
