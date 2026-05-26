// _lib/expo_push — 공통 Expo Push helper Deno tests (S12 base)
//
// notify_f1/f2/f3/f4/f5가 공유하는 Expo Push API 호출 + ticket 분리 + partial fail list 빌드.
//
// 실행:
//   deno test functions/_lib/expo_push_test.ts --no-check

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildPartialFailList,
  partitionPushResponses,
  type ExpoPushTicket,
  type ExpoPushMessage,
} from './expo_push.ts';

// ---------------------------------------------------------------------------
// partitionPushResponses — Expo response → success/fail 분리
// ---------------------------------------------------------------------------
Deno.test('partitionPushResponses — 전부 success', () => {
  const messages: ExpoPushMessage[] = [
    { to: 'tok-a', title: 't', body: 'b', userId: 'u1' },
    { to: 'tok-b', title: 't', body: 'b', userId: 'u2' },
  ];
  const tickets: ExpoPushTicket[] = [
    { status: 'ok', id: 'r1' },
    { status: 'ok', id: 'r2' },
  ];
  const result = partitionPushResponses(messages, tickets);
  assertEquals(result.successfulCount, 2);
  assertEquals(result.failures, []);
});

Deno.test('partitionPushResponses — DeviceNotRegistered → 실패 기록 + reason 명시', () => {
  const messages: ExpoPushMessage[] = [
    { to: 'tok-a', title: 't', body: 'b', userId: 'u1' },
    { to: 'tok-b', title: 't', body: 'b', userId: 'u2' },
  ];
  const tickets: ExpoPushTicket[] = [
    { status: 'ok', id: 'r1' },
    {
      status: 'error',
      message: 'DeviceNotRegistered',
      details: { error: 'DeviceNotRegistered' },
    },
  ];
  const result = partitionPushResponses(messages, tickets);
  assertEquals(result.successfulCount, 1);
  assertEquals(result.failures.length, 1);
  assertEquals(result.failures[0].userId, 'u2');
  assertEquals(result.failures[0].reason, 'DeviceNotRegistered');
});

Deno.test('partitionPushResponses — tickets 부족 시 나머지는 no_ticket 처리', () => {
  const messages: ExpoPushMessage[] = [
    { to: 'tok-a', title: 't', body: 'b', userId: 'u1' },
    { to: 'tok-b', title: 't', body: 'b', userId: 'u2' },
  ];
  const tickets: ExpoPushTicket[] = [{ status: 'ok', id: 'r1' }];
  const result = partitionPushResponses(messages, tickets);
  assertEquals(result.successfulCount, 1);
  assertEquals(result.failures.length, 1);
  assertEquals(result.failures[0].userId, 'u2');
  assertEquals(result.failures[0].reason, 'no_ticket');
});

Deno.test('partitionPushResponses — 빈 messages → 빈 failure', () => {
  const result = partitionPushResponses([], []);
  assertEquals(result.successfulCount, 0);
  assertEquals(result.failures, []);
});

Deno.test('partitionPushResponses — details.error 없으면 message fallback', () => {
  const messages: ExpoPushMessage[] = [
    { to: 'tok-a', title: 't', body: 'b', userId: 'u1' },
  ];
  const tickets: ExpoPushTicket[] = [
    { status: 'error', message: 'Invalid credentials' },
  ];
  const result = partitionPushResponses(messages, tickets);
  assertEquals(result.failures.length, 1);
  assertEquals(result.failures[0].reason, 'Invalid credentials');
});

// ---------------------------------------------------------------------------
// buildPartialFailList — JSONB shape (D19)
// ---------------------------------------------------------------------------
Deno.test('buildPartialFailList — 멤버별 사유 + 채널 + 타임스탬프', () => {
  const list = buildPartialFailList({
    failures: [
      { userId: 'u1', reason: 'DeviceNotRegistered' },
      { userId: 'u2', reason: 'no_token' },
    ],
    channel: 'f3_push',
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(list.length, 2);
  assertEquals(list[0], {
    user_id: 'u1',
    reason: 'DeviceNotRegistered',
    channel: 'f3_push',
    occurred_at: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(list[1].user_id, 'u2');
});

Deno.test('buildPartialFailList — 빈 failures → 빈 array', () => {
  const list = buildPartialFailList({
    failures: [],
    channel: 'f1_push',
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(list, []);
});

Deno.test('buildPartialFailList — 채널별 분리 (f1/f2/f3/f4/f5)', () => {
  for (const channel of ['f1_push', 'f2_push', 'f3_push', 'f4_push', 'f5_push']) {
    const list = buildPartialFailList({
      failures: [{ userId: 'u1', reason: 'x' }],
      channel,
      occurredAtKstIso: '2026-05-26T20:00:00+09:00',
    });
    assertEquals(list[0].channel, channel);
  }
  assert(true);
});
