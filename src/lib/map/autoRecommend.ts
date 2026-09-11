// S-MAP M5 — 검색 0타 자동 추천 쿼리. 네이버 지역검색은 좌표 기반 주변검색이 없어
// "역명 + 카테고리" 키워드를 자동 발사한다. 결과 정렬은 sortByDistanceTo(역 좌표)가 담당.

export const RECOMMEND_CATEGORIES = ['맛집', '카페', '술집'] as const;
export type RecommendCategory = (typeof RECOMMEND_CATEGORIES)[number];

/** "공덕역 맛집" 형태의 네이버 지역검색 쿼리. */
export function buildAutoQuery(stationName: string, category: RecommendCategory): string {
  return `${stationName} ${category}`;
}
