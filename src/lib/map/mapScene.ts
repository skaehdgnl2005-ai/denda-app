// 지도 장면(MapScene) 계약 (D38).
//
// 4대 지도 기능(동선·일정 / 제휴 마커 / 검색→확정 / 중간지점)은 모두 입력을 이 순수
// MapScene 데이터로 변환해 MapHost에 넘긴다. 색·stroke·dash는 데이터에 없음 — 렌더러
// (NaverMapScene)가 DESIGN 토큰으로만 그린다. 좌표는 모두 D18 normalize 통과값.

import type { Wgs84Coord } from '@/lib/coords/normalize';
import type { MapViewMode } from '@/lib/places/MapViewMode';
import { buildPolylineSegments, type PolylineSegment } from '@/lib/schedules/polyline';
import type { ScheduleMapPoint } from '@/lib/schedules/scheduleMapPoint';

export type MapMarkerKind = 'order' | 'place' | 'partner' | 'midpoint' | 'member';

export interface MapMarker {
  id: string;
  coord: Wgs84Coord;
  kind: MapMarkerKind;
  /** ①②③ 숫자 또는 장소명. */
  label?: string;
  /** kind==='order'일 때 시간순 1-based index. */
  order?: number;
  /** 제휴/확정 강조 (② 시각 capability). */
  emphasized?: boolean;
  /** 마커 onPress 시 화면이 해석할 키 (확정·상세 라우팅). */
  actionId?: string;
}

export interface MapScenePolyline {
  segments: PolylineSegment[];
  /** DESIGN §10.5 — brand-500 2pt dashed. 토큰 적용은 렌더러 책임. */
  style: 'dashed-brand';
}

export interface MapScene {
  mode: MapViewMode;
  markers: MapMarker[];
  polylines: MapScenePolyline[];
  /** 없으면 마커 fit-to-bounds. */
  region?: { center: Wgs84Coord };
}

/** ① 동선·일정 지도 — ScheduleMapPoint[] → MapScene (order 마커 + dashed 폴리라인). */
export function toScheduleScene(points: ScheduleMapPoint[]): MapScene {
  const markers: MapMarker[] = points.map((p) => ({
    id: p.groupId,
    coord: p.coord,
    kind: 'order',
    label: String(p.order),
    order: p.order,
    actionId: p.groupId,
  }));

  const segments = buildPolylineSegments(points);
  const polylines: MapScenePolyline[] =
    segments.length > 0 ? [{ segments, style: 'dashed-brand' }] : [];

  return { mode: 'schedule', markers, polylines };
}
