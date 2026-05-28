import { applyPlaceFilters, filterByCategory, filterByRadius } from './placeFilter';
import type { PlaceSearchResult } from './PlaceSearchProvider';

function place(over: Partial<PlaceSearchResult>): PlaceSearchResult {
  return {
    providerPlaceId: over.providerPlaceId ?? 'naver:p',
    name: over.name ?? '가게',
    category: over.category ?? null,
    address: over.address ?? null,
    lat: over.lat ?? 37.5,
    lng: over.lng ?? 127.0,
    phone: over.phone ?? null,
    source: 'naver',
  };
}

const CAFE = place({
  providerPlaceId: 'c',
  name: '카페',
  category: '카페,디저트',
  lat: 37.5,
  lng: 127.0,
});
const KOREAN = place({
  providerPlaceId: 'k',
  name: '한식당',
  category: '한식',
  lat: 37.5008,
  lng: 127.0,
});
const NO_CAT = place({
  providerPlaceId: 'n',
  name: '미분류',
  category: null,
  lat: 37.5,
  lng: 127.0,
});

describe('filterByCategory', () => {
  it('categories null → 전체 통과', () => {
    expect(filterByCategory([CAFE, KOREAN, NO_CAT], null)).toHaveLength(3);
  });

  it('빈 배열 → 전체 통과', () => {
    expect(filterByCategory([CAFE, KOREAN], [])).toHaveLength(2);
  });

  it('카테고리 부분 일치 (substring)', () => {
    expect(filterByCategory([CAFE, KOREAN], ['카페'])).toEqual([CAFE]);
  });

  it('대소문자 무시 매칭', () => {
    const en = place({ providerPlaceId: 'e', category: 'Cafe' });
    expect(filterByCategory([en], ['cafe'])).toEqual([en]);
  });

  it('여러 카테고리 OR 매칭', () => {
    expect(filterByCategory([CAFE, KOREAN], ['카페', '한식'])).toHaveLength(2);
  });

  it('category null인 결과는 카테고리 필터 시 제외', () => {
    expect(filterByCategory([CAFE, NO_CAT], ['카페'])).toEqual([CAFE]);
  });
});

describe('filterByRadius', () => {
  const center = { lat: 37.5, lng: 127.0 };

  it('반경 안의 결과만 통과', () => {
    // CAFE = center(0m), KOREAN ≈ 89m 북쪽
    expect(filterByRadius([CAFE, KOREAN], center, 50)).toEqual([CAFE]);
  });

  it('반경 충분히 크면 전체 통과', () => {
    expect(filterByRadius([CAFE, KOREAN], center, 1000)).toHaveLength(2);
  });

  it('radiusMeters <= 0 → 필터 안 함(전체 통과)', () => {
    expect(filterByRadius([CAFE, KOREAN], center, 0)).toHaveLength(2);
  });
});

describe('applyPlaceFilters — 카테고리 + 반경 조합', () => {
  const center = { lat: 37.5, lng: 127.0 };

  it('필터 없음 → 전체 통과', () => {
    expect(applyPlaceFilters([CAFE, KOREAN, NO_CAT], {})).toHaveLength(3);
  });

  it('카테고리 + 반경 동시 적용', () => {
    const out = applyPlaceFilters([CAFE, KOREAN, NO_CAT], {
      categories: ['카페', '한식'],
      center,
      radiusMeters: 50,
    });
    expect(out).toEqual([CAFE]); // 카테고리 통과 중 반경 50m 안은 CAFE만
  });

  it('center 없으면 반경 필터 skip (카테고리만)', () => {
    expect(applyPlaceFilters([CAFE, KOREAN, NO_CAT], { categories: ['카페'] })).toEqual([CAFE]);
  });
});
