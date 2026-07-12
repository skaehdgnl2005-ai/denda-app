// src/lib/map/stations.data.test.ts
// 생성 데이터 sanity — 좌표 bbox·역명 형식·중복을 CI에서 상시 검증 (스펙 §10 리스크 완화).
import { KOREA_BBOX } from '@/lib/coords/normalize';

import { SUBWAY_STATIONS } from './stations.data';

describe('SUBWAY_STATIONS 데이터 sanity', () => {
  test('실 데이터 규모 (전국 도시철도 500역 이상)', () => {
    expect(SUBWAY_STATIONS.length).toBeGreaterThan(500);
  });

  test('모든 좌표가 한국 bbox 안', () => {
    for (const s of SUBWAY_STATIONS) {
      expect(s.lat).toBeGreaterThanOrEqual(KOREA_BBOX.latMin);
      expect(s.lat).toBeLessThanOrEqual(KOREA_BBOX.latMax);
      expect(s.lng).toBeGreaterThanOrEqual(KOREA_BBOX.lngMin);
      expect(s.lng).toBeLessThanOrEqual(KOREA_BBOX.lngMax);
    }
  });

  test('모든 역명은 비어있지 않고 "역"으로 끝난다', () => {
    for (const s of SUBWAY_STATIONS) {
      expect(s.name.length).toBeGreaterThan(1);
      expect(s.name.endsWith('역')).toBe(true);
    }
  });

  test('이름+좌표 완전 중복 없음 (환승역 dedup 검증)', () => {
    const keys = SUBWAY_STATIONS.map((s) => `${s.name}|${s.lat.toFixed(4)},${s.lng.toFixed(4)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
