import { isResultPartner } from './partnership';
import type { PlaceSearchResult } from './PlaceSearchProvider';

function result(overrides: Partial<PlaceSearchResult> = {}): PlaceSearchResult {
  return {
    providerPlaceId: 'naver:한솥:37.5:127.0',
    name: '한솥도시락',
    category: '한식',
    address: '서울 성북구',
    lat: 37.5,
    lng: 127.0,
    phone: null,
    source: 'naver',
    ...overrides,
  };
}

describe('isResultPartner — 제휴 판정 seam (② Phase 3(D3) 데이터 경계)', () => {
  // Phase 1+2: 실제 partnership 데이터 연동 금지 → stub은 항상 false.
  // 시각 capability(PartnerBadge / emphasized 마커)는 이 seam 뒤에서만 점등.
  // Phase 3에서 검색 결과에 제휴 정보가 실리면 이 함수만 교체 → 화면 코드 변경 0.
  test('검색 결과는 항상 비제휴 (stub — 데이터 소스 미연동)', () => {
    expect(isResultPartner(result())).toBe(false);
    expect(isResultPartner(result({ source: 'kakao', name: '스타벅스' }))).toBe(false);
  });
});
