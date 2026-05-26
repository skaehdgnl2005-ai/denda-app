// notify_f4 — 전원 투표 완료 push (F4, D17 idempotency)
//
// S12. votes_aggregate Edge Function이 전원 vote 완료 detect 시
// `dispatcher.dispatch({type:'votes_all_in', groupId})` 호출 (publisher는 별도 sub-task).
// 본 handler가 in-process 발송.
//
// 대상 = groups.host_id (호스트만 — "모두 시간 골랐으니 확정해주세요" nudge).
// opt-in = 호스트의 notification_settings.f4_enabled.
// **idempotent**: groups.f4_sent_at IS NULL → SET NOW (D17). 이미 SET이면 skip.
//
// Request: POST { group_id: uuid }
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
  type PartialFailEntry,
} from '../_lib/expo_push.ts';

// ---------------------------------------------------------------------------
// 순수 함수
// ---------------------------------------------------------------------------

export interface ShouldSendArgs {
  f4Enabled: boolean | null;
}

export function shouldSendF4(args: ShouldSendArgs): boolean {
  return args.f4Enabled === true;
}

export interface F4TitleArgs {
  groupName: string;
}

export function formatF4Title(args: F4TitleArgs): string {
  const name = args.groupName.trim() || '모임';
  return `${name} 멤버가 모두 시간을 골랐어요`;
}

export function formatF4Body(): string {
  return '이제 시간을 확정해주세요';
}

export interface F4Recipient {
  userId: string;
  tokens: string[];
}

export interface BuildF4MessagesArgs {
  recipient: F4Recipient;
  groupName: string;
}

export function buildF4PushMessages(args: BuildF4MessagesArgs): ExpoPushMessage[] {
  const title = formatF4Title({ groupName: args.groupName });
  const body = formatF4Body();
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

interface NotifyF4Request {
  group_id?: string;
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

  let body: NotifyF4Request;
  try {
    body = (await req.json()) as NotifyF4Request;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  const groupId = body.group_id;
  if (!groupId || !isUuid(groupId)) {
    return errorResponse('group_id (UUID)가 필요합니다.', 400);
  }

  const supabase = getServiceRoleClient();

  // 1) groups 조회 + f4_sent_at idempotency 체크
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name, host_id, f4_sent_at')
    .eq('id', groupId)
    .single();

  if (groupError) {
    return errorResponse(`groups 조회 실패: ${groupError.message}`, 500);
  }
  if (!group) {
    return errorResponse(`group_id=${groupId} not found`, 404);
  }

  const g = group as {
    id: string;
    name: string;
    host_id: string;
    f4_sent_at: string | null;
  };

  if (g.f4_sent_at) {
    // 이미 발송됨 → skip (D17 mirror)
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  // 2) 호스트 opt-in + 토큰 병렬 조회
  const [settingsResult, tokenResult] = await Promise.all([
    supabase
      .from('notification_settings')
      .select('f4_enabled')
      .eq('user_id', g.host_id)
      .maybeSingle(),
    supabase.from('push_tokens').select('token').eq('user_id', g.host_id),
  ]);

  if (settingsResult.error) {
    return errorResponse(
      `notification_settings 조회 실패: ${settingsResult.error.message}`,
      500,
    );
  }
  if (tokenResult.error) {
    return errorResponse(`push_tokens 조회 실패: ${tokenResult.error.message}`, 500);
  }

  const f4Enabled =
    (settingsResult.data as { f4_enabled: boolean } | null)?.f4_enabled ?? null;

  // f4_sent_at 조건부 UPDATE — opt-out / token 없음 case에도 set해서 재호출 방지
  const sentAt = nowKst().toISO() ?? '';

  if (!shouldSendF4({ f4Enabled })) {
    await supabase
      .from('groups')
      .update({ f4_sent_at: sentAt })
      .eq('id', groupId)
      .is('f4_sent_at', null);
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  const tokens = ((tokenResult.data ?? []) as Array<{ token: string }>).map(
    (r) => r.token,
  );
  if (tokens.length === 0) {
    await supabase
      .from('groups')
      .update({ f4_sent_at: sentAt })
      .eq('id', groupId)
      .is('f4_sent_at', null);
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  // 3) 메시지 빌드 + Expo 발송
  const messages = buildF4PushMessages({
    recipient: { userId: g.host_id, tokens },
    groupName: g.name,
  });
  const tickets = await sendExpoPushAll(messages);
  const { successfulCount, failures } = partitionPushResponses(messages, tickets);

  // 4) f4_sent_at SET (idempotent — 이미 SET 됐으면 0 rows OK, D17)
  await supabase
    .from('groups')
    .update({ f4_sent_at: sentAt })
    .eq('id', groupId)
    .is('f4_sent_at', null);

  // 5) partial_fail_list 누적 기록
  if (failures.length > 0) {
    const newEntries = buildPartialFailList({
      failures,
      channel: 'f4_push',
      occurredAtKstIso: sentAt,
    });
    const { data: current } = await supabase
      .from('groups')
      .select('partial_fail_list')
      .eq('id', groupId)
      .single();
    const existing = ((current as { partial_fail_list: PartialFailEntry[] } | null)
      ?.partial_fail_list ?? []) as PartialFailEntry[];
    await supabase
      .from('groups')
      .update({ partial_fail_list: [...existing, ...newEntries] })
      .eq('id', groupId);
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
