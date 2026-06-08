// kakao_local_test.ts — S16 Phase b KakaoLocalProvider (Q-A2 허용 답변 수신 → D37)
// 카카오 Local 키워드검색 API 응답 파싱 + 좌표 정규화 + PlaceSearchResult 변환 단위 테스트.
// 실행: deno test supabase/functions/_lib/kakao_local_test.ts
//
// 좌표 가정: 카카오 Local API는 x=경도, y=위도 (WGS84 decimal degree 문자열, 스케일링 없음).
// Naver(mapx/mapy ×10^7)와 달리 그대로 Number() 파싱. isPlausibleKoreaWgs84가 format mismatch 안전망.

import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildPlaceSearchResults,
  fetchKakaoLocal,
  isPlausibleKoreaWgs84,
  kakaoCategoryLeaf,
  KakaoLocalError,
  normalizeKakaoCoord,
  parseKakaoLocalResponse,
} from './kakao_local.ts';

// --- normalizeKakaoCoord ---------------------------------------------------

Deno.test('normalizeKakaoCoord: WGS84 decimal 문자열 → 도(degree)', () => {
  const { lat, lng } = normalizeKakaoCoord('127.0276662', '37.500435');
  assertAlmostEquals(lng, 127.0276662, 1e-9);
  assertAlmostEquals(lat, 37.500435, 1e-9);
});

Deno.test('normalizeKakaoCoord: 숫자 아님/빈 문자열 → throw', () => {
  assertThrows(() => normalizeKakaoCoord('abc', '37.5'), Error);
  assertThrows(() => normalizeKakaoCoord('127.0', ''), Error);
});

// --- isPlausibleKoreaWgs84 -------------------------------------------------

Deno.test('isPlausibleKoreaWgs84: 서울 시청 → true', () => {
  assert(isPlausibleKoreaWgs84(37.5663, 126.9779));
});

Deno.test('isPlausibleKoreaWgs84: 제주 → true', () => {
  assert(isPlausibleKoreaWgs84(33.4, 126.5));
});

Deno.test('isPlausibleKoreaWgs84: 해외(뉴욕) → false', () => {
  assertEquals(isPlausibleKoreaWgs84(40.7128, -74.006), false);
});

// --- kakaoCategoryLeaf -----------------------------------------------------

Deno.test('kakaoCategoryLeaf: " > " 구분 → 마지막 leaf (공백 trim)', () => {
  assertEquals(kakaoCategoryLeaf('음식점 > 카페 > 커피전문점'), '커피전문점');
});

Deno.test('kakaoCategoryLeaf: 단일 카테고리 그대로', () => {
  assertEquals(kakaoCategoryLeaf('카페'), '카페');
});

Deno.test('kakaoCategoryLeaf: 빈 문자열 → null', () => {
  assertEquals(kakaoCategoryLeaf(''), null);
});

// --- parseKakaoLocalResponse -----------------------------------------------

Deno.test('parseKakaoLocalResponse: 정상 documents 배열', () => {
  const raw = {
    meta: { total_count: 1, pageable_count: 1, is_end: true },
    documents: [
      {
        id: '26338954',
        place_name: '스타벅스 강남점',
        category_name: '음식점 > 카페 > 커피전문점 > 스타벅스',
        category_group_name: '카페',
        address_name: '서울 강남구 역삼동 825',
        road_address_name: '서울 강남구 강남대로 390',
        x: '127.0276662',
        y: '37.500435',
        phone: '02-1234-5678',
        place_url: 'http://place.map.kakao.com/26338954',
      },
    ],
  };
  const docs = parseKakaoLocalResponse(raw);
  assertEquals(docs.length, 1);
  assertEquals(docs[0]?.id, '26338954');
});

Deno.test('parseKakaoLocalResponse: documents 없음 → 빈 배열', () => {
  assertEquals(parseKakaoLocalResponse({}), []);
  assertEquals(parseKakaoLocalResponse({ documents: [] }), []);
});

Deno.test('parseKakaoLocalResponse: 객체 아님 → throw', () => {
  assertThrows(() => parseKakaoLocalResponse(null), Error);
  assertThrows(() => parseKakaoLocalResponse('x'), Error);
});

Deno.test('parseKakaoLocalResponse: 필수 필드(id/place_name/x/y) 누락 item 제외', () => {
  const raw = {
    documents: [
      { id: '1', place_name: 'A', x: '127.0', y: '37.5' },
      { place_name: 'B (id 없음)', x: '127.0', y: '37.5' },
      { id: '2', x: '127.0', y: '37.5' }, // place_name 없음
      { id: '3', place_name: 'D', y: '37.5' }, // x 없음
    ],
  };
  const docs = parseKakaoLocalResponse(raw);
  assertEquals(docs.length, 1);
  assertEquals(docs[0]?.place_name, 'A');
});

// --- buildPlaceSearchResults -----------------------------------------------

Deno.test('buildPlaceSearchResults: 필드 매핑 + category_group_name 우선 + road_address 우선 + stable id', () => {
  const docs = [
    {
      id: '26338954',
      place_name: '스타벅스 강남점',
      category_name: '음식점 > 카페 > 커피전문점 > 스타벅스',
      category_group_name: '카페',
      address_name: '서울 강남구 역삼동 825',
      road_address_name: '서울 강남구 강남대로 390',
      x: '127.0276662',
      y: '37.500435',
      phone: '02-1234-5678',
    },
  ];
  const results = buildPlaceSearchResults(docs);
  assertEquals(results.length, 1);
  const r = results[0]!;
  assertEquals(r.name, '스타벅스 강남점');
  assertEquals(r.category, '카페'); // category_group_name 우선
  assertEquals(r.address, '서울 강남구 강남대로 390'); // road_address 우선
  assertEquals(r.phone, '02-1234-5678');
  assertEquals(r.source, 'kakao');
  assertEquals(r.providerPlaceId, 'kakao:26338954'); // stable id (Naver와 달리 합성 불필요)
  assertAlmostEquals(r.lng, 127.0276662, 1e-9);
  assertAlmostEquals(r.lat, 37.500435, 1e-9);
});

Deno.test('buildPlaceSearchResults: category_group_name 없으면 category_name leaf', () => {
  const results = buildPlaceSearchResults([
    {
      id: '1',
      place_name: 'A',
      category_name: '음식점 > 한식 > 육류,고기',
      category_group_name: '',
      address_name: '서울 강남구 역삼동 825',
      road_address_name: '',
      x: '127.0276662',
      y: '37.500435',
      phone: '',
    },
  ]);
  assertEquals(results[0]?.category, '육류,고기');
  assertEquals(results[0]?.address, '서울 강남구 역삼동 825'); // road 없으면 지번
  assertEquals(results[0]?.phone, null);
});

Deno.test('buildPlaceSearchResults: 카테고리/주소 전부 없음 → null', () => {
  const results = buildPlaceSearchResults([
    {
      id: '1',
      place_name: 'A',
      category_name: '',
      category_group_name: '',
      address_name: '',
      road_address_name: '',
      x: '127.0276662',
      y: '37.500435',
      phone: '',
    },
  ]);
  assertEquals(results[0]?.category, null);
  assertEquals(results[0]?.address, null);
});

Deno.test('buildPlaceSearchResults: 한국 bbox 밖 좌표 item 제외 (format mismatch 안전망)', () => {
  const results = buildPlaceSearchResults([
    {
      id: '1',
      place_name: '정상',
      category_name: '',
      category_group_name: '',
      address_name: '',
      road_address_name: '',
      x: '127.0276662',
      y: '37.500435',
      phone: '',
    },
    {
      id: '2',
      place_name: '이상(뉴욕)',
      category_name: '',
      category_group_name: '',
      address_name: '',
      road_address_name: '',
      x: '-74.006',
      y: '40.7128',
      phone: '',
    },
  ]);
  assertEquals(results.length, 1);
  assertEquals(results[0]?.name, '정상');
});

// --- fetchKakaoLocal -------------------------------------------------------

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.test('fetchKakaoLocal: 정상 응답 → documents + 올바른 URL/Authorization 헤더', async () => {
  let calledUrl = '';
  let calledHeaders: Record<string, string> = {};
  const fakeFetch: typeof globalThis.fetch = (input, init) => {
    calledUrl = typeof input === 'string' ? input : input.toString();
    const initHeaders = (init as { headers?: Record<string, string> } | undefined)?.headers;
    calledHeaders = initHeaders ?? {};
    return Promise.resolve(
      okResponse({
        documents: [
          { id: '1', place_name: 'A', category_name: '', category_group_name: '', address_name: '', road_address_name: '', x: '127.0276662', y: '37.500435', phone: '' },
        ],
      }),
    );
  };
  const docs = await fetchKakaoLocal({
    query: '강남 카페',
    display: 15,
    restApiKey: 'RKEY',
    fetch: fakeFetch,
  });
  assertEquals(docs.length, 1);
  assert(calledUrl.includes('dapi.kakao.com/v2/local/search/keyword'));
  const parsedUrl = new URL(calledUrl);
  assertEquals(parsedUrl.searchParams.get('query'), '강남 카페');
  assertEquals(parsedUrl.searchParams.get('size'), '15');
  assertEquals(calledHeaders['Authorization'], 'KakaoAK RKEY');
});

Deno.test('fetchKakaoLocal: 429 → rate_limit 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () =>
    Promise.resolve(new Response('{}', { status: 429 }));
  const err = await fetchKakaoLocal({ query: 'x', display: 15, restApiKey: 'k', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof KakaoLocalError);
  assertEquals((err as KakaoLocalError).kind, 'rate_limit');
});

Deno.test('fetchKakaoLocal: 401 → unauthorized 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () =>
    Promise.resolve(new Response('{}', { status: 401 }));
  const err = await fetchKakaoLocal({ query: 'x', display: 15, restApiKey: 'k', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof KakaoLocalError);
  assertEquals((err as KakaoLocalError).kind, 'unauthorized');
});

Deno.test('fetchKakaoLocal: 403 → unauthorized 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () =>
    Promise.resolve(new Response('{}', { status: 403 }));
  const err = await fetchKakaoLocal({ query: 'x', display: 15, restApiKey: 'k', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof KakaoLocalError);
  assertEquals((err as KakaoLocalError).kind, 'unauthorized');
});

Deno.test('fetchKakaoLocal: fetch throw → network 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () => Promise.reject(new Error('boom'));
  const err = await fetchKakaoLocal({ query: 'x', display: 15, restApiKey: 'k', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof KakaoLocalError);
  assertEquals((err as KakaoLocalError).kind, 'network');
});

Deno.test('fetchKakaoLocal: 5xx → bad_response 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () =>
    Promise.resolve(new Response('{}', { status: 500 }));
  const err = await fetchKakaoLocal({ query: 'x', display: 15, restApiKey: 'k', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof KakaoLocalError);
  assertEquals((err as KakaoLocalError).kind, 'bad_response');
});

Deno.test('fetchKakaoLocal: size 범위 clamp (1~15)', async () => {
  let calledUrl = '';
  const fakeFetch: typeof globalThis.fetch = (input) => {
    calledUrl = typeof input === 'string' ? input : input.toString();
    return Promise.resolve(okResponse({ documents: [] }));
  };
  await fetchKakaoLocal({ query: 'x', display: 99, restApiKey: 'k', fetch: fakeFetch });
  assert(calledUrl.includes('size=15'));
});
