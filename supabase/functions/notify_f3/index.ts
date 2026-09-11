// notify_f3 — 모임 초대 push (F3)
//
// S12. group_invitations INSERT trigger 또는 publisher API에서
// `dispatcher.dispatch({type:'group_invited', groupId, inviterId, inviteeId})` 호출 시
// 본 handler가 in-process 발송 (D33).
//
// 대상 = invitee_id. opt-in = notification_settings.f3_enabled.
// idempotency 컬럼 없음 — group_invitations row 자체가 unique(group_id, invitee_id) 가정.
//
// Request: POST { group_id: uuid, inviter_id: uuid, invitee_id: uuid }
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
  f3Enabled: boolean | null;
}

export function shouldSendF3(args: ShouldSendArgs): boolean {
  return args.f3Enabled === true;
}

export interface F3TitleArgs {
  groupName: string;
}

export function formatF3Title(args: F3TitleArgs): string {
  const name = args.groupName.trim() || '모임';
  return `'${name}' 초대`;
}

export interface F3BodyArgs {
  inviterNickname: string;
}

export function formatF3Body(args: F3BodyArgs): string {
  const nickname = args.inviterNickname.trim() || '누군가';
  return `${nickname}님이 모임에 초대했어요`;
}

export interface F3Recipient {
  userId: string;
  tokens: string[];
}

export interface BuildF3MessagesArgs {
  recipient: F3Recipient;
  inviterNickname: string;
  groupName: string;
}

export function buildF3PushMessages(args: BuildF3MessagesArgs): ExpoPushMessage[] {
  const title = formatF3Title({ groupName: args.groupName });
  const body = formatF3Body({ inviterNickname: args.inviterNickname });
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

interface NotifyF3Request {
  group_id?: string;
  inviter_id?: string;
  invitee_id?: string;
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

  let body: NotifyF3Request;
  try {
    body = (await req.json()) as NotifyF3Request;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  const { group_id: groupId, inviter_id: inviterId, invitee_id: inviteeId } = body;
  if (!groupId || !isUuid(groupId)) {
    return errorResponse('group_id (UUID)가 필요합니다.', 400);
  }
  if (!inviterId || !isUuid(inviterId)) {
    return errorResponse('inviter_id (UUID)가 필요합니다.', 400);
  }
  if (!inviteeId || !isUuid(inviteeId)) {
    return errorResponse('invitee_id (UUID)가 필요합니다.', 400);
  }

  const supabase = getServiceRoleClient();

  const [groupResult, inviterResult, settingsResult, tokenResult] = await Promise.all([
    supabase.from('groups').select('name').eq('id', groupId).single(),
    supabase.from('users').select('nickname').eq('id', inviterId).single(),
    supabase
      .from('notification_settings')
      .select('f3_enabled')
      .eq('user_id', inviteeId)
      .maybeSingle(),
    supabase.from('push_tokens').select('token').eq('user_id', inviteeId),
  ]);

  if (groupResult.error) {
    return errorResponse(`groups 조회 실패: ${groupResult.error.message}`, 500);
  }
  if (!groupResult.data) {
    return errorResponse(`group_id=${groupId} not found`, 404);
  }
  if (inviterResult.error) {
    return errorResponse(`users 조회 실패: ${inviterResult.error.message}`, 500);
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

  const groupName = (groupResult.data as { name: string }).name;
  const inviterNickname =
    (inviterResult.data as { nickname: string } | null)?.nickname ?? '';
  const f3Enabled =
    (settingsResult.data as { f3_enabled: boolean } | null)?.f3_enabled ?? null;

  if (!shouldSendF3({ f3Enabled })) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  const tokens = ((tokenResult.data ?? []) as Array<{ token: string }>).map(
    (r) => r.token,
  );
  if (tokens.length === 0) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  const messages = buildF3PushMessages({
    recipient: { userId: inviteeId, tokens },
    inviterNickname,
    groupName,
  });
  const tickets = await sendExpoPushAll(messages);
  const { successfulCount, failures } = partitionPushResponses(messages, tickets);

  if (failures.length > 0) {
    const occurredAt = nowKst().toISO() ?? '';
    buildPartialFailList({
      failures,
      channel: 'f3_push',
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
