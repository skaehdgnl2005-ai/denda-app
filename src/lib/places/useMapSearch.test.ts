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

  it('provider error → 한국어 error set + 이전 results 유지 (D26 fallback)', async () => {
    const provider = makeProvider();
    provider.search.mockResolvedValueOnce([CAFE]);
    provider.search.mockRejectedValueOnce(new Error('네이버 지역검색 호출 한도를 초과했어요.'));

    const { result: hook } = renderHook(() => useMapSearch({ provider, debounceMs: 20 }));

    act(() => hook.current.setQuery('강남'));
    await waitFor(() => expect(hook.current.results).toHaveLength(1));

    act(() => hook.current.setQuery('판교'));
    await waitFor(() => expect(hook.current.error).toMatch(/한도/));
    expect(hook.current.results).toHaveLength(1); // 이전 결과 유지
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

  it('검색 진행 중 isLoading true', async () => {
    const provider = makeProvider();
    provider.search.mockReturnValue(new Promise(() => {})); // 미해결

    const { result: hook } = renderHook(() => useMapSearch({ provider, debounceMs: 20 }));
    act(() => hook.current.setQuery('강남'));

    await waitFor(() => expect(hook.current.isLoading).toBe(true));
  });
});
