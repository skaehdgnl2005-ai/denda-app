// attribution_test.ts — D28 attribution helper 단위 테스트
// 실행: deno test --allow-env supabase/functions/_lib/attribution_test.ts

import {
  assertEquals,
  assertThrows,
  assertMatch,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildMatchFilters,
  FINGERPRINT_MATCH_WINDOW_HOURS,
  fingerprintMatchSince,
  isInviteCode,
  isUuid,
  parseClickLogRequest,
  parseResolveRequest,
} from './attribution.ts';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

// --- isUuid / isInviteCode ------------------------------------------------

Deno.test('isUuid: valid UUID', () => {
  assertEquals(isUuid(VALID_UUID), true);
});

Deno.test('isUuid: invalid (not UUID format)', () => {
  assertEquals(isUuid('abc'), false);
  assertEquals(isUuid(''), false);
  assertEquals(isUuid(123), false);
  assertEquals(isUuid(null), false);
});

Deno.test('isInviteCode: 4자리 numeric', () => {
  assertEquals(isInviteCode('0000'), true);
  assertEquals(isInviteCode('9999'), true);
  assertEquals(isInviteCode('1234'), true);
});

Deno.test('isInviteCode: 4자리 아니면 false', () => {
  assertEquals(isInviteCode('123'), false);
  assertEquals(isInviteCode('12345'), false);
  assertEquals(isInviteCode('abcd'), false);
  assertEquals(isInviteCode(''), false);
  assertEquals(isInviteCode(1234), false);
});

// --- parseClickLogRequest -------------------------------------------------

Deno.test('parseClickLogRequest: 정상 입력', () => {
  const out = parseClickLogRequest({
    branch_link_id: 'token123',
    group_id: VALID_UUID,
    guest_token: VALID_UUID,
  });
  assertEquals(out.branchLinkId, 'token123');
  assertEquals(out.groupId, VALID_UUID);
  assertEquals(out.guestToken, VALID_UUID);
});

Deno.test('parseClickLogRequest: branch_link_id 누락 throw', () => {
  assertThrows(
    () => parseClickLogRequest({ group_id: VALID_UUID, guest_token: VALID_UUID }),
    Error,
    'branch_link_id',
  );
});

Deno.test('parseClickLogRequest: group_id 누락 throw', () => {
  assertThrows(
    () => parseClickLogRequest({ branch_link_id: 'x', guest_token: VALID_UUID }),
    Error,
    'group_id',
  );
});

Deno.test('parseClickLogRequest: guest_token 누락 throw', () => {
  assertThrows(
    () => parseClickLogRequest({ branch_link_id: 'x', group_id: VALID_UUID }),
    Error,
    'guest_token',
  );
});

Deno.test('parseClickLogRequest: branch_link_id 너무 김 throw', () => {
  assertThrows(
    () =>
      parseClickLogRequest({
        branch_link_id: 'a'.repeat(65),
        group_id: VALID_UUID,
        guest_token: VALID_UUID,
      }),
    Error,
    '너무 깁니다',
  );
});

// --- parseResolveRequest --------------------------------------------------

Deno.test('parseResolveRequest: fingerprint 모드', () => {
  const out = parseResolveRequest({ mode: 'fingerprint' });
  assertEquals(out.mode, 'fingerprint');
});

Deno.test('parseResolveRequest: invite_code 모드 (정상)', () => {
  const out = parseResolveRequest({ mode: 'invite_code', code: '0042' });
  assertEquals(out, { mode: 'invite_code', code: '0042' });
});

Deno.test('parseResolveRequest: invite_code 형식 오류 throw', () => {
  assertThrows(
    () => parseResolveRequest({ mode: 'invite_code', code: 'abc' }),
    Error,
    '4자리 숫자',
  );
  assertThrows(
    () => parseResolveRequest({ mode: 'invite_code', code: '12345' }),
    Error,
    '4자리 숫자',
  );
});

Deno.test('parseResolveRequest: 알 수 없는 mode throw', () => {
  assertThrows(
    () => parseResolveRequest({ mode: 'magic' }),
    Error,
    'fingerprint 또는 invite_code',
  );
});

Deno.test('parseResolveRequest: mode 누락 throw', () => {
  assertThrows(
    () => parseResolveRequest({}),
    Error,
    'fingerprint 또는 invite_code',
  );
});

// --- fingerprintMatchSince ------------------------------------------------

Deno.test('fingerprintMatchSince: window 24h 전 UTC ISO', () => {
  const now = new Date('2026-05-27T12:00:00.000Z');
  const since = fingerprintMatchSince(now, 24);
  assertEquals(since, '2026-05-26T12:00:00.000Z');
});

Deno.test('fingerprintMatchSince: window 1h 전', () => {
  const now = new Date('2026-05-27T12:00:00.000Z');
  const since = fingerprintMatchSince(now, 1);
  assertEquals(since, '2026-05-27T11:00:00.000Z');
});

Deno.test('fingerprintMatchSince: KST timezone 무관 — UTC ISO 일관', () => {
  const now = new Date('2026-05-27T23:30:00.000Z');
  const since = fingerprintMatchSince(now, 24);
  assertMatch(since, /^2026-05-26T23:30:00/);
});

// --- buildMatchFilters ----------------------------------------------------

Deno.test('buildMatchFilters: window 24h 적용', () => {
  const filters = buildMatchFilters('iphash', 'uahash');
  assertEquals(filters.ipHash, 'iphash');
  assertEquals(filters.uaHash, 'uahash');
  assertEquals(filters.windowHours, FINGERPRINT_MATCH_WINDOW_HOURS);
  assertEquals(filters.windowHours, 24);
});
