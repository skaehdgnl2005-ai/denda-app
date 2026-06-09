// 제휴 판정 seam (S-MAP M4, ② 제휴 마커 시각 capability).
//
// 🔒 Phase 3(D3) 경계: 실제 partnership 데이터 연동·집계·스키마는 Phase 1+2 작성 금지
// (PROJECT_CONTEXT §6). 그래서 이 판정은 **stub — 항상 false**.
//
// 제휴 *시각 capability*(PartnerBadge 배지 / emphasized 마커 강조)는 이 seam 뒤에서만
// 점등된다. 검색 결과에는 제휴 정보 컬럼이 없으므로(데이터 미연동) 현재는 모두 비제휴.
// Phase 3에서 검색 결과에 제휴 신호가 실리면 **이 함수 한 곳만** 교체 → 배지·마커가
// 코드 변경 0으로 점등(리스트/카드/지도 wire는 이미 capability 연결됨).

import type { PlaceSearchResult } from './PlaceSearchProvider';

/** 검색 결과의 제휴 여부. Phase 1+2 stub(false) — 데이터 연동은 Phase 3 경계. */
export function isResultPartner(_result: PlaceSearchResult): boolean {
  return false;
}
