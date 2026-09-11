// notify_f4 Edge Function — Deno tests (S12, 전원 투표 완료 push, D17 idempotency)
//
// 실행:
//   deno test functions/notify_f4/_test.ts --no-check

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildF4PushMessages,
  formatF4Body,
  formatF4Title,
  shouldSendF4,
} from './index.ts';

// shouldSendF4
Deno.test('shouldSendF4 — f4_enabled=true → 발송', () => {
  assertEquals(shouldSendF4({ f4Enabled: true }), true);
});
Deno.test('shouldSendF4 — f4_enabled=false → skip', () => {
  assertEquals(shouldSendF4({ f4Enabled: false }), false);
});
Deno.test('shouldSendF4 — settings row 부재 → skip', () => {
  assertEquals(shouldSendF4({ f4Enabled: null }), false);
});

// 마이크로카피
Deno.test('formatF4Title — 모임 이름 포함', () => {
  const title = formatF4Title({ groupName: '안암 저녁' });
  assert(title.includes('안암 저녁'));
});
Deno.test('formatF4Title — 빈 모임 이름 fallback', () => {
  const title = formatF4Title({ groupName: '' });
  assert(title.length > 0);
});
Deno.test('formatF4Body — groupName 포함 + 시간 확정 nudge 톤 (A-10 polish)', () => {
  const body = formatF4Body({ groupName: '안암 저녁' });
  assert(body.includes('안암 저녁'));
  assert(body.includes('확정') || body.includes('시간'));
});
Deno.test('formatF4Body — 빈 groupName fallback', () => {
  const body = formatF4Body({ groupName: '' });
  assert(body.length > 0);
});

// fan-out
Deno.test('buildF4PushMessages — 호스트 다중 디바이스 fan-out', () => {
  const messages = buildF4PushMessages({
    recipient: {
      userId: 'host',
      tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
    },
    groupName: '안암 저녁',
  });
  assertEquals(messages.length, 2);
  assert(messages[0].title.includes('안암 저녁'));
});
Deno.test('buildF4PushMessages — token 0 → 빈', () => {
  const messages = buildF4PushMessages({
    recipient: { userId: 'host', tokens: [] },
    groupName: '안암 저녁',
  });
  assertEquals(messages, []);
});
