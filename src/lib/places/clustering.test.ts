import { clusterByGrid, type ClusterPoint } from './clustering';

const p = (id: string, lat: number, lng: number): ClusterPoint => ({ id, coord: { lat, lng } });

describe('clusterByGrid', () => {
  it('빈 입력 → 빈 배열', () => {
    expect(clusterByGrid([], 0.01)).toEqual([]);
  });

  it('같은 격자 셀의 점들 → 1 클러스터로 병합 (count 누적)', () => {
    const out = clusterByGrid([p('a', 37.5651, 126.99), p('b', 37.5659, 126.991)], 0.01);
    expect(out).toHaveLength(1);
    expect(out[0]?.count).toBe(2);
    expect([...(out[0]?.pointIds ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('다른 격자 셀의 점들 → 별도 클러스터', () => {
    const out = clusterByGrid([p('a', 37.561, 126.99), p('b', 37.575, 126.99)], 0.01);
    expect(out).toHaveLength(2);
    expect(out.every((c) => c.count === 1)).toBe(true);
  });

  it('클러스터 center = 멤버 좌표 centroid', () => {
    const out = clusterByGrid([p('a', 37.56, 127.0), p('b', 37.562, 127.004)], 0.01);
    expect(out).toHaveLength(1);
    expect(out[0]?.center.lat).toBeCloseTo(37.561, 6);
    expect(out[0]?.center.lng).toBeCloseTo(127.002, 6);
  });

  it('단일 점 클러스터 center = 그 점', () => {
    const out = clusterByGrid([p('a', 37.5, 127.0)], 0.01);
    expect(out[0]?.center).toEqual({ lat: 37.5, lng: 127.0 });
    expect(out[0]?.count).toBe(1);
  });

  it('결정적 출력 — 같은 입력은 항상 같은 순서/키', () => {
    const pts = [p('a', 37.561, 126.99), p('b', 37.575, 126.99), p('c', 37.5615, 126.991)];
    const r1 = clusterByGrid(pts, 0.01);
    const r2 = clusterByGrid(pts, 0.01);
    expect(r1).toEqual(r2);
  });

  it('cellSizeDeg <= 0 → 각 점이 독립 클러스터 (병합 안 함)', () => {
    const out = clusterByGrid([p('a', 37.5, 127.0), p('b', 37.5, 127.0)], 0);
    expect(out).toHaveLength(2);
  });

  it('각 클러스터는 안정적인 key를 가진다', () => {
    const out = clusterByGrid([p('a', 37.561, 126.99)], 0.01);
    expect(typeof out[0]?.key).toBe('string');
    expect((out[0]?.key ?? '').length).toBeGreaterThan(0);
  });
});
