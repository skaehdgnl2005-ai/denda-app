// naver_local.ts — S16 NaverSearchProvider fallback 서버 측 helper (Deno).
//
// D1 no-answer 활성: Q-A2(카카오 Local API on Naver Maps 약관) 답변 미수신 →
// 네이버 지역검색 Open API를 장소 검색 데이터 소스로 사용 (PlaceSearchProvider 추상화).
//
// 책임:
//   1. stripHtmlTags — 네이버 title의 <b> 강조 태그 + HTML 엔티티 제거
//   2. normalizeNaverCoord — mapx/mapy → WGS84 (D18 좌표 정규화 단일 진입점, 서버 측)
//   3. isPlausibleKoreaWgs84 — 한국 bbox range 체크 (좌표 format mismatch 안전망)
//   4. parseNaverLocalResponse / buildPlaceSearchResults — 응답 → PlaceSearchResult[]
//   5. fetchNaverLocal — openapi.naver.com 호출 (fetch DI, secret은 Edge env)
//
// 보안: NAVER_CLIENT_SECRET은 Edge env only (CLAUDE.md rule 7). 클라이언트는 Edge invoke만.
//
// 좌표 가정: 네이버 지역검색 API는 mapx=경도×10^7, mapy=위도×10^7 (정수 문자열, WGS84).
// 구형 TM128/KATECH 반환 시 isPlausibleKoreaWgs84가 잡아냄 → live API 등록 후 검증 (운영 prereq).

const NAVER_LOCAL_URL = 'https://openapi.naver.com/v1/search/local.json';
const COORD_SCALE = 1e7;
const MAX_DISPLAY = 5; // 네이버 지역검색 display 최대 5 (API 한계)

// 한국 영토 bounding box (제주·울릉/독도 포함 + 여유 마진).
const KOREA_LAT_MIN = 32.5;
const KOREA_LAT_MAX = 39.0;
const KOREA_LNG_MIN = 124.0;
const KOREA_LNG_MAX = 132.5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 네이버 지역검색 API item (필수 필드만). */
export interface NaverLocalItem {
  title: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  mapx: string;
  mapy: string;
  telephone?: string;
  link?: string;
}

/**
 * 정규화된 장소 검색 결과. provider 무관 공통 shape.
 * 클라이언트 `src/lib/places/PlaceSearchProvider.ts`의 PlaceSearchResult와 shape mirror —
 * 변경 시 양쪽 동기화 (Deno ↔ RN 런타임 분리로 파일 공유 불가).
 */
export interface PlaceSearchResult {
  /** provider 고유 ID. 네이버 지역검색은 안정 ID 미제공 → name+좌표 deterministic 합성 (마커 key·dedup용). */
  providerPlaceId: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number; // WGS84
  lng: number; // WGS84
  phone: string | null;
  source: 'naver' | 'kakao';
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export type NaverLocalErrorKind =
  | 'rate_limit' // 429 — quota 초과 ("잠시 후 다시" fallback)
  | 'unauthorized' // 401/403 — client id/secret 오류
  | 'network' // fetch throw
  | 'bad_response'; // 5xx + 기타 비정상

export class NaverLocalError extends Error {
  override readonly name = 'NaverLocalError';
  readonly kind: NaverLocalErrorKind;

  constructor(kind: NaverLocalErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

// ---------------------------------------------------------------------------
// 순수 helpers
// ---------------------------------------------------------------------------

const HTML_TAG_RE = /<[^>]+>/g;

/** 네이버 title의 <b> 강조 태그 제거 + 기본 HTML 엔티티 디코드. */
export function stripHtmlTags(input: string): string {
  return input
    .replace(HTML_TAG_RE, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** mapx(경도×10^7) / mapy(위도×10^7) 정수 문자열 → WGS84 도(degree). */
export function normalizeNaverCoord(mapx: string, mapy: string): { lat: number; lng: number } {
  const x = Number(mapx);
  const y = Number(mapy);
  if (!Number.isFinite(x) || !Number.isFinite(y) || mapx.trim() === '' || mapy.trim() === '') {
    throw new Error(`네이버 좌표 파싱 실패: mapx=${mapx}, mapy=${mapy}`);
  }
  return { lat: y / COORD_SCALE, lng: x / COORD_SCALE };
}

/** 좌표가 한국 영토 bbox 안인지 — 좌표계 format mismatch 조기 감지 안전망. */
export function isPlausibleKoreaWgs84(lat: number, lng: number): boolean {
  return (
    lat >= KOREA_LAT_MIN &&
    lat <= KOREA_LAT_MAX &&
    lng >= KOREA_LNG_MIN &&
    lng <= KOREA_LNG_MAX
  );
}

/** 네이버 카테고리("음식점>한식>육류,고기") → 마지막 leaf. 빈 문자열 → null. */
export function naverCategoryLeaf(category: string): string | null {
  const trimmed = category.trim();
  if (trimmed.length === 0) return null;
  const parts = trimmed.split('>');
  const leaf = parts[parts.length - 1]?.trim() ?? '';
  return leaf.length > 0 ? leaf : null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** 네이버 응답 raw → 필수 필드(title/mapx/mapy) 통과한 item만. */
export function parseNaverLocalResponse(raw: unknown): NaverLocalItem[] {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('네이버 응답이 객체가 아닙니다.');
  }
  const items = (raw as { items?: unknown }).items;
  if (items === undefined) return [];
  if (!Array.isArray(items)) {
    throw new Error('네이버 응답 items가 배열이 아닙니다.');
  }
  const out: NaverLocalItem[] = [];
  for (const it of items) {
    if (it === null || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    if (!isNonEmptyString(o.title) || !isNonEmptyString(o.mapx) || !isNonEmptyString(o.mapy)) {
      continue;
    }
    out.push({
      title: o.title,
      category: typeof o.category === 'string' ? o.category : '',
      address: typeof o.address === 'string' ? o.address : '',
      roadAddress: typeof o.roadAddress === 'string' ? o.roadAddress : '',
      mapx: o.mapx,
      mapy: o.mapy,
      telephone: typeof o.telephone === 'string' ? o.telephone : '',
      link: typeof o.link === 'string' ? o.link : '',
    });
  }
  return out;
}

/** name + 좌표로 deterministic provider ID 합성 (네이버 안정 ID 미제공). */
function makeNaverPlaceId(name: string, mapx: string, mapy: string): string {
  return `naver:${name}|${mapx},${mapy}`;
}

/** NaverLocalItem[] → PlaceSearchResult[]. 한국 bbox 밖 좌표 item은 제외 (format mismatch 안전망). */
export function buildPlaceSearchResults(items: NaverLocalItem[]): PlaceSearchResult[] {
  const out: PlaceSearchResult[] = [];
  for (const it of items) {
    let coord: { lat: number; lng: number };
    try {
      coord = normalizeNaverCoord(it.mapx, it.mapy);
    } catch {
      continue;
    }
    if (!isPlausibleKoreaWgs84(coord.lat, coord.lng)) continue;

    const name = stripHtmlTags(it.title);
    const road = (it.roadAddress ?? '').trim();
    const jibun = (it.address ?? '').trim();
    const address = road.length > 0 ? road : jibun.length > 0 ? jibun : null;
    const phone = (it.telephone ?? '').trim();

    out.push({
      providerPlaceId: makeNaverPlaceId(name, it.mapx, it.mapy),
      name,
      category: naverCategoryLeaf(it.category ?? ''),
      address,
      lat: coord.lat,
      lng: coord.lng,
      phone: phone.length > 0 ? phone : null,
      source: 'naver',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// fetchNaverLocal — openapi.naver.com 지역검색 호출
// ---------------------------------------------------------------------------

export interface FetchNaverLocalArgs {
  query: string;
  display: number;
  clientId: string;
  clientSecret: string;
  fetch: typeof globalThis.fetch;
}

export async function fetchNaverLocal(args: FetchNaverLocalArgs): Promise<NaverLocalItem[]> {
  const display = Math.max(1, Math.min(MAX_DISPLAY, Math.trunc(args.display)));
  const params = new URLSearchParams({
    query: args.query,
    display: String(display),
  });
  const url = `${NAVER_LOCAL_URL}?${params.toString()}`;

  let response: Response;
  try {
    response = await args.fetch(url, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': args.clientId,
        'X-Naver-Client-Secret': args.clientSecret,
      },
    });
  } catch (error) {
    throw new NaverLocalError(
      'network',
      error instanceof Error ? error.message : '네이버 지역검색 호출 실패',
    );
  }

  if (response.status === 429) {
    throw new NaverLocalError('rate_limit', '네이버 지역검색 호출 한도를 초과했어요.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new NaverLocalError('unauthorized', '네이버 지역검색 인증에 실패했어요.');
  }
  if (!response.ok) {
    throw new NaverLocalError('bad_response', `네이버 지역검색 응답 오류 (status=${response.status})`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new NaverLocalError('bad_response', '네이버 지역검색 응답 JSON 파싱 실패');
  }
  return parseNaverLocalResponse(body);
}
