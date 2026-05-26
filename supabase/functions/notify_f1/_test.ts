// notify_f1 Edge Function — Deno tests (S12, 친구 요청 push)
//
// 실행:
//   deno test functions/notify_f1/_test.ts --no-check

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildF1PushMessages,
  formatF1Body,
  formatF1Title,
  shouldSendF1,
} from './index.ts';

// ---------------------------------------------------------------------------
// shouldSendF1 — opt-in 체크 (f1_enabled)
// ---------------------------------------------------------------------------
Deno.test('shouldSendF1 — f1_enabled=true → 발송', () => {
  assertEquals(shouldSendF1({ f1Enabled: true }), true);
});

Deno.test('shouldSendF1 — f1_enabled=false → skip', () => {
  assertEquals(shouldSendF1({ f1Enabled: false }), false);
});

Deno.test('shouldSendF1 — settings row 부재 (null) → skip (보수적)', () => {
  assertEquals(shouldSendF1({ f1Enabled: null }), false);
});

// ---------------------------------------------------------------------------
// formatF1Title / formatF1Body — 한국어 마이크로카피
// ---------------------------------------------------------------------------
Deno.test('formatF1Title — 고정 타이틀 "친구 요청"', () => {
  const title = formatF1Title();
  assertEquals(title, '친구 요청');
});

Deno.test('formatF1Body — 보낸이 닉네임 포함 친근체', () => {
  const body = formatF1Body({ fromNickname: '민지' });
  // 친근체 + 닉네임 포함
  assert(body.includes('민지'));
  assert(body.includes('친구'));
});

Deno.test('formatF1Body — 닉네임 빈 문자열 → 기본 fallback', () => {
  const body = formatF1Body({ fromNickname: '' });
  // 빈 문자열일 때도 깨지지 않음 (의미적 자연 fallback)
  assert(body.length > 0);
});

// ---------------------------------------------------------------------------
// buildF1PushMessages — recipient의 다중 디바이스 fan-out
// ---------------------------------------------------------------------------
Deno.test('buildF1PushMessages — recipient 1대 디바이스', () => {
  const messages = buildF1PushMessages({
    recipient: { userId: 'u-to', tokens: ['ExponentPushToken[abc]'] },
    fromNickname: '민지',
  });
  assertEquals(messages.length, 1);
  assertEquals(messages[0].to, 'ExponentPushToken[abc]');
  assertEquals(messages[0].userId, 'u-to');
  assertEquals(messages[0].title, '친구 요청');
  assert(messages[0].body.includes('민지'));
});

Deno.test('buildF1PushMessages — recipient 다중 디바이스 fan-out', () => {
  const messages = buildF1PushMessages({
    recipient: {
      userId: 'u-to',
      tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
    },
    fromNickname: '민지',
  });
  assertEquals(messages.length, 2);
  assertEquals(messages[0].to, 'ExponentPushToken[a]');
  assertEquals(messages[1].to, 'ExponentPushToken[b]');
});

Deno.test('buildF1PushMessages — token 0 → 빈 array', () => {
  const messages = buildF1PushMessages({
    recipient: { userId: 'u-to', tokens: [] },
    fromNickname: '민지',
  });
  assertEquals(messages, []);
});
