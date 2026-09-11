import {
  DEFAULT_GRID_DEG,
  VIEWPORT_CACHE_TTL_MS,
  ViewportCache,
  gridCellKey,
  viewportCacheKey,
  viewportCenter,
  type ViewportBounds,
} from './viewportCache';

const SEOUL_VIEWPORT: ViewportBounds = {
  sw: { lat: 37.55, lng: 126.97 },
  ne: { lat: 37.58, lng: 127.01 },
};

describe('상수', () => {
  it('TTL = 5분', () => {
    expect(VIEWPORT_CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });
});

describe('viewportCenter', () => {
  it('sw/ne 중점 반환', () => {
    const c = viewportCenter(SEOUL_VIEWPORT);
    expect(c.lat).toBeCloseTo(37.565, 6);
    expect(c.lng).toBeCloseTo(126.99, 6);
  });
});

describe('gridCellKey — 격자 quantize', () => {
  it('같은 격자 셀 안의 좌표는 같은 키 (D26 viewport 격자 캐싱)', () => {
    const a = gridCellKey({ lat: 37.5651, lng: 126.9901 }, 0.01);
    const b = gridCellKey({ lat: 37.5659, lng: 126.9909 }, 0.01);
    expect(a).toBe(b);
  });

  it('다른 격자 셀은 다른 키', () => {
    const a = gridCellKey({ lat: 37.561, lng: 126.99 }, 0.01);
    const b = gridCellKey({ lat: 37.575, lng: 126.99 }, 0.01);
    expect(a).not.toBe(b);
  });

  it('음수 좌표도 floor 일관 (셀 경계 안정)', () => {
    expect(gridCellKey({ lat: -0.005, lng: -0.005 }, 0.01)).toBe(
      gridCellKey({ lat: -0.001, lng: -0.009 }, 0.01),
    );
  });
});

describe('viewportCacheKey', () => {
  it('중심이 같은 격자에 있으면 같은 캐시 키 (작은 이동은 cache hit)', () => {
    const a = viewportCacheKey(SEOUL_VIEWPORT, DEFAULT_GRID_DEG);
    const b = viewportCacheKey(
      { sw: { lat: 37.551, lng: 126.971 }, ne: { lat: 37.579, lng: 127.009 } },
      DEFAULT_GRID_DEG,
    );
    expect(a).toBe(b);
  });
});

describe('ViewportCache — 5분 TTL', () => {
  it('set 후 같은 키 get → 값 반환', () => {
    const cache = new ViewportCache<number[]>();
    cache.set('k', [1, 2, 3]);
    expect(cache.get('k')).toEqual([1, 2, 3]);
    expect(cache.has('k')).toBe(true);
  });

  it('미존재 키 → undefined', () => {
    expect(new ViewportCache<number[]>().get('none')).toBeUndefined();
  });

  it('TTL(5분) 경과 → 만료(undefined) + has false', () => {
    let t = 1000;
    const cache = new ViewportCache<string>({ now: () => t });
    cache.set('k', 'v');
    t += VIEWPORT_CACHE_TTL_MS - 1;
    expect(cache.get('k')).toBe('v'); // 아직 유효
    t += 2; // 5분 초과
    expect(cache.get('k')).toBeUndefined();
    expect(cache.has('k')).toBe(false);
  });

  it('custom ttlMs 적용', () => {
    let t = 0;
    const cache = new ViewportCache<string>({ now: () => t, ttlMs: 1000 });
    cache.set('k', 'v');
    t = 1001;
    expect(cache.get('k')).toBeUndefined();
  });

  it('maxEntries 초과 시 가장 오래된 항목 evict (LRU-ish FIFO)', () => {
    const cache = new ViewportCache<number>({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // a evict
    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.size).toBe(2);
  });

  it('같은 키 재 set → 값 갱신 (중복 entry 없음)', () => {
    const cache = new ViewportCache<number>();
    cache.set('k', 1);
    cache.set('k', 2);
    expect(cache.get('k')).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('prune → 만료 항목만 제거', () => {
    let t = 0;
    const cache = new ViewportCache<number>({ now: () => t, ttlMs: 100 });
    cache.set('old', 1);
    t = 50;
    cache.set('new', 2);
    t = 120; // old(0+100) 만료, new(50+100=150) 유효
    cache.prune();
    expect(cache.has('old')).toBe(false);
    expect(cache.has('new')).toBe(true);
  });
});
