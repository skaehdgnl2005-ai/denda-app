// coords/distance.ts — WGS84 좌표 간 거리 (반경 필터·동선 계산용).
//
// 반경 조절(S10 카테고리 필터 + 반경)·클러스터링 근접 판단의 단일 거리 함수.
// Haversine — 구면 대원 거리. 베타 반경(수백 m~수 km)에서 충분히 정확.

import type { Wgs84Coord } from './normalize';

const EARTH_RADIUS_M = 6371008.8; // IUGG mean Earth radius

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 두 WGS84 좌표 간 대원 거리(미터). 항상 ≥ 0. */
export function haversineMeters(a: Wgs84Coord, b: Wgs84Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
