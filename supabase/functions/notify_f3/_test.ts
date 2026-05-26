// notify_f3 Edge Function — Deno tests (S12, 모임 초대 push)
//
// 실행:
//   deno test functions/notify_f3/_test.ts --no-check

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildF3PushMessages,
  formatF3Body,
  formatF3Title,
  shouldSendF3,
} from './index.ts';

// shouldSendF3
Deno.test('shouldSendF3 — f3_enabled=true → 발송', () => {
  assertEquals(shouldSendF3({ f3Enabled: true }), true);
});
Deno.test('shouldSendF3 — f3_enabled=false → skip', () => {
  assertEquals(shouldSendF3({ f3Enabled: false }), false);
});
Deno.test('shouldSendF3 — settings null → skip', () => {
  assertEquals(shouldSendF3({ f3Enabled: null }), false);
});

// 마이크로카피
Deno.test('formatF3Title — 모임 이름 포함', () => {
  const title = formatF3Title({ groupName: '안암 저녁' });
  // 모임 이름이 카드 1줄에 노출되도록 본문 아닌 title 사용
  assert(title.includes('안암 저녁'));
});

Deno.test('formatF3Title — 빈 모임 이름 fallback', () => {
  const title = formatF3Title({ groupName: '' });
  assert(title.length > 0);
});

Deno.test('formatF3Body — 초대한 사람 닉네임 친근체', () => {
  const body = formatF3Body({ inviterNickname: '민지' });
  assert(body.includes('민지'));
  assert(body.includes('초대'));
});

Deno.test('formatF3Body — 빈 닉네임 fallback', () => {
  const body = formatF3Body({ inviterNickname: '' });
  assert(body.length > 0);
});

// fan-out
Deno.test('buildF3PushMessages — 모임 이름 + 초대자 + 다중 디바이스', () => {
  const messages = buildF3PushMessages({
    recipient: {
      userId: 'u-invitee',
      tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
    },
    inviterNickname: '민지',
    groupName: '안암 저녁',
  });
  assertEquals(messages.length, 2);
  assert(messages[0].title.includes('안암 저녁'));
  assert(messages[0].body.includes('민지'));
});

Deno.test('buildF3PushMessages — token 0 → 빈', () => {
  const messages = buildF3PushMessages({
    recipient: { userId: 'u-invitee', tokens: [] },
    inviterNickname: '민지',
    groupName: '안암 저녁',
  });
  assertEquals(messages, []);
});
