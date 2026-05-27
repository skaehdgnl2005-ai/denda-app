// naver_local_search/_test.ts — S16 Edge Function handler 순수 함수 단위 테스트.
// 실행: deno test supabase/functions/naver_local_search/_test.ts
//
// 전체 handler(auth getUser + env secret + fetch)는 live API 등록 후 통합 검증 (운영 prereq).
// 여기서는 입력 파싱 + 에러→HTTP 매핑 순수 함수만 (click_log/_test.ts 패턴 mirror).

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { NaverLocalError } from '../_lib/naver_local.ts';
import { naverErrorToHttp, parseSearchRequest } from './index.ts';

// --- parseSearchRequest ----------------------------------------------------

Deno.test('parseSearchRequest: query + display 정상', () => {
  assertEquals(parseSearchRequest({ query: '강남 카페', display: 3 }), {
    query: '강남 카페',
    display: 3,
  });
});

Deno.test('parseSearchRequest: display 생략 → 기본 5', () => {
  assertEquals(parseSearchRequest({ query: '홍대' }), { query: '홍대', display: 5 });
});

Deno.test('parseSearchRequest: query 앞뒤 공백 trim', () => {
  assertEquals(parseSearchRequest({ query: '  강남  ' }).query, '강남');
});

Deno.test('parseSearchRequest: query 누락 → throw', () => {
  assertThrows(() => parseSearchRequest({}), Error);
});

Deno.test('parseSearchRequest: query 빈 문자열/공백 → throw', () => {
  assertThrows(() => parseSearchRequest({ query: '' }), Error);
  assertThrows(() => parseSearchRequest({ query: '   ' }), Error);
});

Deno.test('parseSearchRequest: query 문자열 아님 → throw', () => {
  assertThrows(() => parseSearchRequest({ query: 123 }), Error);
});

Deno.test('parseSearchRequest: display 숫자 아님 → throw', () => {
  assertThrows(() => parseSearchRequest({ query: '강남', display: 'x' }), Error);
});

Deno.test('parseSearchRequest: body 객체 아님 → throw', () => {
  assertThrows(() => parseSearchRequest(null), Error);
  assertThrows(() => parseSearchRequest('x'), Error);
});

// --- naverErrorToHttp ------------------------------------------------------

Deno.test('naverErrorToHttp: rate_limit → 429', () => {
  const r = naverErrorToHttp(new NaverLocalError('rate_limit', 'limit'));
  assertEquals(r.status, 429);
  assertEquals(typeof r.message, 'string');
});

Deno.test('naverErrorToHttp: unauthorized → 502 (서버 설정 문제, 노출 안 함)', () => {
  const r = naverErrorToHttp(new NaverLocalError('unauthorized', 'bad key'));
  assertEquals(r.status, 502);
});

Deno.test('naverErrorToHttp: network → 502', () => {
  assertEquals(naverErrorToHttp(new NaverLocalError('network', 'boom')).status, 502);
});

Deno.test('naverErrorToHttp: bad_response → 502', () => {
  assertEquals(naverErrorToHttp(new NaverLocalError('bad_response', 'x')).status, 502);
});

Deno.test('naverErrorToHttp: 일반 Error → 500', () => {
  assertEquals(naverErrorToHttp(new Error('unknown')).status, 500);
});
