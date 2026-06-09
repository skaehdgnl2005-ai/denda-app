// S-MAP M3 — 최근 출발지 온디바이스 로컬 저장 (상위 2개 MRU, 서버 미전송).

import type { OriginPoint } from './midpoint';
import {
  loadRecentOrigins,
  MAX_RECENT_ORIGINS,
  mergeRecent,
  RECENT_ORIGINS_KEY,
  saveRecentOrigin,
  type RecentOriginsStorage,
} from './recentOrigins';

function fakeStorage(initial: Record<string, string> = {}): RecentOriginsStorage & {
  _data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    _data: data,
    getItemAsync: (key) => Promise.resolve(data[key] ?? null),
    setItemAsync: (key, value) => {
      data[key] = value;
      return Promise.resolve();
    },
  };
}

const A: OriginPoint = { label: '강남역', coord: { lat: 37.4979, lng: 127.0276 } };
const B: OriginPoint = { label: '홍대입구역', coord: { lat: 37.5572, lng: 126.9245 } };
const C: OriginPoint = { label: '건대입구역', coord: { lat: 37.5403, lng: 127.0703 } };

describe('mergeRecent', () => {
  test('새 항목을 맨 앞에 + 상위 2개로 제한', () => {
    const merged = mergeRecent([A, B], C);
    expect(merged.map((o) => o.label)).toEqual(['건대입구역', '강남역']);
    expect(merged).toHaveLength(MAX_RECENT_ORIGINS);
  });

  test('같은 좌표 재선택 → 중복 제거하고 맨 앞으로', () => {
    const merged = mergeRecent([A, B], { ...A, label: '강남역 2번 출구' });
    expect(merged).toHaveLength(2);
    expect(merged[0]?.label).toBe('강남역 2번 출구');
    expect(merged.filter((o) => o.coord.lat === A.coord.lat)).toHaveLength(1);
  });
});

describe('loadRecentOrigins', () => {
  test('미저장 → 빈 배열', async () => {
    expect(await loadRecentOrigins(fakeStorage())).toEqual([]);
  });

  test('깨진 JSON → 빈 배열 (throw 안 함)', async () => {
    const storage = fakeStorage({ [RECENT_ORIGINS_KEY]: '{not-json' });
    expect(await loadRecentOrigins(storage)).toEqual([]);
  });

  test('잘못된 shape/좌표 항목 필터', async () => {
    const raw = JSON.stringify([
      A,
      { label: '깨진', coord: { lat: 999, lng: 0 } }, // 범위 밖
      { nope: true },
    ]);
    const storage = fakeStorage({ [RECENT_ORIGINS_KEY]: raw });
    const loaded = await loadRecentOrigins(storage);
    expect(loaded).toEqual([A]);
  });
});

describe('saveRecentOrigin', () => {
  test('저장 후 JSON 영속 + merged 반환', async () => {
    const storage = fakeStorage();
    const merged = await saveRecentOrigin(storage, A);
    expect(merged).toEqual([A]);
    expect(JSON.parse(storage._data[RECENT_ORIGINS_KEY] ?? '[]')).toEqual([A]);
  });

  test('3개 순차 저장 → 최신 2개만, 최신순', async () => {
    const storage = fakeStorage();
    await saveRecentOrigin(storage, A);
    await saveRecentOrigin(storage, B);
    const merged = await saveRecentOrigin(storage, C);
    expect(merged.map((o) => o.label)).toEqual(['건대입구역', '홍대입구역']);
  });
});
