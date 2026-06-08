// kakao_local_search/_test.ts — S16 Phase b Edge Function handler 순수 함수 단위 테스트.
// 실행: deno test supabase/functions/kakao_local_search/_test.ts
//
// 전체 handler(auth getUser + env secret + fetch)는 KAKAO_REST_API_KEY 등록 후 통합 검증 (운영 prereq).
// 여기서는 입력 파싱 + 에러→HTTP 매핑 순수 함수만 (naver_local_search/_test.ts 패턴 mirror).

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { KakaoLocalError } from '../_lib/kakao_local.ts';
import { kakaoErrorToHttp, parseSearchRequest } from './index.ts';

// --- parseSearchRequest ----------------------------------------------------

Deno.test('parseSearchRequest: query + display 정상', () => {
  assertEquals(parseSearchRequest({ query: '강남 카페', display: 10 }), {
    query: '강남 카페',
    display: 10,
  });
});

Deno.test('parseSearchRequest: display 생략 → 기본 15 (카카오 max)', () => {
  assertEquals(parseSearchRequest({ query: '홍대' }), { query: '홍대', display: 15 });
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

// --- kakaoErrorToHttp ------------------------------------------------------

Deno.test('kakaoErrorToHttp: rate_limit → 429', () => {
  const r = kakaoErrorToHttp(new KakaoLocalError('rate_limit', 'limit'));
  assertEquals(r.status, 429);
  assertEquals(typeof r.message, 'string');
});

Deno.test('kakaoErrorToHttp: unauthorized → 502 (서버 설정 문제, 노출 안 함)', () => {
  const r = kakaoErrorToHttp(new KakaoLocalError('unauthorized', 'bad key'));
  assertEquals(r.status, 502);
});

Deno.test('kakaoErrorToHttp: network → 502', () => {
  assertEquals(kakaoErrorToHttp(new KakaoLocalError('network', 'boom')).status, 502);
});

Deno.test('kakaoErrorToHttp: bad_response → 502', () => {
  assertEquals(kakaoErrorToHttp(new KakaoLocalError('bad_response', 'x')).status, 502);
});

Deno.test('kakaoErrorToHttp: 일반 Error → 500', () => {
  assertEquals(kakaoErrorToHttp(new Error('unknown')).status, 500);
});
