// S-MAP M3 — 중간지점 순수 좌표 로직 테스트 (haversine 재사용, 키 0).

import { haversineMeters } from '@/lib/coords/distance';
import type { Wgs84Coord } from '@/lib/coords/normalize';

import {
  computeMidpoint,
  maxDistanceMeters,
  sortByDistanceTo,
  toMidpointScene,
  type OriginPoint,
} from './midpoint';

const GANGNAM: Wgs84Coord = { lat: 37.4979, lng: 127.0276 };
const HONGDAE: Wgs84Coord = { lat: 37.5572, lng: 126.9245 };

describe('computeMidpoint', () => {
  test('두 좌표 → 산술 중심', () => {
    const mid = computeMidpoint([GANGNAM, HONGDAE]);
    expect(mid.lat).toBeCloseTo((37.4979 + 37.5572) / 2, 6);
    expect(mid.lng).toBeCloseTo((127.0276 + 126.9245) / 2, 6);
  });

  test('단일 좌표 → 자기 자신', () => {
    expect(computeMidpoint([GANGNAM])).toEqual(GANGNAM);
  });

  test('빈 배열 → 한국어 throw', () => {
    expect(() => computeMidpoint([])).toThrow(/출발지/);
  });

  test('결과는 WGS84 유효 범위 (normalize 통과)', () => {
    const mid = computeMidpoint([GANGNAM, HONGDAE]);
    expect(mid.lat).toBeGreaterThanOrEqual(-90);
    expect(mid.lat).toBeLessThanOrEqual(90);
    expect(mid.lng).toBeGreaterThanOrEqual(-180);
    expect(mid.lng).toBeLessThanOrEqual(180);
  });
});

describe('maxDistanceMeters', () => {
  test('빈 배열 → 0', () => {
    expect(maxDistanceMeters(GANGNAM, [])).toBe(0);
  });

  test('가장 먼 좌표까지의 haversine 거리', () => {
    const mid = computeMidpoint([GANGNAM, HONGDAE]);
    const expected = Math.max(haversineMeters(mid, GANGNAM), haversineMeters(mid, HONGDAE));
    expect(maxDistanceMeters(mid, [GANGNAM, HONGDAE])).toBeCloseTo(expected, 3);
  });
});

describe('sortByDistanceTo', () => {
  const center: Wgs84Coord = { lat: 37.5275, lng: 126.9761 };
  const near = { id: 'near', lat: 37.527, lng: 126.976 };
  const far = { id: 'far', lat: 37.0, lng: 127.5 };

  test('가까운 순으로 정렬 (오름차순)', () => {
    const sorted = sortByDistanceTo([far, near], center);
    expect(sorted.map((i) => i.id)).toEqual(['near', 'far']);
  });

  test('원본 배열을 변형하지 않음 (새 배열 반환)', () => {
    const input = [far, near];
    const sorted = sortByDistanceTo(input, center);
    expect(input).toEqual([far, near]);
    expect(sorted).not.toBe(input);
  });
});

describe('toMidpointScene', () => {
  const origins: OriginPoint[] = [
    { label: '강남역', coord: GANGNAM },
    { label: '홍대입구역', coord: HONGDAE },
  ];

  test('멤버 마커 + 중간지점 마커 (mode=midpoint, 폴리라인 0)', () => {
    const mid = computeMidpoint(origins.map((o) => o.coord));
    const scene = toMidpointScene(origins, mid);

    expect(scene.mode).toBe('midpoint');
    expect(scene.polylines).toEqual([]);

    const members = scene.markers.filter((m) => m.kind === 'member');
    expect(members).toHaveLength(2);
    expect(members.map((m) => m.label)).toEqual(['강남역', '홍대입구역']);

    const midMarkers = scene.markers.filter((m) => m.kind === 'midpoint');
    expect(midMarkers).toHaveLength(1);
    expect(midMarkers[0]?.emphasized).toBe(true);
    expect(midMarkers[0]?.label).toBe('중간지점');
    expect(midMarkers[0]?.coord).toEqual(mid);
  });

  test('midpoint=null → 멤버 마커만, 중간지점 마커 없음', () => {
    const scene = toMidpointScene(origins, null);
    expect(scene.markers.every((m) => m.kind === 'member')).toBe(true);
    expect(scene.markers).toHaveLength(2);
  });

  test('빈 origins + null → 마커 0', () => {
    expect(toMidpointScene([], null).markers).toEqual([]);
  });

  test('midpointLabel 주입 시 midpoint 마커 라벨이 역명으로 대체된다 (M5 역 스냅)', () => {
    const scene = toMidpointScene([], { lat: 37.5432, lng: 126.9512 }, '공덕역');
    const mid = scene.markers.find((m) => m.kind === 'midpoint');
    expect(mid?.label).toBe('공덕역');
    expect(mid?.emphasized).toBe(true);
  });

  test('midpointLabel 생략 시 기본 라벨 "중간지점" (하위호환)', () => {
    const scene = toMidpointScene([], { lat: 37.5432, lng: 126.9512 });
    expect(scene.markers.find((m) => m.kind === 'midpoint')?.label).toBe('중간지점');
  });
});
