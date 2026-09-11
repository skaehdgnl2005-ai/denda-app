// clustering.ts — 격자 기반 마커 클러스터링 (Layer 1 fallback).
//
// ARCHITECTURE §3.3: "클러스터링 — 네이버 SDK API 확인 → 없으면 react-native-supercluster
// Layer 1". 본 모듈은 네이티브 SDK 클러스터링이 없을 때 쓰는 순수 격자 클러스터링.
// 같은 격자 셀의 마커를 하나로 묶어 count 배지로 표시(EAS Build 후 MapView wire).
//
// zoom level → cellSizeDeg는 화면(map.tsx)에서 결정해 주입 (zoom out 클수록 cell 큼).

import type { Wgs84Coord } from '@/lib/coords/normalize';

import { gridCellKey } from './viewportCache';

export interface ClusterPoint {
  id: string;
  coord: Wgs84Coord;
}

export interface Cluster {
  /** 격자 셀 키 (또는 cellSize<=0일 때 point id). React key·dedup용. */
  key: string;
  /** 멤버 좌표 centroid. */
  center: Wgs84Coord;
  /** 멤버 수. */
  count: number;
  /** 멤버 point id (입력 순서 보존). */
  pointIds: string[];
}

interface Bucket {
  key: string;
  sumLat: number;
  sumLng: number;
  pointIds: string[];
}

/**
 * 격자 셀 단위로 점을 클러스터링. center는 멤버 좌표 centroid.
 * cellSizeDeg <= 0이면 병합하지 않고 각 점을 독립 클러스터로 반환.
 * 출력은 첫 등장 순서로 결정적(deterministic).
 */
export function clusterByGrid(points: ClusterPoint[], cellSizeDeg: number): Cluster[] {
  const order: string[] = [];
  const buckets = new Map<string, Bucket>();

  points.forEach((pt, idx) => {
    const key = cellSizeDeg > 0 ? gridCellKey(pt.coord, cellSizeDeg) : `pt:${idx}:${pt.id}`;
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      bucket = { key, sumLat: 0, sumLng: 0, pointIds: [] };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.sumLat += pt.coord.lat;
    bucket.sumLng += pt.coord.lng;
    bucket.pointIds.push(pt.id);
  });

  return order.map((key) => {
    const b = buckets.get(key) as Bucket;
    const count = b.pointIds.length;
    return {
      key,
      center: { lat: b.sumLat / count, lng: b.sumLng / count },
      count,
      pointIds: b.pointIds,
    };
  });
}
