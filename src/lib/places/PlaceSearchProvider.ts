// PlaceSearchProvider — 장소 검색 데이터 소스 추상화 (S16 Phase a, 항상 유지).
//
// D1 근거: 카카오 Local API(Q-A2 약관 답변 대기) ↔ 네이버 검색 API fallback을
// 같은 인터페이스 뒤로 추상화. 추후 카카오 "허용" 답변 시 KakaoLocalProvider를
// 같은 인터페이스로 plug-in → caller(지도 화면) 코드 변경 없이 provider만 교체.
//
// 좌표는 항상 WGS84로 정규화된 상태 (D18 — provider/Edge 측에서 처리 완료).

export type PlaceSource = 'naver' | 'kakao';

/**
 * 정규화된 장소 검색 결과 (provider 무관 공통 shape).
 * Edge Function `supabase/functions/_lib/naver_local.ts`의 PlaceSearchResult와 shape mirror —
 * 변경 시 양쪽 동기화 (Deno ↔ RN 런타임 분리로 파일 공유 불가).
 */
export interface PlaceSearchResult {
  /** provider 고유 ID. 네이버 지역검색은 안정 ID 미제공 → name+좌표 합성 (마커 key·dedup용). */
  providerPlaceId: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number; // WGS84
  lng: number; // WGS84
  phone: string | null;
  source: PlaceSource;
}

export interface PlaceSearchQuery {
  /** 검색어 (비어있지 않아야 함). */
  query: string;
  /** 결과 수 (옵션). 네이버 지역검색은 최대 5. */
  display?: number;
}

/**
 * 장소 검색 provider 공통 인터페이스.
 * 구현: NaverSearchProvider (fallback, eager 활성) / KakaoLocalProvider (Q-A2 허용 시).
 */
export interface PlaceSearchProvider {
  readonly source: PlaceSource;
  search(query: PlaceSearchQuery): Promise<PlaceSearchResult[]>;
}
