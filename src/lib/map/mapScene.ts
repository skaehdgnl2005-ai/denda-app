// 지도 장면(MapScene) 계약 (D38).
//
// 4대 지도 기능(동선·일정 / 제휴 마커 / 검색→확정 / 중간지점)은 모두 입력을 이 순수
// MapScene 데이터로 변환해 MapHost에 넘긴다. 색·stroke·dash는 데이터에 없음 — 렌더러
// (NaverMapScene)가 DESIGN 토큰으로만 그린다. 좌표는 모두 D18 normalize 통과값.

import type { Wgs84Coord } from '@/lib/coords/normalize';
import type { MapViewMode } from '@/lib/places/MapViewMode';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
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

interface SearchSceneOptions {
  /**
   * ② 제휴 마커 시각 capability (M4) — 결과별 제휴 여부 판정을 호출자가 주입한다.
   * 제휴면 kind='partner' + emphasized=true → 렌더러가 §10.2 강조(1.4×·brand-500·stroke).
   *
   * 🔒 데이터 소스가 아니라 "강조 capability"다. 실제 partnership 데이터 연동은 Phase 3(D3)
   * 경계 → Phase 1+2 화면은 stub(`isResultPartner`, 항상 false)을 주입해 경계를 유지한다.
   * 미지정 시 모든 마커 비강조 (기존 계약 유지).
   */
  isPartner?: (result: PlaceSearchResult) => boolean;
}

/**
 * ③ 검색→장소 확정 — PlaceSearchResult[] → MapScene (place 마커).
 *
 * `actionId = providerPlaceId` — 리스트 keyExtractor·마커 onPress가 같은 식별자를 쓴다.
 * 화면은 actionId로 결과를 resolve(findResultByActionId)해 동일 확정 액션으로 수렴시킨다.
 * 검색 마커는 동선이 아니므로 폴리라인 없음. 제휴 강조는 opts.isPartner(M4) 주입 시에만.
 */
export function toSearchScene(
  results: PlaceSearchResult[],
  options: SearchSceneOptions = {},
): MapScene {
  const isPartner = options.isPartner ?? ((): boolean => false);
  const markers: MapMarker[] = results.map((r) => {
    const partner = isPartner(r);
    return {
      id: r.providerPlaceId,
      coord: { lat: r.lat, lng: r.lng },
      kind: partner ? 'partner' : 'place',
      label: r.name,
      actionId: r.providerPlaceId,
      ...(partner ? { emphasized: true } : {}),
    };
  });

  return { mode: 'search', markers, polylines: [] };
}
