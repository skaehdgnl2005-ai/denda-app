// kakao_local.ts — S16 Phase b KakaoLocalProvider 서버 측 helper (Deno).
//
// Q-A2 "허용" 답변 수신(2026-06-01, D37) → 카카오 Local 키워드검색을 PlaceSearchProvider
// 두 번째 구현으로 추가. NaverSearchProvider(D36)와 같은 인터페이스 → 데이터 quality 비교 후
// 우위 시 primary 교체 (live 비교는 KAKAO_REST_API_KEY 등록 후).
//
// 책임 (naver_local.ts 미러):
//   1. normalizeKakaoCoord — x(경도)/y(위도) WGS84 decimal 문자열 → 도(degree). Naver와 달리 스케일링 없음
//   2. isPlausibleKoreaWgs84 — 한국 bbox range 체크 (좌표 format mismatch 안전망)
//   3. kakaoCategoryLeaf — "음식점 > 카페 > 커피전문점" → 마지막 leaf
//   4. parseKakaoLocalResponse / buildPlaceSearchResults — 응답 → PlaceSearchResult[]
//   5. fetchKakaoLocal — dapi.kakao.com 호출 (fetch DI, REST key는 Edge env)
//
// 보안: KAKAO_REST_API_KEY는 Edge env only (CLAUDE.md rule 7). 클라이언트는 Edge invoke만.
// → key-secrecy proxy는 rule 7로 강제 (Q-B8 "proxy 2종 구분" 참조). cost/QPS proxy와 별개.

const KAKAO_LOCAL_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const MAX_SIZE = 15; // 카카오 키워드검색 size 최대 15 (Naver 지역검색 5보다 우위)

// 한국 영토 bounding box (제주·울릉/독도 포함 + 여유 마진). naver_local.ts와 동일.
const KOREA_LAT_MIN = 32.5;
const KOREA_LAT_MAX = 39.0;
const KOREA_LNG_MIN = 124.0;
const KOREA_LNG_MAX = 132.5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 카카오 Local 키워드검색 document (필수 필드 + 매핑에 쓰는 필드만). */
export interface KakaoLocalDocument {
  id: string;
  place_name: string;
  category_name?: string;
  category_group_name?: string;
  address_name?: string;
  road_address_name?: string;
  x: string; // 경도 (WGS84 decimal)
  y: string; // 위도 (WGS84 decimal)
  phone?: string;
  place_url?: string;
}

/**
 * 정규화된 장소 검색 결과. provider 무관 공통 shape.
 * 클라이언트 `src/lib/places/PlaceSearchProvider.ts`의 PlaceSearchResult와 shape mirror —
 * 변경 시 양쪽 동기화 (Deno ↔ RN 런타임 분리로 파일 공유 불가).
 */
export interface PlaceSearchResult {
  /** provider 고유 ID. 카카오는 stable `id` 제공 → `kakao:{id}` (Naver는 합성). */
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

export type KakaoLocalErrorKind =
  | 'rate_limit' // 429 — quota 초과 ("잠시 후 다시" fallback)
  | 'unauthorized' // 401/403 — REST key 오류/권한
  | 'network' // fetch throw
  | 'bad_response'; // 5xx + 기타 비정상

export class KakaoLocalError extends Error {
  override readonly name = 'KakaoLocalError';
  readonly kind: KakaoLocalErrorKind;

  constructor(kind: KakaoLocalErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

// ---------------------------------------------------------------------------
// 순수 helpers
// ---------------------------------------------------------------------------

/** x(경도) / y(위도) WGS84 decimal 문자열 → 도(degree). */
export function normalizeKakaoCoord(x: string, y: string): { lat: number; lng: number } {
  const lng = Number(x);
  const lat = Number(y);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || x.trim() === '' || y.trim() === '') {
    throw new Error(`카카오 좌표 파싱 실패: x=${x}, y=${y}`);
  }
  return { lat, lng };
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

/** 카카오 카테고리("음식점 > 카페 > 커피전문점") → 마지막 leaf. 빈 문자열 → null. */
export function kakaoCategoryLeaf(category: string): string | null {
  const trimmed = category.trim();
  if (trimmed.length === 0) return null;
  const parts = trimmed.split('>');
  const leaf = parts[parts.length - 1]?.trim() ?? '';
  return leaf.length > 0 ? leaf : null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function optString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** 카카오 응답 raw → 필수 필드(id/place_name/x/y) 통과한 document만. */
export function parseKakaoLocalResponse(raw: unknown): KakaoLocalDocument[] {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('카카오 응답이 객체가 아닙니다.');
  }
  const documents = (raw as { documents?: unknown }).documents;
  if (documents === undefined) return [];
  if (!Array.isArray(documents)) {
    throw new Error('카카오 응답 documents가 배열이 아닙니다.');
  }
  const out: KakaoLocalDocument[] = [];
  for (const it of documents) {
    if (it === null || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    if (
      !isNonEmptyString(o.id) ||
      !isNonEmptyString(o.place_name) ||
      !isNonEmptyString(o.x) ||
      !isNonEmptyString(o.y)
    ) {
      continue;
    }
    out.push({
      id: o.id,
      place_name: o.place_name,
      category_name: optString(o.category_name),
      category_group_name: optString(o.category_group_name),
      address_name: optString(o.address_name),
      road_address_name: optString(o.road_address_name),
      x: o.x,
      y: o.y,
      phone: optString(o.phone),
      place_url: optString(o.place_url),
    });
  }
  return out;
}

/** category_group_name(짧은 카테고리) 우선, 없으면 category_name leaf. */
function pickCategory(doc: KakaoLocalDocument): string | null {
  const group = (doc.category_group_name ?? '').trim();
  if (group.length > 0) return group;
  return kakaoCategoryLeaf(doc.category_name ?? '');
}

/** KakaoLocalDocument[] → PlaceSearchResult[]. 한국 bbox 밖 좌표는 제외 (format mismatch 안전망). */
export function buildPlaceSearchResults(documents: KakaoLocalDocument[]): PlaceSearchResult[] {
  const out: PlaceSearchResult[] = [];
  for (const doc of documents) {
    let coord: { lat: number; lng: number };
    try {
      coord = normalizeKakaoCoord(doc.x, doc.y);
    } catch {
      continue;
    }
    if (!isPlausibleKoreaWgs84(coord.lat, coord.lng)) continue;

    const road = (doc.road_address_name ?? '').trim();
    const jibun = (doc.address_name ?? '').trim();
    const address = road.length > 0 ? road : jibun.length > 0 ? jibun : null;
    const phone = (doc.phone ?? '').trim();

    out.push({
      providerPlaceId: `kakao:${doc.id}`,
      name: doc.place_name,
      category: pickCategory(doc),
      address,
      lat: coord.lat,
      lng: coord.lng,
      phone: phone.length > 0 ? phone : null,
      source: 'kakao',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// fetchKakaoLocal — dapi.kakao.com 키워드검색 호출
// ---------------------------------------------------------------------------

export interface FetchKakaoLocalArgs {
  query: string;
  display: number;
  restApiKey: string;
  fetch: typeof globalThis.fetch;
}

export async function fetchKakaoLocal(args: FetchKakaoLocalArgs): Promise<KakaoLocalDocument[]> {
  const size = Math.max(1, Math.min(MAX_SIZE, Math.trunc(args.display)));
  const params = new URLSearchParams({
    query: args.query,
    size: String(size),
  });
  const url = `${KAKAO_LOCAL_URL}?${params.toString()}`;

  let response: Response;
  try {
    response = await args.fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${args.restApiKey}`,
      },
    });
  } catch (error) {
    throw new KakaoLocalError(
      'network',
      error instanceof Error ? error.message : '카카오 Local 호출 실패',
    );
  }

  if (response.status === 429) {
    throw new KakaoLocalError('rate_limit', '카카오 Local 호출 한도를 초과했어요.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new KakaoLocalError('unauthorized', '카카오 Local 인증에 실패했어요.');
  }
  if (!response.ok) {
    throw new KakaoLocalError('bad_response', `카카오 Local 응답 오류 (status=${response.status})`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new KakaoLocalError('bad_response', '카카오 Local 응답 JSON 파싱 실패');
  }
  return parseKakaoLocalResponse(body);
}
