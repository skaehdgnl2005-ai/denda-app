import { nearestStation, STATION_SNAP_MAX_METERS, type SubwayStation } from './stationSnap';

const STATIONS: SubwayStation[] = [
  { name: '강남역', lat: 37.4979, lng: 127.0276 },
  { name: '홍대입구역', lat: 37.5572, lng: 126.9245 },
  { name: '공덕역', lat: 37.5432, lng: 126.9512 },
];

describe('nearestStation', () => {
  test('가장 가까운 역을 반환한다 (공덕 근처 좌표 → 공덕역)', () => {
    const snap = nearestStation({ lat: 37.544, lng: 126.952 }, STATIONS);
    expect(snap).not.toBeNull();
    expect(snap?.name).toBe('공덕역');
    expect(snap?.coord).toEqual({ lat: 37.5432, lng: 126.9512 });
    expect(snap?.distanceMeters).toBeGreaterThan(0);
    expect(snap?.distanceMeters).toBeLessThan(300);
  });

  test('모든 역이 3km 초과면 null (교외 폴백)', () => {
    // 제주 좌표 — 위 3개 역 모두 수백 km.
    expect(nearestStation({ lat: 33.4996, lng: 126.5312 }, STATIONS)).toBeNull();
  });

  test('빈 역 목록이면 null', () => {
    expect(nearestStation({ lat: 37.5, lng: 127.0 }, [])).toBeNull();
  });

  test('동률이면 배열 앞쪽 역이 이긴다 (결정성)', () => {
    const twin: SubwayStation[] = [
      { name: 'A역', lat: 37.5, lng: 127.0 },
      { name: 'B역', lat: 37.5, lng: 127.0 },
    ];
    expect(nearestStation({ lat: 37.5, lng: 127.0 }, twin)?.name).toBe('A역');
  });

  test('임계값 상수는 3000m', () => {
    expect(STATION_SNAP_MAX_METERS).toBe(3000);
  });
});
