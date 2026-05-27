// fingerprint_test.ts — D28 자체 deferred deep link fingerprint helper 단위 테스트
// 실행: deno test --allow-env supabase/functions/_lib/fingerprint_test.ts

import {
  assertEquals,
  assertNotEquals,
  assertMatch,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  computeFingerprintHashes,
  extractClientIp,
  extractUserAgent,
} from './fingerprint.ts';

const SALT = 'test_salt_DO_NOT_USE_IN_PROD';

// --- extractClientIp -------------------------------------------------------

Deno.test('extractClientIp: X-Forwarded-For 단일 IP', () => {
  const req = new Request('http://x/', { headers: { 'X-Forwarded-For': '1.2.3.4' } });
  assertEquals(extractClientIp(req), '1.2.3.4');
});

Deno.test('extractClientIp: X-Forwarded-For 다중 IP → 가장 왼쪽(원본 client)', () => {
  const req = new Request('http://x/', {
    headers: { 'X-Forwarded-For': '203.0.113.5, 70.41.3.18, 150.172.238.178' },
  });
  assertEquals(extractClientIp(req), '203.0.113.5');
});

Deno.test('extractClientIp: 공백/탭 trim', () => {
  const req = new Request('http://x/', {
    headers: { 'X-Forwarded-For': '   1.2.3.4   , 5.6.7.8' },
  });
  assertEquals(extractClientIp(req), '1.2.3.4');
});

Deno.test('extractClientIp: X-Real-IP fallback', () => {
  const req = new Request('http://x/', { headers: { 'X-Real-IP': '9.9.9.9' } });
  assertEquals(extractClientIp(req), '9.9.9.9');
});

Deno.test('extractClientIp: X-Forwarded-For 우선 (X-Real-IP 무시)', () => {
  const req = new Request('http://x/', {
    headers: { 'X-Forwarded-For': '1.1.1.1', 'X-Real-IP': '9.9.9.9' },
  });
  assertEquals(extractClientIp(req), '1.1.1.1');
});

Deno.test('extractClientIp: 두 header 모두 없음 → 빈 문자열', () => {
  const req = new Request('http://x/');
  assertEquals(extractClientIp(req), '');
});

Deno.test('extractClientIp: IPv6 형식 그대로', () => {
  const req = new Request('http://x/', {
    headers: { 'X-Forwarded-For': '2a01:db8::1' },
  });
  assertEquals(extractClientIp(req), '2a01:db8::1');
});

// --- extractUserAgent ------------------------------------------------------

Deno.test('extractUserAgent: User-Agent header 그대로', () => {
  const req = new Request('http://x/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone) Safari/605.1' },
  });
  assertEquals(extractUserAgent(req), 'Mozilla/5.0 (iPhone) Safari/605.1');
});

Deno.test('extractUserAgent: 없으면 빈 문자열', () => {
  const req = new Request('http://x/');
  assertEquals(extractUserAgent(req), '');
});

// --- computeFingerprintHashes ----------------------------------------------

Deno.test('computeFingerprintHashes: 같은 input → 같은 output (deterministic)', async () => {
  const h1 = await computeFingerprintHashes({ ip: '1.2.3.4', ua: 'Safari', salt: SALT });
  const h2 = await computeFingerprintHashes({ ip: '1.2.3.4', ua: 'Safari', salt: SALT });
  assertEquals(h1.ipHash, h2.ipHash);
  assertEquals(h1.uaHash, h2.uaHash);
});

Deno.test('computeFingerprintHashes: 다른 salt → 다른 hash', async () => {
  const h1 = await computeFingerprintHashes({ ip: '1.2.3.4', ua: 'Safari', salt: 'salt1' });
  const h2 = await computeFingerprintHashes({ ip: '1.2.3.4', ua: 'Safari', salt: 'salt2' });
  assertNotEquals(h1.ipHash, h2.ipHash);
  assertNotEquals(h1.uaHash, h2.uaHash);
});

Deno.test('computeFingerprintHashes: 다른 ip → 다른 ipHash, 같은 uaHash', async () => {
  const h1 = await computeFingerprintHashes({ ip: '1.2.3.4', ua: 'Safari', salt: SALT });
  const h2 = await computeFingerprintHashes({ ip: '9.9.9.9', ua: 'Safari', salt: SALT });
  assertNotEquals(h1.ipHash, h2.ipHash);
  assertEquals(h1.uaHash, h2.uaHash);
});

Deno.test('computeFingerprintHashes: 다른 ua → 다른 uaHash, 같은 ipHash', async () => {
  const h1 = await computeFingerprintHashes({ ip: '1.2.3.4', ua: 'Safari', salt: SALT });
  const h2 = await computeFingerprintHashes({ ip: '1.2.3.4', ua: 'Chrome', salt: SALT });
  assertEquals(h1.ipHash, h2.ipHash);
  assertNotEquals(h1.uaHash, h2.uaHash);
});

Deno.test('computeFingerprintHashes: hex 64자리 (SHA-256)', async () => {
  const h = await computeFingerprintHashes({ ip: '1.2.3.4', ua: 'Safari', salt: SALT });
  assertMatch(h.ipHash, /^[0-9a-f]{64}$/);
  assertMatch(h.uaHash, /^[0-9a-f]{64}$/);
});

Deno.test('computeFingerprintHashes: 빈 ip/ua도 해시 (정상 처리)', async () => {
  const h = await computeFingerprintHashes({ ip: '', ua: '', salt: SALT });
  assertMatch(h.ipHash, /^[0-9a-f]{64}$/);
  assertMatch(h.uaHash, /^[0-9a-f]{64}$/);
});
