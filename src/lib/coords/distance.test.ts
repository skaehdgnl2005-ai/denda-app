import { haversineMeters } from './distance';
import type { Wgs84Coord } from './normalize';

const SEOUL_CITY_HALL: Wgs84Coord = { lat: 37.5663, lng: 126.9779 };
const GANGNAM_STATION: Wgs84Coord = { lat: 37.4979, lng: 127.0276 };

describe('haversineMeters', () => {
  it('같은 좌표 → 0', () => {
    expect(haversineMeters(SEOUL_CITY_HALL, SEOUL_CITY_HALL)).toBe(0);
  });

  it('서울시청 ↔ 강남역 ≈ 8.5km (±300m)', () => {
    const d = haversineMeters(SEOUL_CITY_HALL, GANGNAM_STATION);
    expect(d).toBeGreaterThan(8200);
    expect(d).toBeLessThan(8800);
  });

  it('대칭성 — a→b 와 b→a 동일', () => {
    expect(haversineMeters(SEOUL_CITY_HALL, GANGNAM_STATION)).toBeCloseTo(
      haversineMeters(GANGNAM_STATION, SEOUL_CITY_HALL),
      3,
    );
  });

  it('적도에서 경도 1도 ≈ 111km (±1km)', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('음수 아닌 거리 반환', () => {
    expect(haversineMeters({ lat: -10, lng: -10 }, { lat: 10, lng: 10 })).toBeGreaterThan(0);
  });
});
