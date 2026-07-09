import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useMapSearch } from './useMapSearch';
import { ViewportCache } from './viewportCache';
import type { PlaceSearchProvider, PlaceSearchResult } from './PlaceSearchProvider';

// NaverSearchProvider 기본 fallback이 import하는 supabase client 격리.
jest.mock('@/lib/supabase/client', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

function result(id: string, lat: number, lng: number, category: string | null): PlaceSearchResult {
  return {
    providerPlaceId: id,
    name: id,
    category,
    address: null,
    lat,
    lng,
    phone: null,
    source: 'naver',
  };
}

function makeProvider(): PlaceSearchProvider & { search: jest.Mock } {
  return { source: 'naver', search: jest.fn() };
}

const CAFE = result('카페', 37.5, 127.0, '카페');
const KOREAN = result('한식', 37.6, 127.0, '한식');

describe('useMapSearch', () => {
  it('query가 minQueryLength 미만 → provider 호출 안 함, results 빈 배열', async () => {
    const provider = makeProvider();
    const { result: hook } = renderHook(() =>
      useMapSearch({ provider, debounceMs: 20, minQueryLength: 2 }),
    );

    act(() => hook.current.setQuery('a'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(provider.search).not.toHaveBeenCalled();
    expect(hook.current.results).toEqual([]);
  });

  it('query 입력 → debounce 후 provider.search 호출 + results 반영', async () => {
    const provider = makeProvider();
    provider.search.mockResolvedValue([CAFE, KOREAN]);

    const { result: hook } = renderHook(() =>
      useMapSearch({ provider, debounceMs: 20, display: 5 }),
    );
    act(() => hook.current.setQuery('강남'));

    await waitFor(() => expect(hook.current.results).toHaveLength(2));
    expect(provider.search).toHaveBeenCalledWith({ query: '강남', display: 5 });
  });

  it('빠른 연속 입력 → 마지막 query만 검색 (debounce coalesce)', async () => {
    const provider = makeProvider();
    provider.search.mockResolvedValue([CAFE]);

    const { result: hook } = renderHook(() => useMapSearch({ provider, debounceMs: 30 }));
    act(() => {
      hook.current.setQuery('강');
      hook.current.setQuery('강남');
      hook.current.setQuery('강남역');
    });

    await waitFor(() => expect(provider.search).toHaveBeenCalledTimes(1));
    expect(provider.search).toHaveBeenCalledWith(expect.objectContaining({ query: '강남역' }));
  });

  it('cache hit → 같은 query 재검색 시 provider 재호출 0 (5분 격자 캐시)', async () => {
    const provider = makeProvider();
    provider.search.mockResolvedValue([CAFE]);
    const cache = new ViewportCache<PlaceSearchResult[]>();

    const { result: hook } = renderHook(() => useMapSearch({ provider, debounceMs: 20, cache }));

    act(() => hook.current.setQuery('강남'));
    await waitFor(() => expect(provider.search).toHaveBeenCalledTimes(1));

    act(() => hook.current.setQuery(''));
    await waitFor(() => expect(hook.current.results).toHaveLength(0));

    act(() => hook.current.setQuery('강남'));
    await waitFor(() => expect(hook.current.results).toHaveLength(1));
    expect(provider.search).toHaveBeenCalledTimes(1); // 캐시 사용 — 재호출 없음
  });

  it('provider error → 큐레이션 한국어 메시지(raw 비노출) + 이전 results 유지 (D26 fallback)', async () => {
    const provider = makeProvider();
    provider.search.mockResolvedValueOnce([CAFE]);
    // DI provider가 raw/영문 메시지를 throw해도 사용자에겐 큐레이션 카피만 노출돼야 한다.
    provider.search.mockRejectedValueOnce(new Error('column "xyz" PGRST999 raw'));

    const { result: hook } = renderHook(() => useMapSearch({ provider, debounceMs: 20 }));

    act(() => hook.current.setQuery('강남'));
    await waitFor(() => expect(hook.current.results).toHaveLength(1));

    act(() => hook.current.setQuery('판교'));
    await waitFor(() => expect(hook.current.error).not.toBeNull());
    expect(hook.current.error).not.toContain('PGRST999');
    expect(hook.current.error).not.toContain('column');
    expect(hook.current.results).toHaveLength(1); // 이전 결과 유지
  });

  it('캐시 hit 후 앞선 느린 요청이 최신(캐시) 결과를 stale로 덮어쓰지 않는다', async () => {
    const provider = makeProvider();
    const cache = new ViewportCache<PlaceSearchResult[]>();
    cache.set('판교|5', [KOREAN]); // 판교는 이미 캐시됨
    let resolveSlow: (v: PlaceSearchResult[]) => void = () => {};
    provider.search.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolveSlow = r;
        }),
    );

    const { result: hook } = renderHook(() => useMapSearch({ provider, debounceMs: 20, cache }));

    act(() => hook.current.setQuery('강남')); // miss → 느린 요청 in-flight
    await waitFor(() => expect(hook.current.isLoading).toBe(true));

    act(() => hook.current.setQuery('판교')); // 캐시 hit → 즉시 판교 표시
    await waitFor(() => expect(hook.current.results).toEqual([KOREAN]));

    act(() => resolveSlow([CAFE])); // 뒤늦게 resolve된 강남
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(hook.current.results).toEqual([KOREAN]); // stale 덮어쓰기 없음
  });

  it('filter(카테고리) 적용 → results는 필터된 결과', async () => {
    const provider = makeProvider();
    provider.search.mockResolvedValue([CAFE, KOREAN]);

    const { result: hook } = renderHook(() =>
      useMapSearch({ provider, debounceMs: 20, filter: { categories: ['카페'] } }),
    );

    act(() => hook.current.setQuery('강남'));
    await waitFor(() => expect(hook.current.results).toEqual([CAFE]));
  });

  it('retry() → error 후 같은 query 재검색 (provider 재호출 + error 해제)', async () => {
    const provider = makeProvider();
    provider.search.mockRejectedValueOnce(new Error('일시 오류'));
    provider.search.mockResolvedValueOnce([CAFE]);

    const { result: hook } = renderHook(() => useMapSearch({ provider, debounceMs: 20 }));

    act(() => hook.current.setQuery('강남'));
    await waitFor(() => expect(hook.current.error).not.toBeNull());

    act(() => hook.current.retry());
    await waitFor(() => expect(hook.current.results).toHaveLength(1));
    expect(hook.current.error).toBeNull();
    expect(provider.search).toHaveBeenCalledTimes(2);
  });

  it('검색 진행 중 isLoading true', async () => {
    const provider = makeProvider();
    provider.search.mockReturnValue(new Promise(() => {})); // 미해결

    const { result: hook } = renderHook(() => useMapSearch({ provider, debounceMs: 20 }));
    act(() => hook.current.setQuery('강남'));

    await waitFor(() => expect(hook.current.isLoading).toBe(true));
  });
});
