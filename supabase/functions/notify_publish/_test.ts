// notify_publish — Deno tests (S23: F1/F2/F3 publisher wire-up)
//
// 책임:
//   - HTTP POST body의 event type을 parse + 검증
//   - 모듈 load 시 register notify_f{1,2,3} handler (idempotent)
//   - dispatch.dispatch로 in-process fan-out (votes_aggregate F4 pattern mirror, D33)
//
// 실행:
//   cd supabase && deno test functions/notify_publish/_test.ts --no-check

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  parsePublishRequest,
  handler,
  _resetDispatcherRegistration,
} from './index.ts';
import {
  register,
  listHandlers,
  type DispatchEvent,
} from '../_lib/dispatcher.ts';

const U1 = '11111111-2222-3333-4444-555555555555';
const U2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const U3 = '12345678-1234-1234-1234-123456789abc';

// ---------------------------------------------------------------------------
// parsePublishRequest — pure 함수 검증
// ---------------------------------------------------------------------------

Deno.test('parsePublishRequest — friend_requested 유효 → camelCase event', () => {
  const r = parsePublishRequest({
    type: 'friend_requested',
    from_user_id: U1,
    to_user_id: U2,
  });
  assertEquals(r.ok, true);
  if (r.ok && r.event.type === 'friend_requested') {
    assertEquals(r.event.fromUserId, U1);
    assertEquals(r.event.toUserId, U2);
  }
});

Deno.test('parsePublishRequest — friend_accepted 유효', () => {
  const r = parsePublishRequest({
    type: 'friend_accepted',
    from_user_id: U1,
    to_user_id: U2,
  });
  assertEquals(r.ok, true);
  if (r.ok && r.event.type === 'friend_accepted') {
    assertEquals(r.event.fromUserId, U1);
    assertEquals(r.event.toUserId, U2);
  }
});

Deno.test('parsePublishRequest — group_invited 유효', () => {
  const r = parsePublishRequest({
    type: 'group_invited',
    group_id: U1,
    inviter_id: U2,
    invitee_id: U3,
  });
  assertEquals(r.ok, true);
  if (r.ok && r.event.type === 'group_invited') {
    assertEquals(r.event.groupId, U1);
    assertEquals(r.event.inviterId, U2);
    assertEquals(r.event.inviteeId, U3);
  }
});

Deno.test('parsePublishRequest — UUID 형식 위반 → ok=false', () => {
  const r = parsePublishRequest({
    type: 'friend_requested',
    from_user_id: 'not-uuid',
    to_user_id: U2,
  });
  assertEquals(r.ok, false);
});

Deno.test('parsePublishRequest — unknown type → ok=false', () => {
  const r = parsePublishRequest({ type: 'unknown_event' });
  assertEquals(r.ok, false);
});

Deno.test('parsePublishRequest — group_invited 필수 필드 누락 → ok=false', () => {
  const r = parsePublishRequest({ type: 'group_invited', group_id: U1 });
  assertEquals(r.ok, false);
});

Deno.test('parsePublishRequest — body 객체 아님 → ok=false', () => {
  const r = parsePublishRequest('hello');
  assertEquals(r.ok, false);
});

Deno.test('parsePublishRequest — null → ok=false', () => {
  const r = parsePublishRequest(null);
  assertEquals(r.ok, false);
});

// ---------------------------------------------------------------------------
// HTTP handler — register/dispatch 통합 동작
// ---------------------------------------------------------------------------

Deno.test('handler — POST friend_requested → dispatcher 통해 handler 호출', async () => {
  _resetDispatcherRegistration();

  // spy handler를 별도 register — dispatch 호출 시 함께 trigger되는지 검증.
  // (notify_f1.handler는 service role 미설정으로 throw 가능 → Promise.allSettled로 격리)
  const captured: DispatchEvent[] = [];
  register('friend_requested', (event) => {
    captured.push(event);
  });

  const req = new Request('http://internal/notify_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'friend_requested',
      from_user_id: U1,
      to_user_id: U2,
    }),
  });
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(captured.length, 1);
  assertEquals(captured[0].type, 'friend_requested');
  if (captured[0].type === 'friend_requested') {
    assertEquals(captured[0].fromUserId, U1);
    assertEquals(captured[0].toUserId, U2);
  }
});

Deno.test('handler — POST friend_accepted → dispatch friend_accepted handler 호출', async () => {
  _resetDispatcherRegistration();
  const captured: DispatchEvent[] = [];
  register('friend_accepted', (event) => {
    captured.push(event);
  });

  const req = new Request('http://internal/notify_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'friend_accepted',
      from_user_id: U1,
      to_user_id: U2,
    }),
  });
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(captured.length, 1);
  assertEquals(captured[0].type, 'friend_accepted');
});

Deno.test('handler — POST group_invited → dispatch group_invited handler 호출', async () => {
  _resetDispatcherRegistration();
  const captured: DispatchEvent[] = [];
  register('group_invited', (event) => {
    captured.push(event);
  });

  const req = new Request('http://internal/notify_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'group_invited',
      group_id: U1,
      inviter_id: U2,
      invitee_id: U3,
    }),
  });
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(captured.length, 1);
  assertEquals(captured[0].type, 'group_invited');
  if (captured[0].type === 'group_invited') {
    assertEquals(captured[0].groupId, U1);
    assertEquals(captured[0].inviterId, U2);
    assertEquals(captured[0].inviteeId, U3);
  }
});

Deno.test('handler — non-POST → 405', async () => {
  _resetDispatcherRegistration();
  const req = new Request('http://internal/notify_publish', { method: 'GET' });
  const res = await handler(req);
  assertEquals(res.status, 405);
});

Deno.test('handler — invalid JSON → 400', async () => {
  _resetDispatcherRegistration();
  const req = new Request('http://internal/notify_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json',
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});

Deno.test('handler — unknown type → 400', async () => {
  _resetDispatcherRegistration();
  const req = new Request('http://internal/notify_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'unknown' }),
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});

Deno.test('handler — OPTIONS preflight → 200 (CORS)', async () => {
  _resetDispatcherRegistration();
  const req = new Request('http://internal/notify_publish', { method: 'OPTIONS' });
  const res = await handler(req);
  // OPTIONS preflight는 보통 204 또는 200
  assert(res.status === 200 || res.status === 204);
});

Deno.test('handler — 모듈 register 3 types (notify_f1/f2/f3)', async () => {
  _resetDispatcherRegistration();

  const req = new Request('http://internal/notify_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'friend_requested',
      from_user_id: U1,
      to_user_id: U2,
    }),
  });
  await handler(req);

  assertEquals(listHandlers('friend_requested').length, 1);
  assertEquals(listHandlers('friend_accepted').length, 1);
  assertEquals(listHandlers('group_invited').length, 1);
});

Deno.test('handler — idempotent register (멀티 호출 시 1회만)', async () => {
  _resetDispatcherRegistration();

  for (let i = 0; i < 3; i++) {
    const req = new Request('http://internal/notify_publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'friend_requested',
        from_user_id: U1,
        to_user_id: U2,
      }),
    });
    await handler(req);
  }

  // 3회 호출했지만 register는 1번만 (handlersRegistered flag)
  assertEquals(listHandlers('friend_requested').length, 1);
  assertEquals(listHandlers('friend_accepted').length, 1);
  assertEquals(listHandlers('group_invited').length, 1);
});
