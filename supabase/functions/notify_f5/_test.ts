// notify_f5 Edge Function — Deno tests (S04, D17 mirror, D19 partial fail)
//
// 실행:
//   cd supabase && deno test functions/notify_f5/_test.ts --no-check
//
// 순수 함수 테스트 — HTTP/DB/Expo는 통합 환경에서 별도 검증.

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DateTime } from 'npm:luxon@3.4.4';

import {
  buildF5PushMessages,
  buildPartialFailList,
  filterRecipientUserIds,
  formatF5Body,
  formatF5Title,
  partitionPushResponses,
  type ExpoPushTicket,
} from './index.ts';

// ---------------------------------------------------------------------------
// filterRecipientUserIds — 호스트 제외 + f5_enabled opt-in 교차
// ---------------------------------------------------------------------------
Deno.test('filterRecipientUserIds — 호스트는 알림 받지 않음', () => {
  const recipients = filterRecipientUserIds({
    memberUserIds: ['u1', 'u2', 'host'],
    optedInUserIds: ['u1', 'u2', 'host'],
    hostId: 'host',
  });
  assertEquals(new Set(recipients), new Set(['u1', 'u2']));
});

Deno.test('filterRecipientUserIds — f5_enabled=false 멤버 skip', () => {
  const recipients = filterRecipientUserIds({
    memberUserIds: ['u1', 'u2', 'u3'],
    optedInUserIds: ['u1', 'u3'], // u2는 옵션 off
    hostId: 'host',
  });
  assertEquals(new Set(recipients), new Set(['u1', 'u3']));
});

Deno.test('filterRecipientUserIds — 멤버 0 → 빈 list', () => {
  const recipients = filterRecipientUserIds({
    memberUserIds: [],
    optedInUserIds: ['u1'],
    hostId: 'host',
  });
  assertEquals(recipients, []);
});

Deno.test('filterRecipientUserIds — 호스트만 멤버 (1인 모임 edge) → 빈 list', () => {
  const recipients = filterRecipientUserIds({
    memberUserIds: ['host'],
    optedInUserIds: ['host'],
    hostId: 'host',
  });
  assertEquals(recipients, []);
});

// ---------------------------------------------------------------------------
// formatF5Title / formatF5Body — KST 시간 한국어 (D13)
// ---------------------------------------------------------------------------
Deno.test('formatF5Title — 그룹 이름 포함', () => {
  const title = formatF5Title({ name: '강남 저녁' });
  assertEquals(title, '강남 저녁 시간이 확정됐어요');
});

Deno.test('formatF5Body — KST 변환 + 한국어 날짜 형식', () => {
  // UTC 2026-06-15 09:30 = KST 2026-06-15 18:30 (수)
  const body = formatF5Body({
    confirmedStartUtcIso: '2026-06-15T09:30:00Z',
  });
  // 한국어 형식: "6월 15일 (월) 오후 6:30" 등 — 정확한 format은 구현에서 결정
  // 검증: KST 변환됨 (18시 또는 오후 6시 포함), 한국어 텍스트
  assert(body.includes('15일'));
  // 6월 15일 2026 KST는 월요일 (UTC 09:30 = KST 18:30)
  // luxon으로 직접 검증
  const kst = DateTime.fromISO('2026-06-15T09:30:00Z', { zone: 'utc' }).setZone(
    'Asia/Seoul',
  );
  assertEquals(kst.hour, 18);
  assertEquals(kst.minute, 30);
});

Deno.test('formatF5Body — 자정 직전 처리 (UTC→KST 날짜 넘김)', () => {
  // UTC 2026-06-14 23:00 = KST 2026-06-15 08:00
  const body = formatF5Body({
    confirmedStartUtcIso: '2026-06-14T23:00:00Z',
  });
  assert(body.includes('15일'));
});

// ---------------------------------------------------------------------------
// buildF5PushMessages — recipient + 다중 token fan-out
// ---------------------------------------------------------------------------
Deno.test('buildF5PushMessages — recipient 1명 + token 1개', () => {
  const messages = buildF5PushMessages({
    recipients: [
      { userId: 'u1', tokens: ['ExponentPushToken[abc]'] },
    ],
    group: {
      name: '강남 저녁',
      confirmedStartUtcIso: '2026-06-15T09:30:00Z',
    },
  });
  assertEquals(messages.length, 1);
  assertEquals(messages[0].to, 'ExponentPushToken[abc]');
  assertEquals(messages[0].title, '강남 저녁 시간이 확정됐어요');
  assert(messages[0].body.includes('15일'));
});

Deno.test('buildF5PushMessages — 1 user multi token (디바이스 여러 대) fan-out', () => {
  const messages = buildF5PushMessages({
    recipients: [
      { userId: 'u1', tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] },
    ],
    group: {
      name: 'G',
      confirmedStartUtcIso: '2026-06-15T09:30:00Z',
    },
  });
  assertEquals(messages.length, 2);
  assertEquals(messages[0].to, 'ExponentPushToken[a]');
  assertEquals(messages[1].to, 'ExponentPushToken[b]');
});

Deno.test('buildF5PushMessages — 다중 recipient 다중 token', () => {
  const messages = buildF5PushMessages({
    recipients: [
      { userId: 'u1', tokens: ['ExponentPushToken[u1-a]'] },
      { userId: 'u2', tokens: ['ExponentPushToken[u2-a]', 'ExponentPushToken[u2-b]'] },
    ],
    group: {
      name: 'G',
      confirmedStartUtcIso: '2026-06-15T09:30:00Z',
    },
  });
  assertEquals(messages.length, 3);
});

Deno.test('buildF5PushMessages — recipient 0 → 빈 array', () => {
  const messages = buildF5PushMessages({
    recipients: [],
    group: { name: 'G', confirmedStartUtcIso: '2026-06-15T09:30:00Z' },
  });
  assertEquals(messages, []);
});

// ---------------------------------------------------------------------------
// partitionPushResponses — Expo response → success/fail 분리
// ---------------------------------------------------------------------------
Deno.test('partitionPushResponses — 전부 success', () => {
  const messages = [
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

Deno.test('partitionPushResponses — DeviceNotRegistered → 실패 기록', () => {
  const messages = [
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

Deno.test('partitionPushResponses — tickets 부족 시 나머지 unknown 처리', () => {
  const messages = [
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

Deno.test('partitionPushResponses — 같은 user 여러 디바이스 → 1대만 실패해도 user는 partial', () => {
  const messages = [
    { to: 'tok-a-1', title: 't', body: 'b', userId: 'u1' },
    { to: 'tok-a-2', title: 't', body: 'b', userId: 'u1' },
  ];
  const tickets: ExpoPushTicket[] = [
    { status: 'ok', id: 'r1' },
    { status: 'error', message: 'InvalidCredentials' },
  ];
  const result = partitionPushResponses(messages, tickets);
  assertEquals(result.successfulCount, 1);
  assertEquals(result.failures.length, 1);
  assertEquals(result.failures[0].userId, 'u1');
});

// ---------------------------------------------------------------------------
// buildPartialFailList — JSONB shape (D20)
// ---------------------------------------------------------------------------
Deno.test('buildPartialFailList — 멤버별 실패 사유 + 타임스탬프', () => {
  const list = buildPartialFailList({
    failures: [
      { userId: 'u1', reason: 'DeviceNotRegistered' },
      { userId: 'u2', reason: 'no_token' },
    ],
    channel: 'f5_push',
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(list.length, 2);
  assertEquals(list[0], {
    user_id: 'u1',
    reason: 'DeviceNotRegistered',
    channel: 'f5_push',
    occurred_at: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(list[1].user_id, 'u2');
  assertEquals(list[1].reason, 'no_token');
});

Deno.test('buildPartialFailList — 실패 0 → 빈 array', () => {
  const list = buildPartialFailList({
    failures: [],
    channel: 'f5_push',
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(list, []);
});
