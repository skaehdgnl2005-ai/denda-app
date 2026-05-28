// viewportCache.ts — 지도 viewport 격자 캐싱 (D26).
//
// D26: Viewport 이동 시 300-500ms debounce + 5분 viewport 격자 캐싱(client).
// Quota 한도 도달 시 "잠시 후 다시" + 캐시 결과 fallback.
//
// 본 모듈은 캐시 자료구조 + 격자 키 생성만 담당 (순수). debounce는 useMapSearch가
// createDebouncer로 조합, rate-limit fallback도 hook 레벨. 격자 quantize로 작은
// viewport 이동은 같은 캐시 키 → 불필요한 검색 호출 제거(quota 보호).

import type { Wgs84Coord } from '@/lib/coords/normalize';

/** 5분 — D26 viewport 격자 캐시 TTL. */
export const VIEWPORT_CACHE_TTL_MS = 5 * 60 * 1000;

/** 기본 격자 크기(도). ~0.01° ≈ 위도 1.1km / 경도(서울 위도) 0.9km. */
export const DEFAULT_GRID_DEG = 0.01;

export interface ViewportBounds {
  sw: Wgs84Coord; // 남서 (min lat, min lng)
  ne: Wgs84Coord; // 북동 (max lat, max lng)
}

/** viewport 중심 좌표. */
export function viewportCenter(b: ViewportBounds): Wgs84Coord {
  return {
    lat: (b.sw.lat + b.ne.lat) / 2,
    lng: (b.sw.lng + b.ne.lng) / 2,
  };
}

/** 좌표를 격자 셀 인덱스로 quantize한 키. 같은 셀 = 같은 키. */
export function gridCellKey(coord: Wgs84Coord, gridDeg: number): string {
  const row = Math.floor(coord.lat / gridDeg);
  const col = Math.floor(coord.lng / gridDeg);
  return `${row}:${col}`;
}

/** viewport 캐시 키 = 중심 좌표의 격자 셀. 작은 이동은 같은 키 → cache hit. */
export function viewportCacheKey(b: ViewportBounds, gridDeg: number = DEFAULT_GRID_DEG): string {
  return gridCellKey(viewportCenter(b), gridDeg);
}

export interface ViewportCacheOptions {
  /** TTL(ms). 기본 5분. */
  ttlMs?: number;
  /** 현재 시각 ms (DI — 테스트/monotonic clock). 기본 Date.now. */
  now?: () => number;
  /** 최대 항목 수 초과 시 가장 오래된 항목 evict. 기본 64. */
  maxEntries?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * TTL + 용량 제한이 있는 viewport 결과 캐시.
 * 격자 키(viewportCacheKey)로 검색 결과(PlaceSearchResult[] 등)를 5분간 보관.
 */
export class ViewportCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly maxEntries: number;

  constructor(opts: ViewportCacheOptions = {}) {
    this.ttlMs = opts.ttlMs ?? VIEWPORT_CACHE_TTL_MS;
    this.now = opts.now ?? Date.now;
    this.maxEntries = opts.maxEntries ?? 64;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (this.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set(key: string, value: T): void {
    // 재 set 시 recency 갱신을 위해 삭제 후 재삽입 (Map 삽입 순서 = eviction 순서).
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /** 만료된 항목 제거. */
  prune(): void {
    const t = this.now();
    for (const [key, entry] of this.store) {
      if (t >= entry.expiresAt) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}
