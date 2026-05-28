// notify_publish — F1/F2/F3 publisher (S23)
//
// D33 single dispatcher pattern (votes_aggregate → notify_f4 mirror).
//
// 흐름:
//   1. 클라(friends/api.ts, invitations.ts)가 supabase INSERT/RPC 호출 후
//      `supabase.functions.invoke('notify_publish', { body: {type, ...} })` 호출.
//   2. 본 Edge가 type별로 dispatcher event를 dispatch.
//   3. 모듈 load 시 register된 notify_f{1,2,3} handler들이 in-process로 호출됨.
//   4. 한 handler 실패가 다른 handler 차단 X (Promise.allSettled).
//
// 본 Edge는 push 발송 자체는 하지 않고, dispatcher routing + 검증만 책임.
// 실제 발송은 notify_f{1,2,3} handler가 담당.
//
// Request: POST
//   { type: 'friend_requested', from_user_id, to_user_id }
//   { type: 'friend_accepted',  from_user_id, to_user_id }
//   { type: 'group_invited',    group_id, inviter_id, invitee_id }
// Response: { ok: true, fulfilled: number, rejected: number }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import {
  clearHandlers,
  dispatch,
  register,
  type DispatchEvent,
} from '../_lib/dispatcher.ts';
import { handler as notifyF1Handler } from '../notify_f1/index.ts';
import { handler as notifyF2Handler } from '../notify_f2/index.ts';
import { handler as notifyF3Handler } from '../notify_f3/index.ts';

// ---------------------------------------------------------------------------
// 파싱
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; event: DispatchEvent }
  | { ok: false; error: string };

function isUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export function parsePublishRequest(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 객체여야 합니다.' };
  }
  const obj = input as Record<string, unknown>;
  const type = obj.type;

  if (type === 'friend_requested' || type === 'friend_accepted') {
    const from = obj.from_user_id;
    const to = obj.to_user_id;
    if (!isUuid(from)) {
      return { ok: false, error: 'from_user_id (UUID)가 필요합니다.' };
    }
    if (!isUuid(to)) {
      return { ok: false, error: 'to_user_id (UUID)가 필요합니다.' };
    }
    return {
      ok: true,
      event: { type, fromUserId: from, toUserId: to },
    };
  }

  if (type === 'group_invited') {
    const gid = obj.group_id;
    const inviter = obj.inviter_id;
    const invitee = obj.invitee_id;
    if (!isUuid(gid)) {
      return { ok: false, error: 'group_id (UUID)가 필요합니다.' };
    }
    if (!isUuid(inviter)) {
      return { ok: false, error: 'inviter_id (UUID)가 필요합니다.' };
    }
    if (!isUuid(invitee)) {
      return { ok: false, error: 'invitee_id (UUID)가 필요합니다.' };
    }
    return {
      ok: true,
      event: { type, groupId: gid, inviterId: inviter, inviteeId: invitee },
    };
  }

  return {
    ok: false,
    error: 'type은 friend_requested | friend_accepted | group_invited 중 하나여야 합니다.',
  };
}

// ---------------------------------------------------------------------------
// Dispatcher handler register — 모듈 load 시 1회 (votes_aggregate pattern mirror)
// ---------------------------------------------------------------------------

let handlersRegistered = false;

function registerHandlers(): void {
  if (handlersRegistered) return;

  register('friend_requested', async (event: DispatchEvent) => {
    if (event.type !== 'friend_requested') return;
    const req = new Request('http://internal/notify_f1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_user_id: event.fromUserId,
        to_user_id: event.toUserId,
      }),
    });
    await notifyF1Handler(req);
  });

  register('friend_accepted', async (event: DispatchEvent) => {
    if (event.type !== 'friend_accepted') return;
    const req = new Request('http://internal/notify_f2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_user_id: event.fromUserId,
        to_user_id: event.toUserId,
      }),
    });
    await notifyF2Handler(req);
  });

  register('group_invited', async (event: DispatchEvent) => {
    if (event.type !== 'group_invited') return;
    const req = new Request('http://internal/notify_f3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: event.groupId,
        inviter_id: event.inviterId,
        invitee_id: event.inviteeId,
      }),
    });
    await notifyF3Handler(req);
  });

  handlersRegistered = true;
}

// 테스트에서 dispatcher state를 reset할 때 다시 register 가능하도록 export
export function _resetDispatcherRegistration(): void {
  clearHandlers();
  handlersRegistered = false;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  const parsed = parsePublishRequest(body);
  if (!parsed.ok) {
    return errorResponse(parsed.error, 400);
  }

  registerHandlers();

  const results = await dispatch(parsed.event);
  const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
  const rejected = results.filter((r) => r.status === 'rejected').length;

  return jsonResponse({ ok: true, fulfilled, rejected });
}

if (import.meta.main) {
  serve(handler);
}

export { handler };
