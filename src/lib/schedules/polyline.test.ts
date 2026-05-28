// S15-mapmode-logic — schedule mode 동선 폴리라인 (DESIGN §10.5).
//
// 규칙:
//   - N ≤ 5: chronological consecutive segments (N-1개)
//   - N > 5: 폴리라인 자동 숨김 → 가장 가까운 두 점 사이 segment 1개만 (haversine 최소)
// brand-500 · 2pt dashed는 렌더러 책임 (DESIGN §10.5 토큰). 본 모듈은 좌표 segment만.

import { buildPolylineSegments } from './polyline';
import type { ScheduleMapPoint } from './scheduleMapPoint';

function pt(id: string, lat: number, lng: number, order: number): ScheduleMapPoint {
  return {
    groupId: id,
    groupName: id,
    placeId: id,
    placeName: id,
    coord: { lat, lng },
    confirmedStartAt: `2026-05-${String(20 + order).padStart(2, '0')}T10:00:00.000Z`,
    order,
  };
}

describe('buildPolylineSegments', () => {
  test('0개 → 빈 segments', () => {
    expect(buildPolylineSegments([])).toEqual([]);
  });

  test('1개 → 빈 segments (segment 불가)', () => {
    expect(buildPolylineSegments([pt('a', 37.5, 127.0, 1)])).toEqual([]);
  });

  test('2개 → 1 segment (chronological)', () => {
    const out = buildPolylineSegments([pt('a', 37.5, 127.0, 1), pt('b', 37.6, 127.1, 2)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      from: { lat: 37.5, lng: 127.0 },
      to: { lat: 37.6, lng: 127.1 },
    });
  });

  test('5개 → 4 consecutive segments (chronological)', () => {
    const pts = [
      pt('a', 37.5, 127.0, 1),
      pt('b', 37.51, 127.01, 2),
      pt('c', 37.52, 127.02, 3),
      pt('d', 37.53, 127.03, 4),
      pt('e', 37.54, 127.04, 5),
    ];
    const out = buildPolylineSegments(pts);
    expect(out).toHaveLength(4);
    expect(out[0]?.from).toEqual({ lat: 37.5, lng: 127.0 });
    expect(out[3]?.to).toEqual({ lat: 37.54, lng: 127.04 });
  });

  test('6개 → 가장 가까운 두 점 사이 segment 1개만 (DESIGN §10.5 hide rule)', () => {
    // p3=(37.500, 127.000), p4=(37.5005, 127.0005) 가 압도적으로 가깝다 (~70m).
    // 나머지는 서로 km 단위.
    const pts = [
      pt('p1', 37.4, 127.0, 1),
      pt('p2', 37.45, 127.05, 2),
      pt('p3', 37.5, 127.0, 3),
      pt('p4', 37.5005, 127.0005, 4),
      pt('p5', 37.6, 127.1, 5),
      pt('p6', 37.7, 127.2, 6),
    ];
    const out = buildPolylineSegments(pts);
    expect(out).toHaveLength(1);
    // segment 방향은 from=earlier order, to=later order (chronological 방향 유지)
    expect(out[0]).toEqual({
      from: { lat: 37.5, lng: 127.0 },
      to: { lat: 37.5005, lng: 127.0005 },
    });
  });

  test('동일 입력 → 동일 출력 (deterministic 보장, 부동소수 fuzziness 무관)', () => {
    // 인접 lng 0.01° pair들은 부동소수상 미세하게 다른 거리로 측정되지만,
    // 같은 입력에 대해 같은 출력이 나오는 것만 보장하면 충분 (`<` 비교 → first-found wins).
    const pts = [
      pt('p1', 37.5, 127.0, 1),
      pt('p2', 37.5, 127.01, 2),
      pt('p3', 37.5, 127.02, 3),
      pt('p4', 37.5, 127.03, 4),
      pt('p5', 37.5, 127.04, 5),
      pt('p6', 37.5, 127.05, 6),
    ];
    const a = buildPolylineSegments(pts);
    const b = buildPolylineSegments(pts);
    expect(a).toHaveLength(1);
    expect(a).toEqual(b);
  });

  test('hideThreshold custom 주입 가능', () => {
    // threshold=2 → 3개부터 hide mode
    const pts = [
      pt('a', 37.5, 127.0, 1),
      pt('b', 37.50001, 127.00001, 2), // 가장 가까움
      pt('c', 37.7, 127.3, 3),
    ];
    const out = buildPolylineSegments(pts, 2);
    expect(out).toHaveLength(1);
    expect(out[0]?.from).toEqual({ lat: 37.5, lng: 127.0 });
    expect(out[0]?.to).toEqual({ lat: 37.50001, lng: 127.00001 });
  });
});
