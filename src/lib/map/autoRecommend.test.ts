import { buildAutoQuery, RECOMMEND_CATEGORIES } from './autoRecommend';

describe('autoRecommend', () => {
  test('카테고리 칩은 맛집·카페·술집 3종 (맛집이 첫 번째 = 기본)', () => {
    expect(RECOMMEND_CATEGORIES).toEqual(['맛집', '카페', '술집']);
  });

  test('역명 + 카테고리로 검색 쿼리를 만든다', () => {
    expect(buildAutoQuery('공덕역', '맛집')).toBe('공덕역 맛집');
    expect(buildAutoQuery('강남역', '카페')).toBe('강남역 카페');
    expect(buildAutoQuery('홍대입구역', '술집')).toBe('홍대입구역 술집');
  });
});
