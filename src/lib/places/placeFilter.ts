// placeFilter.ts — 장소 검색 결과 필터 (카테고리 + 반경 조절).
//
// S10 acceptance "카테고리 필터 + 반경 조절"의 순수 로직. 검색 결과(PlaceSearchResult[])를
// 클라이언트에서 카테고리·반경 기준으로 거른다. 네이버 지역검색은 카테고리/반경 쿼리
// 파라미터가 없으므로(키워드 only) 클라이언트 후필터로 처리. 카카오 Local API unblock 시
// 서버 측 radius 파라미터로 일부 이관 가능하나 본 필터는 provider 무관 안전망.

import { haversineMeters } from '@/lib/coords/distance';
import type { Wgs84Coord } from '@/lib/coords/normalize';

import type { PlaceSearchResult } from './PlaceSearchProvider';

/**
 * 카테고리 필터. categories가 null/빈 배열이면 전체 통과.
 * 결과 category가 지정 카테고리 중 하나를 substring으로 포함하면 통과 (대소문자 무시).
 * category가 null인 결과는 카테고리 필터 적용 시 제외.
 */
export function filterByCategory(
  results: PlaceSearchResult[],
  categories: string[] | null,
): PlaceSearchResult[] {
  if (categories === null || categories.length === 0) return results;
  const needles = categories.map((c) => c.trim().toLowerCase()).filter((c) => c.length > 0);
  if (needles.length === 0) return results;
  return results.filter((r) => {
    if (r.category === null) return false;
    const hay = r.category.toLowerCase();
    return needles.some((n) => hay.includes(n));
  });
}

/**
 * 반경 필터. radiusMeters <= 0이면 필터 안 함(전체 통과).
 * center로부터 haversine 거리가 radiusMeters 이내인 결과만 통과.
 */
export function filterByRadius(
  results: PlaceSearchResult[],
  center: Wgs84Coord,
  radiusMeters: number,
): PlaceSearchResult[] {
  if (radiusMeters <= 0) return results;
  return results.filter((r) => haversineMeters(center, { lat: r.lat, lng: r.lng }) <= radiusMeters);
}

export interface PlaceFilter {
  categories?: string[] | null;
  center?: Wgs84Coord | null;
  radiusMeters?: number | null;
}

/** 카테고리 → 반경 순으로 필터 조합 적용. center 없으면 반경 필터 skip. */
export function applyPlaceFilters(
  results: PlaceSearchResult[],
  filter: PlaceFilter,
): PlaceSearchResult[] {
  let out = filterByCategory(results, filter.categories ?? null);
  if (filter.center && filter.radiusMeters != null && filter.radiusMeters > 0) {
    out = filterByRadius(out, filter.center, filter.radiusMeters);
  }
  return out;
}
