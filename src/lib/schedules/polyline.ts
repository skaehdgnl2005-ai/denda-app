// S15-mapmode-logic — schedule mode 동선 폴리라인 segments.
//
// DESIGN §10.5: brand-500 2pt dashed, 32pt 숫자 배지, "마커 5개 초과 시 폴리라인 자동 숨김
// (가장 가까운 두 점만)". 본 모듈은 좌표 segment array만 산출 — stroke·dashed·색은 렌더러(native MapView)가
// DESIGN 토큰으로 그린다.

import { haversineMeters } from '@/lib/coords/distance';
import type { Wgs84Coord } from '@/lib/coords/normalize';

import type { ScheduleMapPoint } from './scheduleMapPoint';

export interface PolylineSegment {
  from: Wgs84Coord;
  to: Wgs84Coord;
}

const DEFAULT_HIDE_THRESHOLD = 5;

/**
 * chronological 정렬된 점 배열 → 폴리라인 segments.
 *
 * - N ≤ hideThreshold: consecutive segments (chronological, N-1개)
 * - N > hideThreshold: 가장 가까운 두 점(haversine 최소) 사이 segment 1개만.
 *   동일 거리 다수면 (i,j) i<j 작은 쪽 우선 — deterministic.
 *   segment 방향은 from=earlier order, to=later order (chronological 보존).
 *
 * @param hideThreshold default 5 (DESIGN §10.5). 테스트·튜닝용 인자.
 */
export function buildPolylineSegments(
  points: ScheduleMapPoint[],
  hideThreshold: number = DEFAULT_HIDE_THRESHOLD,
): PolylineSegment[] {
  if (points.length < 2) return [];

  if (points.length <= hideThreshold) {
    const out: PolylineSegment[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (a === undefined || b === undefined) continue;
      out.push({ from: a.coord, to: b.coord });
    }
    return out;
  }

  // hide mode: 가장 가까운 pair 1개만
  let minDist = Infinity;
  let minI = 0;
  let minJ = 1;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < points.length; j += 1) {
      const b = points[j];
      if (b === undefined) continue;
      const d = haversineMeters(a.coord, b.coord);
      if (d < minDist) {
        minDist = d;
        minI = i;
        minJ = j;
      }
    }
  }

  // points는 chronological 정렬이므로 minI < minJ === earlier→later
  const from = points[minI];
  const to = points[minJ];
  if (from === undefined || to === undefined) return [];
  return [{ from: from.coord, to: to.coord }];
}
