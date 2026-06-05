// S20 — 장소 영속화. NaverSearchProvider 검색 결과를 places 테이블에 upsert.
//
// 0021_places_provider: places.source + provider_place_id 보강 + (source, provider_place_id) UNIQUE.
// (원래 0019였으나 0019_accept_friend_request_rpc와 version PK 충돌로 2026-06-05에 0021로 rename)
//   → 같은 식당을 여러 모임이 골라도 places 행 1개로 수렴 (upsert onConflict).
//   RLS places_insert_authenticated (0002:119) — authenticated INSERT 자연 허용.
//
// phone 은 places 스키마에 없음 → row 에서 제외. 좌표는 이미 WGS84 정규화 (D18, Edge 측 처리).

import { supabase } from '@/lib/supabase/client';

import type { PlaceSearchResult } from './PlaceSearchProvider';

const PERSIST_FAILED_MESSAGE = '장소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.';

/**
 * 검색 결과 장소를 places 에 upsert 하고 places.id 를 반환한다.
 * (source, provider_place_id) 기준 dedup — 이미 있으면 기존 행 id 반환.
 */
export async function persistPlace(place: PlaceSearchResult): Promise<string> {
  const row = {
    source: place.source,
    provider_place_id: place.providerPlaceId,
    name: place.name,
    category: place.category,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
  };

  const { data, error } = await supabase
    .from('places')
    .upsert(row, { onConflict: 'source,provider_place_id' })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(PERSIST_FAILED_MESSAGE);
  }

  return (data as { id: string }).id;
}
