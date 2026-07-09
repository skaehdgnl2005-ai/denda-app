// useMapSearch.ts — 지도 장소 검색 데이터 hook (D26 debounce + 격자 캐시 조합).
//
// PlaceSearchProvider(기본 NaverSearchProvider) + ViewportCache(5분 TTL) + debounce(300-500ms)
// + 카테고리/반경 후필터(placeFilter)를 조합한 검색 컨트롤러. map.tsx가 소비.
//
// D26: viewport 이동/검색어 변경 → debounce → 캐시 hit면 provider 호출 skip(quota 보호),
// miss면 provider.search 호출 후 캐시. rate-limit/에러 시 한국어 메시지 + 이전 결과 유지(fallback).
//
// 네이티브 MapView(@mj-studio/react-native-naver-map) 렌더·마커는 EAS Build 운영 트랙.
// 본 hook은 검색 데이터만 제공 — 화면은 결과를 마커/리스트로 그린다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NaverSearchProvider } from './NaverSearchProvider';
import { applyPlaceFilters, type PlaceFilter } from './placeFilter';
import type { PlaceSearchProvider, PlaceSearchResult } from './PlaceSearchProvider';
import { ViewportCache } from './viewportCache';

/** 네이버 지역검색 display 최대 5 (API 한계). */
const DEFAULT_DISPLAY = 5;
/** D26 viewport debounce 기본값 (300-500ms 범위 중앙). */
const DEFAULT_DEBOUNCE_MS = 400;

let defaultProviderSingleton: PlaceSearchProvider | null = null;
function getDefaultProvider(): PlaceSearchProvider {
  if (defaultProviderSingleton === null) defaultProviderSingleton = new NaverSearchProvider();
  return defaultProviderSingleton;
}

export interface UseMapSearchOptions {
  /** 검색 provider (DI). 기본 NaverSearchProvider (S16 fallback). */
  provider?: PlaceSearchProvider;
  /** 결과 수. 기본 5 (네이버 한계). */
  display?: number;
  /** 입력 debounce (ms). 기본 400 (D26 300-500). */
  debounceMs?: number;
  /** 검색 최소 글자 수. 기본 1. */
  minQueryLength?: number;
  /** 카테고리/반경 후필터. */
  filter?: PlaceFilter;
  /** 결과 캐시 (DI). 기본 5분 TTL ViewportCache. */
  cache?: ViewportCache<PlaceSearchResult[]>;
  /** 초기 검색어. */
  initialQuery?: string;
}

export interface UseMapSearchState {
  query: string;
  setQuery: (q: string) => void;
  /** 필터 적용된 검색 결과. */
  results: PlaceSearchResult[];
  isLoading: boolean;
  /** 한국어 에러 메시지 (rate limit 등). */
  error: string | null;
  /** 에러 후 현재 query를 재검색 (캐시 miss면 provider 재호출). */
  retry: () => void;
}

export function useMapSearch(options: UseMapSearchOptions = {}): UseMapSearchState {
  const {
    display = DEFAULT_DISPLAY,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    minQueryLength = 1,
    filter,
    initialQuery = '',
  } = options;

  const provider = options.provider ?? getDefaultProvider();
  // 캐시 인스턴스는 mount 시 1회 확정 (DI 주입 또는 신규). render 중 ref 접근 회피.
  const [cache] = useState<ViewportCache<PlaceSearchResult[]>>(
    () => options.cache ?? new ViewportCache<PlaceSearchResult[]>(),
  );

  const [query, setQuery] = useState(initialQuery);
  const [rawResults, setRawResults] = useState<PlaceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // retry 시 effect를 다시 돌려 현재 query를 재검색 (query 불변이라 nonce로 강제).
  const [retryNonce, setRetryNonce] = useState(0);
  const retry = useCallback(() => setRetryNonce((n) => n + 1), []);

  // 최신 검색만 state 반영 (out-of-order 응답 무시).
  const reqIdRef = useRef(0);

  useEffect(() => {
    // 모든 state 변경은 debounce 콜백(비동기) 안에서 — effect body 동기 setState 회피.
    const timer = setTimeout(() => {
      const q = query.trim();
      if (q.length < minQueryLength) {
        reqIdRef.current++; // pending 응답 무효화
        setRawResults([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      const key = `${q}|${display}`;
      const cached = cache.get(key);
      if (cached !== undefined) {
        setRawResults(cached);
        setError(null);
        setIsLoading(false);
        return;
      }

      const myReq = ++reqIdRef.current;
      setIsLoading(true);
      setError(null);
      provider
        .search({ query: q, display })
        .then((res) => {
          if (myReq !== reqIdRef.current) return;
          cache.set(key, res);
          setRawResults(res);
          setIsLoading(false);
        })
        .catch((e: unknown) => {
          if (myReq !== reqIdRef.current) return;
          // D26: 에러 시 이전 결과 유지 + 한국어 메시지 (rawResults 건드리지 않음).
          setError(
            e instanceof Error ? e.message : '장소를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
          );
          setIsLoading(false);
        });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, display, debounceMs, minQueryLength, provider, cache, retryNonce]);

  const results = useMemo(() => applyPlaceFilters(rawResults, filter ?? {}), [rawResults, filter]);

  return { query, setQuery, results, isLoading, error, retry };
}
