// notify_f5 — 모임 확정 푸시 (F5)
//
// S04 의존. group_confirm Edge Function이 dispatcher publish 시점 또는 fallback HTTP로 호출.
// idempotency: groups.f5_sent_at IS NULL → SET NOW(). 이미 발송됐으면 skip (D17 mirror).
// partial fail: 일부 멤버 push 실패 시 groups.partial_fail_list JSONB에 기록 (D19).
//
// Push 발송 대상 = group_members ∩ notification_settings.f5_enabled=true ∖ host.
// 호스트는 본인이 trigger했으므로 알림 불필요.
//
// Request: POST { group_id: string }
// Response: { ok: true, sent: number, failed: number, skipped: boolean }
//
// 환경변수:
//   SUPABASE_URL                — 자동
//   SUPABASE_SERVICE_ROLE_KEY   — 자동
//   EXPO_ACCESS_TOKEN           — optional (Expo push enhanced security)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { DateTime } from 'npm:luxon@3.4.4';

import { getServiceRoleClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import { nowKst } from '../_lib/kst.ts';
import {
  buildPartialFailList,
  partitionPushResponses,
  sendExpoPushAll,
  type ExpoPushMessage,
  type ExpoPushTicket,
  type PartialFailEntry,
  type PushFailure,
} from '../_lib/expo_push.ts';

// ---------------------------------------------------------------------------
// 순수 함수: recipient 필터 / 메시지 빌드 / response 분리
// ---------------------------------------------------------------------------

export interface FilterRecipientArgs {
  memberUserIds: string[];
  optedInUserIds: string[];
  hostId: string;
}

/**
 * 알림 대상 user_id 산출. 호스트 제외 + opt-in 교차.
 */
export function filterRecipientUserIds(args: FilterRecipientArgs): string[] {
  const optInSet = new Set(args.optedInUserIds);
  return args.memberUserIds.filter(
    (id) => id !== args.hostId && optInSet.has(id),
  );
}

export interface F5GroupContext {
  name: string;
  confirmedStartUtcIso: string;
}

const KST_ZONE = 'Asia/Seoul';
const WEEKDAY_KO = ['월', '화', '수', '목', '금', '토', '일'];

export function formatF5Title(group: { name: string }): string {
  return `${group.name} 시간이 확정됐어요`;
}

/**
 * F5 push body. KST 변환 + 한국어 날짜 (D13).
 * 예: "6월 15일 (월) 오후 6:30"
 */
export function formatF5Body(group: { confirmedStartUtcIso: string }): string {
  const kst = DateTime.fromISO(group.confirmedStartUtcIso, { zone: 'utc' }).setZone(
    KST_ZONE,
  );
  // luxon weekday: 1=월, 7=일 → 0-based index로 변환
  const weekdayKo = WEEKDAY_KO[(kst.weekday - 1) % 7];
  const hour24 = kst.hour;
  const minute = kst.minute;
  const ampm = hour24 < 12 ? '오전' : '오후';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minutePart = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`;
  return `${kst.month}월 ${kst.day}일 (${weekdayKo}) ${ampm} ${hour12}${minutePart}`;
}

export interface Recipient {
  userId: string;
  tokens: string[];
}

export type F5PushMessage = ExpoPushMessage;

export interface BuildF5MessagesArgs {
  recipients: Recipient[];
  group: F5GroupContext;
}

export function buildF5PushMessages(args: BuildF5MessagesArgs): F5PushMessage[] {
  const title = formatF5Title(args.group);
  const body = formatF5Body(args.group);
  const out: F5PushMessage[] = [];
  for (const recipient of args.recipients) {
    for (const token of recipient.tokens) {
      out.push({ to: token, title, body, userId: recipient.userId });
    }
  }
  return out;
}

// partitionPushResponses · buildPartialFailList · sendExpoPushAll · 관련 type:
// _lib/expo_push.ts로 추출 (S12). re-export로 기존 caller 호환 유지.
export {
  buildPartialFailList,
  partitionPushResponses,
  type ExpoPushTicket,
  type PartialFailEntry,
  type PushFailure,
};

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

interface NotifyF5Request {
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

  let body: NotifyF5Request;
  try {
    body = (await req.json()) as NotifyF5Request;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  const groupId = body.group_id;
  if (!groupId || !isUuid(groupId)) {
    return errorResponse('group_id (UUID)가 필요합니다.', 400);
  }

  const supabase = getServiceRoleClient();

  // 1) groups 조회 + idempotency 시도 (f5_sent_at IS NULL → SET NOW)
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name, host_id, confirmed_at, confirmed_start_at, f5_sent_at')
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
    confirmed_at: string | null;
    confirmed_start_at: string | null;
    f5_sent_at: string | null;
  };

  if (!g.confirmed_at || !g.confirmed_start_at) {
    return errorResponse('아직 확정되지 않은 모임입니다.', 400);
  }
  if (g.f5_sent_at) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  // 2) 멤버 + opt-in + 토큰 조회 (병렬)
  const [memberResult, settingsResult] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
    supabase
      .from('notification_settings')
      .select('user_id')
      .eq('f5_enabled', true),
  ]);
  if (memberResult.error) {
    return errorResponse(`group_members 조회 실패: ${memberResult.error.message}`, 500);
  }
  if (settingsResult.error) {
    return errorResponse(
      `notification_settings 조회 실패: ${settingsResult.error.message}`,
      500,
    );
  }
  const memberUserIds = (memberResult.data ?? []).map(
    (r) => (r as { user_id: string }).user_id,
  );
  const optedInUserIds = (settingsResult.data ?? []).map(
    (r) => (r as { user_id: string }).user_id,
  );

  const recipientIds = filterRecipientUserIds({
    memberUserIds,
    optedInUserIds,
    hostId: g.host_id,
  });

  if (recipientIds.length === 0) {
    // 받을 사람 없음 → 그래도 f5_sent_at SET (재호출 방지)
    await supabase
      .from('groups')
      .update({ f5_sent_at: nowKst().toISO() })
      .eq('id', groupId)
      .is('f5_sent_at', null);
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: false });
  }

  const { data: tokenRows, error: tokenError } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', recipientIds);
  if (tokenError) {
    return errorResponse(`push_tokens 조회 실패: ${tokenError.message}`, 500);
  }

  // 3) recipient → tokens 매핑 (1 user N device)
  const tokensByUser = new Map<string, string[]>();
  for (const row of (tokenRows ?? []) as Array<{ user_id: string; token: string }>) {
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.token);
    tokensByUser.set(row.user_id, list);
  }

  const recipients: Recipient[] = recipientIds.map((userId) => ({
    userId,
    tokens: tokensByUser.get(userId) ?? [],
  }));

  // 4) 토큰 없는 recipient는 미리 failure로 기록
  const preFailures: PushFailure[] = recipients
    .filter((r) => r.tokens.length === 0)
    .map((r) => ({ userId: r.userId, reason: 'no_token' }));

  // 5) 메시지 빌드 + Expo 발송
  const messages = buildF5PushMessages({
    recipients: recipients.filter((r) => r.tokens.length > 0),
    group: { name: g.name, confirmedStartUtcIso: g.confirmed_start_at },
  });
  const tickets = await sendExpoPushAll(messages);
  const { successfulCount, failures: pushFailures } = partitionPushResponses(
    messages,
    tickets,
  );
  const allFailures = [...preFailures, ...pushFailures];

  // 6) f5_sent_at SET (idempotent — 이미 SET 됐으면 0 rows OK)
  const sentAt = nowKst().toISO() ?? '';
  await supabase
    .from('groups')
    .update({ f5_sent_at: sentAt })
    .eq('id', groupId)
    .is('f5_sent_at', null);

  // 7) partial_fail_list 누적 기록 (있을 때만)
  if (allFailures.length > 0) {
    const occurredAt = sentAt;
    const newEntries = buildPartialFailList({
      failures: allFailures,
      channel: 'f5_push',
      occurredAtKstIso: occurredAt,
    });
    // 기존 list와 병합 (race 시 마지막이 이김 — 베타 수용)
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
    failed: allFailures.length,
    skipped: false,
  });
}

if (import.meta.main) {
  serve(handler);
}

export { handler };
