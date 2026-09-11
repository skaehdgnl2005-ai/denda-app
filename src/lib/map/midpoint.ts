// S-MAP M3+M5 — 멤버 중간지점 추천 (순수 좌표 로직, 키 0, 전부 Jest 검증).
//
// D41(Q-B23 부분 supersede): 멤버 출발지 = 각자 서버 등록(group_origins, RLS) → 취합해
// 중간점 계산. 최근 출발지 칩(recentOrigins)만 온디바이스 유지. 본 모듈은 좌표 산술만 —
// 색·핀 렌더는 NaverMapScene(DESIGN 토큰)이 점등 시 그린다.
//
// 중간점은 산술 중심(arithmetic centroid). 베타 반경(서울 수 km)에서 구면 중심과의 오차는
// 1m 미만이라 충분 — haversine은 추천 정렬·반경 산출에 재사용한다(distance.ts).

import { haversineMeters } from '@/lib/coords/distance';
import { coordKey, normalizeWgs84, type Wgs84Coord } from '@/lib/coords/normalize';

import type { MapMarker, MapScene } from './mapScene';

/** 멤버 출발지 — 라벨(장소명/주소) + WGS84 좌표. recentOrigins와 공유. */
export interface OriginPoint {
  label: string;
  coord: Wgs84Coord;
}

/**
 * 좌표 집합의 산술 중심(중간지점). 비어 있으면 한국어 throw.
 * 결과는 normalizeWgs84 통과값(D18) — 잘못된 좌표가 지도/쿼리로 새어나가지 못하게 한다.
 */
export function computeMidpoint(coords: Wgs84Coord[]): Wgs84Coord {
  if (coords.length === 0) {
    throw new Error('출발지를 먼저 추가해주세요.');
  }
  const sum = coords.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), {
    lat: 0,
    lng: 0,
  });
  return normalizeWgs84(sum.lat / coords.length, sum.lng / coords.length);
}

/** center에서 가장 먼 좌표까지의 haversine 거리(미터). 비어 있으면 0. */
export function maxDistanceMeters(center: Wgs84Coord, coords: Wgs84Coord[]): number {
  return coords.reduce((max, c) => Math.max(max, haversineMeters(center, c)), 0);
}

/**
 * center에 가까운 순으로 정렬(오름차순). 원본 불변 — 새 배열 반환.
 * "중간점 근처 장소 추천"에서 검색 결과(PlaceSearchResult)를 거리순으로 재정렬할 때 재사용.
 */
export function sortByDistanceTo<T extends { lat: number; lng: number }>(
  items: T[],
  center: Wgs84Coord,
): T[] {
  return [...items].sort(
    (a, b) =>
      haversineMeters({ lat: a.lat, lng: a.lng }, center) -
      haversineMeters({ lat: b.lat, lng: b.lng }, center),
  );
}

/**
 * ④ 중간지점 — 출발지 + 중간점 → MapScene (member 마커 + midpoint 마커).
 *
 * 멤버 마커는 onPress 액션 없음(member/midpoint는 확정 대상이 아님 — actionId 미설정).
 * midpoint는 emphasized(강조)로 1개. 동선이 아니므로 폴리라인 없음. 색·강조 스타일은 렌더러
 * (NaverMapScene)가 DESIGN 토큰으로만 그린다.
 */
export function toMidpointScene(
  origins: OriginPoint[],
  midpoint: Wgs84Coord | null,
  midpointLabel: string = '중간지점',
): MapScene {
  const markers: MapMarker[] = origins.map((o, i) => ({
    id: `member-${i}-${coordKey(o.coord)}`,
    coord: o.coord,
    kind: 'member',
    label: o.label,
  }));

  if (midpoint !== null) {
    markers.push({
      id: `midpoint-${coordKey(midpoint)}`,
      coord: midpoint,
      kind: 'midpoint',
      label: midpointLabel,
      emphasized: true,
    });
  }

  return { mode: 'midpoint', markers, polylines: [] };
}
