// notify_f2 Edge Function — Deno tests (S12, 친구 수락 push)
//
// 실행:
//   deno test functions/notify_f2/_test.ts --no-check

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildF2PushMessages,
  formatF2Body,
  formatF2Title,
  shouldSendF2,
} from './index.ts';

// shouldSendF2
Deno.test('shouldSendF2 — f2_enabled=true → 발송', () => {
  assertEquals(shouldSendF2({ f2Enabled: true }), true);
});
Deno.test('shouldSendF2 — f2_enabled=false → skip', () => {
  assertEquals(shouldSendF2({ f2Enabled: false }), false);
});
Deno.test('shouldSendF2 — settings row 부재 → skip (보수적)', () => {
  assertEquals(shouldSendF2({ f2Enabled: null }), false);
});

// 마이크로카피
Deno.test('formatF2Title — 고정 "친구 수락"', () => {
  assertEquals(formatF2Title(), '친구 수락');
});
Deno.test('formatF2Body — 수락한 사람 닉네임 친근체', () => {
  const body = formatF2Body({ accepterNickname: '지호' });
  assert(body.includes('지호'));
  assert(body.includes('수락'));
});
Deno.test('formatF2Body — 닉네임 빈 fallback', () => {
  const body = formatF2Body({ accepterNickname: '' });
  assert(body.length > 0);
});

// fan-out
Deno.test('buildF2PushMessages — 다중 디바이스 fan-out', () => {
  const messages = buildF2PushMessages({
    recipient: {
      userId: 'u-from',
      tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
    },
    accepterNickname: '지호',
  });
  assertEquals(messages.length, 2);
  assertEquals(messages[0].title, '친구 수락');
  assert(messages[0].body.includes('지호'));
});
Deno.test('buildF2PushMessages — token 0 → 빈', () => {
  const messages = buildF2PushMessages({
    recipient: { userId: 'u-from', tokens: [] },
    accepterNickname: '지호',
  });
  assertEquals(messages, []);
});
