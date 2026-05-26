// notify_f1 — 친구 요청 push (F1)
//
// S12. friend_requests INSERT trigger 또는 publisher API에서
// `dispatcher.dispatch({type:'friend_requested', fromUserId, toUserId})` 호출 시
// 본 handler가 in-process 발송 (D33 dispatcher pattern).
//
// 대상 = to_user_id (요청 받은 사람). opt-in = notification_settings.f1_enabled.
// idempotency 컬럼 없음 — friend_requests row 자체가 INSERT-once라 publisher 측에서 중복 방지.
//
// Request: POST { from_user_id: uuid, to_user_id: uuid }
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
  f1Enabled: boolean | null;
}

/** opt-in 체크. settings row 부재(null)는 보수적 skip. */
export function shouldSendF1(args: ShouldSendArgs): boolean {
  return args.f1Enabled === true;
}

export function formatF1Title(): string {
  return '친구 요청';
}

export interface F1BodyArgs {
  fromNickname: string;
}

export function formatF1Body(args: F1BodyArgs): string {
  const nickname = args.fromNickname.trim() || '누군가';
  return `${nickname}님이 친구 요청을 보냈어요`;
}

export interface F1Recipient {
  userId: string;
  tokens: string[];
}

export interface BuildF1MessagesArgs {
  recipient: F1Recipient;
  fromNickname: string;
}

export function buildF1PushMessages(args: BuildF1MessagesArgs): ExpoPushMessage[] {
  const title = formatF1Title();
  const body = formatF1Body({ fromNickname: args.fromNickname });
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

interface NotifyF1Request {
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

  let body: NotifyF1Request;
  try {
    body = (await req.json()) as NotifyF1Request;
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

  // 1) 보낸이 nickname + opt-in + 토큰 병렬 조회
  const [fromUserResult, settingsResult, tokenResult] = await Promise.all([
    supabase.from('users').select('nickname').eq('id', fromUserId).single(),
    supabase
      .from('notification_settings')
      .select('f1_enabled')
      .eq('user_id', toUserId)
      .maybeSingle(),
    supabase.from('push_tokens').select('token').eq('user_id', toUserId),
  ]);

  if (fromUserResult.error) {
    return errorResponse(
      `users 조회 실패: ${fromUserResult.error.message}`,
      500,
    );
  }
  if (settingsResult.error) {
    return errorResponse(
      `notification_settings 조회 실패: ${settingsResult.error.message}`,
      500,
    );
  }
  if (tokenResult.error) {
    return errorResponse(
      `push_tokens 조회 실패: ${tokenResult.error.message}`,
      500,
    );
  }

  const fromNickname =
    (fromUserResult.data as { nickname: string } | null)?.nickname ?? '';
  const f1Enabled =
    (settingsResult.data as { f1_enabled: boolean } | null)?.f1_enabled ?? null;

  if (!shouldSendF1({ f1Enabled })) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  const tokens = ((tokenResult.data ?? []) as Array<{ token: string }>).map(
    (r) => r.token,
  );
  if (tokens.length === 0) {
    // 토큰 없음 — partial_fail_list 기록은 friend_requests에 채널 없음(개인 알림).
    // 베타 운영자가 reports/dashboard 통해 직접 확인. 본 응답으로 skip 표시.
    return jsonResponse({ ok: true, sent: 0, failed: 0, skipped: true });
  }

  // 2) 메시지 빌드 + Expo 발송
  const messages = buildF1PushMessages({
    recipient: { userId: toUserId, tokens },
    fromNickname,
  });
  const tickets = await sendExpoPushAll(messages);
  const { successfulCount, failures } = partitionPushResponses(messages, tickets);

  // partial_fail_list 기록은 F1에서는 생략 (group level 컬럼이 없음).
  // logs는 운영 측 sentry/console로 위임.
  if (failures.length > 0) {
    const occurredAt = nowKst().toISO() ?? '';
    // 빌드만 — 저장 위치는 향후 사용자 알림 inbox 도입 시 확장
    buildPartialFailList({
      failures,
      channel: 'f1_push',
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
