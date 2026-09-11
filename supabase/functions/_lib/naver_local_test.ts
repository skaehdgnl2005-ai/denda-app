// naver_local_test.ts — S16 NaverSearchProvider fallback (D1 no-answer 활성)
// 네이버 지역검색 Open API 응답 파싱 + 좌표 정규화 + PlaceSearchResult 변환 단위 테스트.
// 실행: deno test supabase/functions/_lib/naver_local_test.ts
//
// 좌표 가정: 네이버 지역검색 API는 mapx=경도×10^7, mapy=위도×10^7 (정수 문자열, WGS84).
// 이 가정이 틀리면(구형 TM128/KATECH 반환) isPlausibleKoreaWgs84 range 체크가 잡아냄
// → live API 등록 후 검증 (운영 prereq).

import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildPlaceSearchResults,
  fetchNaverLocal,
  isPlausibleKoreaWgs84,
  naverCategoryLeaf,
  NaverLocalError,
  normalizeNaverCoord,
  parseNaverLocalResponse,
  stripHtmlTags,
} from './naver_local.ts';

// --- stripHtmlTags ---------------------------------------------------------

Deno.test('stripHtmlTags: <b> 태그 제거', () => {
  assertEquals(stripHtmlTags('<b>강남</b>역'), '강남역');
});

Deno.test('stripHtmlTags: 다중 태그 제거', () => {
  assertEquals(stripHtmlTags('<b>스타</b><b>벅스</b> 강남점'), '스타벅스 강남점');
});

Deno.test('stripHtmlTags: HTML 엔티티 디코드', () => {
  assertEquals(stripHtmlTags('B&amp;B 카페 &lt;신관&gt; &quot;A&quot; &#39;B&#39;'), 'B&B 카페 <신관> "A" \'B\'');
});

Deno.test('stripHtmlTags: 태그 없는 문자열 그대로', () => {
  assertEquals(stripHtmlTags('홍대입구역'), '홍대입구역');
});

Deno.test('stripHtmlTags: 빈 문자열', () => {
  assertEquals(stripHtmlTags(''), '');
});

// --- normalizeNaverCoord ---------------------------------------------------

Deno.test('normalizeNaverCoord: WGS84×10^7 정수 문자열 → 도(degree)', () => {
  const { lat, lng } = normalizeNaverCoord('1269779692', '375665350');
  assertAlmostEquals(lng, 126.9779692, 1e-6);
  assertAlmostEquals(lat, 37.566535, 1e-6);
});

Deno.test('normalizeNaverCoord: 숫자 아님 → throw', () => {
  assertThrows(() => normalizeNaverCoord('abc', '375665350'), Error);
  assertThrows(() => normalizeNaverCoord('1269779692', ''), Error);
});

// --- isPlausibleKoreaWgs84 -------------------------------------------------

Deno.test('isPlausibleKoreaWgs84: 서울 시청 → true', () => {
  assert(isPlausibleKoreaWgs84(37.5663, 126.9779));
});

Deno.test('isPlausibleKoreaWgs84: 제주 → true', () => {
  assert(isPlausibleKoreaWgs84(33.4, 126.5));
});

Deno.test('isPlausibleKoreaWgs84: TM128 오파싱 결과(0.x) → false (format mismatch 감지)', () => {
  // mapx="310824" 를 ÷10^7 하면 0.0310824 → 한국 bbox 밖
  assertEquals(isPlausibleKoreaWgs84(0.0552477, 0.0310824), false);
});

Deno.test('isPlausibleKoreaWgs84: 해외(뉴욕) → false', () => {
  assertEquals(isPlausibleKoreaWgs84(40.7128, -74.006), false);
});

// --- naverCategoryLeaf -----------------------------------------------------

Deno.test('naverCategoryLeaf: > 구분 카테고리 → 마지막 leaf', () => {
  assertEquals(naverCategoryLeaf('음식점>한식>육류,고기'), '육류,고기');
});

Deno.test('naverCategoryLeaf: 단일 카테고리 그대로', () => {
  assertEquals(naverCategoryLeaf('카페,디저트'), '카페,디저트');
});

Deno.test('naverCategoryLeaf: 빈 문자열 → null', () => {
  assertEquals(naverCategoryLeaf(''), null);
});

// --- parseNaverLocalResponse -----------------------------------------------

Deno.test('parseNaverLocalResponse: 정상 items 배열', () => {
  const raw = {
    items: [
      {
        title: '<b>스타벅스</b> 강남점',
        category: '음식점>카페,디저트',
        address: '서울특별시 강남구 역삼동 825',
        roadAddress: '서울특별시 강남구 강남대로 390',
        mapx: '1270276662',
        mapy: '375004350',
        telephone: '02-1234-5678',
        link: 'https://example.com',
      },
    ],
  };
  const items = parseNaverLocalResponse(raw);
  assertEquals(items.length, 1);
  assertEquals(items[0]?.mapx, '1270276662');
});

Deno.test('parseNaverLocalResponse: items 없음 → 빈 배열', () => {
  assertEquals(parseNaverLocalResponse({}), []);
  assertEquals(parseNaverLocalResponse({ items: [] }), []);
});

Deno.test('parseNaverLocalResponse: 객체 아님 → throw', () => {
  assertThrows(() => parseNaverLocalResponse(null), Error);
  assertThrows(() => parseNaverLocalResponse('x'), Error);
});

Deno.test('parseNaverLocalResponse: 필수 필드 누락 item 제외', () => {
  const raw = {
    items: [
      { title: 'A', mapx: '1270276662', mapy: '375004350' },
      { title: 'B (mapx 없음)', mapy: '375004350' },
      { mapx: '1270276662', mapy: '375004350' }, // title 없음
    ],
  };
  const items = parseNaverLocalResponse(raw);
  assertEquals(items.length, 1);
  assertEquals(items[0]?.title, 'A');
});

// --- buildPlaceSearchResults -----------------------------------------------

Deno.test('buildPlaceSearchResults: 필드 매핑 + HTML strip + roadAddress 우선', () => {
  const items = [
    {
      title: '<b>스타벅스</b> 강남점',
      category: '음식점>카페,디저트',
      address: '서울특별시 강남구 역삼동 825',
      roadAddress: '서울특별시 강남구 강남대로 390',
      mapx: '1270276662',
      mapy: '375004350',
      telephone: '02-1234-5678',
      link: 'https://example.com',
    },
  ];
  const results = buildPlaceSearchResults(items);
  assertEquals(results.length, 1);
  const r = results[0]!;
  assertEquals(r.name, '스타벅스 강남점');
  assertEquals(r.category, '카페,디저트');
  assertEquals(r.address, '서울특별시 강남구 강남대로 390');
  assertEquals(r.phone, '02-1234-5678');
  assertEquals(r.source, 'naver');
  assertAlmostEquals(r.lng, 127.0276662, 1e-6);
  assertAlmostEquals(r.lat, 37.500435, 1e-6);
  assert(r.providerPlaceId.length > 0);
});

Deno.test('buildPlaceSearchResults: roadAddress 없으면 address 사용', () => {
  const results = buildPlaceSearchResults([
    {
      title: 'A',
      category: '',
      address: '지번 주소',
      roadAddress: '',
      mapx: '1270276662',
      mapy: '375004350',
      telephone: '',
    },
  ]);
  assertEquals(results[0]?.address, '지번 주소');
  assertEquals(results[0]?.category, null);
  assertEquals(results[0]?.phone, null);
});

Deno.test('buildPlaceSearchResults: 한국 bbox 밖 좌표 item 제외 (format mismatch 안전망)', () => {
  const results = buildPlaceSearchResults([
    { title: '정상', category: '', address: 'a', roadAddress: '', mapx: '1270276662', mapy: '375004350', telephone: '' },
    { title: '이상', category: '', address: 'b', roadAddress: '', mapx: '310824', mapy: '552477', telephone: '' },
  ]);
  assertEquals(results.length, 1);
  assertEquals(results[0]?.name, '정상');
});

Deno.test('buildPlaceSearchResults: 같은 입력 → 같은 providerPlaceId (deterministic)', () => {
  const item = { title: '카페', category: '', address: 'a', roadAddress: '', mapx: '1270276662', mapy: '375004350', telephone: '' };
  const a = buildPlaceSearchResults([item]);
  const b = buildPlaceSearchResults([item]);
  assertEquals(a[0]?.providerPlaceId, b[0]?.providerPlaceId);
});

// --- fetchNaverLocal -------------------------------------------------------

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.test('fetchNaverLocal: 정상 응답 → items + 올바른 URL/헤더', async () => {
  let calledUrl = '';
  let calledHeaders: Record<string, string> = {};
  const fakeFetch: typeof globalThis.fetch = (input, init) => {
    calledUrl = typeof input === 'string' ? input : input.toString();
    const initHeaders = (init as { headers?: Record<string, string> } | undefined)?.headers;
    calledHeaders = initHeaders ?? {};
    return Promise.resolve(
      okResponse({ items: [{ title: 'A', category: '', address: 'a', roadAddress: '', mapx: '1270276662', mapy: '375004350', telephone: '' }] }),
    );
  };
  const items = await fetchNaverLocal({
    query: '강남 카페',
    display: 5,
    clientId: 'CID',
    clientSecret: 'CSECRET',
    fetch: fakeFetch,
  });
  assertEquals(items.length, 1);
  assert(calledUrl.includes('openapi.naver.com/v1/search/local'));
  const parsedUrl = new URL(calledUrl);
  assertEquals(parsedUrl.searchParams.get('query'), '강남 카페');
  assertEquals(parsedUrl.searchParams.get('display'), '5');
  assertEquals(calledHeaders['X-Naver-Client-Id'], 'CID');
  assertEquals(calledHeaders['X-Naver-Client-Secret'], 'CSECRET');
});

Deno.test('fetchNaverLocal: 429 → rate_limit 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () =>
    Promise.resolve(new Response('{}', { status: 429 }));
  const err = await fetchNaverLocal({ query: 'x', display: 5, clientId: 'c', clientSecret: 's', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof NaverLocalError);
  assertEquals((err as NaverLocalError).kind, 'rate_limit');
});

Deno.test('fetchNaverLocal: 401 → unauthorized 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () =>
    Promise.resolve(new Response('{}', { status: 401 }));
  const err = await fetchNaverLocal({ query: 'x', display: 5, clientId: 'c', clientSecret: 's', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof NaverLocalError);
  assertEquals((err as NaverLocalError).kind, 'unauthorized');
});

Deno.test('fetchNaverLocal: fetch throw → network 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () => Promise.reject(new Error('boom'));
  const err = await fetchNaverLocal({ query: 'x', display: 5, clientId: 'c', clientSecret: 's', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof NaverLocalError);
  assertEquals((err as NaverLocalError).kind, 'network');
});

Deno.test('fetchNaverLocal: 5xx → bad_response 에러', async () => {
  const fakeFetch: typeof globalThis.fetch = () =>
    Promise.resolve(new Response('{}', { status: 500 }));
  const err = await fetchNaverLocal({ query: 'x', display: 5, clientId: 'c', clientSecret: 's', fetch: fakeFetch })
    .then(() => null)
    .catch((e: unknown) => e);
  assert(err instanceof NaverLocalError);
  assertEquals((err as NaverLocalError).kind, 'bad_response');
});

Deno.test('fetchNaverLocal: display 범위 clamp (1~5)', async () => {
  let calledUrl = '';
  const fakeFetch: typeof globalThis.fetch = (input) => {
    calledUrl = typeof input === 'string' ? input : input.toString();
    return Promise.resolve(okResponse({ items: [] }));
  };
  await fetchNaverLocal({ query: 'x', display: 99, clientId: 'c', clientSecret: 's', fetch: fakeFetch });
  assert(calledUrl.includes('display=5'));
});
