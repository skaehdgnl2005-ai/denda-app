// coords/normalize.ts — 좌표 정규화 단일 진입점 (D18).
//
// D18: 모든 외부 장소/지도 좌표는 이 모듈을 통과해 WGS84 { lat, lng }로 정규화된다.
// 카카오 Local API는 WTM/TM/KTM/BESSEL/WCONGNAMUL 모두 지원 → 명시 안 하면 마커가
// km 단위로 어긋남. 카카오 호출은 `?x={lng}&y={lat}` (x=경도, y=위도) 형식 — 순서가
// 자주 뒤바뀌는 함정이라 toKakaoXY로 매핑을 단일화한다.
//
// 네이버 fallback(S16)은 Edge `_lib/naver_local.ts`에서 이미 WGS84로 정규화해 반환하므로
// 클라이언트는 검증/키 생성/카카오 매핑 용도로 본 모듈을 사용한다. 카카오 Local API가
// 정책 unblock(Q-A2)되면 KakaoLocalProvider가 toKakaoXY로 x/y를 구성한다.

export interface Wgs84Coord {
  lat: number; // 위도 (-90 ~ 90)
  lng: number; // 경도 (-180 ~ 180)
}

/** 한국 영토 bounding box (제주·울릉/독도 포함 + 여유 마진). Edge `_lib/naver_local.ts`와 정합. */
export const KOREA_BBOX = {
  latMin: 32.5,
  latMax: 39.0,
  lngMin: 124.0,
  lngMax: 132.5,
} as const;

function toFiniteNumber(v: number | string): number {
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  return Number.isFinite(n) ? n : NaN;
}

/** WGS84 유효 범위(위도 ±90, 경도 ±180) + 유한수 여부. */
export function isValidWgs84(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** 좌표가 한국 영토 bbox 안인지 — 좌표계 format mismatch 조기 감지 안전망. */
export function isPlausibleKoreaWgs84(lat: number, lng: number): boolean {
  return (
    lat >= KOREA_BBOX.latMin &&
    lat <= KOREA_BBOX.latMax &&
    lng >= KOREA_BBOX.lngMin &&
    lng <= KOREA_BBOX.lngMax
  );
}

/**
 * 외부 좌표(숫자 또는 문자열) → 검증된 WGS84 Wgs84Coord.
 * 비유한수 또는 WGS84 범위 밖이면 throw — 잘못된 좌표가 지도/쿼리로 새어나가지 못하게 한다.
 */
export function normalizeWgs84(lat: number | string, lng: number | string): Wgs84Coord {
  const latN = toFiniteNumber(lat);
  const lngN = toFiniteNumber(lng);
  if (!isValidWgs84(latN, lngN)) {
    throw new Error(`좌표를 해석할 수 없어요 (lat=${lat}, lng=${lng}).`);
  }
  return { lat: latN, lng: lngN };
}

/**
 * D18 카카오 Local API 좌표 파라미터 매핑 — `?x={lng}&y={lat}`.
 * x=경도(lng), y=위도(lat). 이 단일 함수로만 매핑해 lat/lng swap 버그를 차단한다.
 */
export function toKakaoXY(coord: Wgs84Coord): { x: number; y: number } {
  return { x: coord.lng, y: coord.lat };
}

/** 좌표 dedup/마커 key용 안정 문자열. 기본 정밀도 6자리(~0.1m). */
export function coordKey(coord: Wgs84Coord, precision = 6): string {
  return `${coord.lat.toFixed(precision)},${coord.lng.toFixed(precision)}`;
}
