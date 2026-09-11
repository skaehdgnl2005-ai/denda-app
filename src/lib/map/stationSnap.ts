// S-MAP M5 — 중간지점 → 최근접 지하철역 스냅 (순수 함수, 키 0, 전부 Jest).
//
// "대략적 중간지점" = 산술 중점에서 가장 가까운 역. 3km 초과면 null → 화면은 역 카드를
// 생략하고 기존 산술 중점 + 수동 검색으로 폴백한다(교외 모임). 역 데이터는
// stations.data.ts(공공데이터 정적 번들, 본 타입을 import)가 공급 — DI라 테스트 결정적.

import { haversineMeters } from '@/lib/coords/distance';
import type { Wgs84Coord } from '@/lib/coords/normalize';

/** 지하철역 1건 — stations.data.ts 생성 스크립트와 공유하는 shape. */
export interface SubwayStation {
  name: string;
  lat: number;
  lng: number;
}

export interface StationSnap {
  name: string;
  coord: Wgs84Coord;
  distanceMeters: number;
}

/** 이보다 멀면 역 스냅 생략 (교외 폴백). */
export const STATION_SNAP_MAX_METERS = 3000;

/** coord에서 가장 가까운 역. 전부 3km 초과이거나 목록이 비면 null. 동률은 앞쪽 승. */
export function nearestStation(
  coord: Wgs84Coord,
  stations: readonly SubwayStation[],
): StationSnap | null {
  let best: StationSnap | null = null;
  for (const s of stations) {
    const d = haversineMeters(coord, { lat: s.lat, lng: s.lng });
    if (d <= STATION_SNAP_MAX_METERS && (best === null || d < best.distanceMeters)) {
      best = { name: s.name, coord: { lat: s.lat, lng: s.lng }, distanceMeters: d };
    }
  }
  return best;
}
