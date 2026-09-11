// S-MAP M3 — 출발지 입력 (자동완성 = 장소검색 재사용 + 최근 2개 칩).

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/design/theme';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import type { OriginPoint } from '@/lib/map/midpoint';

import { OriginInput } from './OriginInput';

// useMapSearch 는 controllable mock — 각 테스트에서 mockState 주입.
type SearchState = {
  query: string;
  setQuery: (q: string) => void;
  results: PlaceSearchResult[];
  isLoading: boolean;
  error: string | null;
};
let mockState: SearchState;
const mockSetQuery = jest.fn();
jest.mock('@/lib/places/useMapSearch', () => ({
  useMapSearch: () => mockState,
}));

const sampleResult: PlaceSearchResult = {
  providerPlaceId: 'naver:강남역:37.4979:127.0276',
  name: '강남역',
  category: '지하철역',
  address: '서울 강남구',
  lat: 37.4979,
  lng: 127.0276,
  phone: null,
  source: 'naver',
};

const recents: OriginPoint[] = [
  { label: '홍대입구역', coord: { lat: 37.5572, lng: 126.9245 } },
  { label: '건대입구역', coord: { lat: 37.5403, lng: 127.0703 } },
];

describe('OriginInput', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetQuery.mockReset();
    mockState = {
      query: '',
      setQuery: mockSetQuery,
      results: [],
      isLoading: false,
      error: null,
    };
  });

  test('입력 → setQuery 호출', () => {
    const { getByTestId } = render(<OriginInput recentOrigins={[]} onSelect={jest.fn()} />, {
      wrapper,
    });
    fireEvent.changeText(getByTestId('origin-search-input'), '강남');
    expect(mockSetQuery).toHaveBeenCalledWith('강남');
  });

  test('검색 결과 tap → onSelect({label, coord})', () => {
    mockState.results = [sampleResult];
    mockState.query = '강남';
    const onSelect = jest.fn();
    const { getByTestId } = render(<OriginInput recentOrigins={[]} onSelect={onSelect} />, {
      wrapper,
    });
    fireEvent.press(getByTestId('origin-result-0'));
    expect(onSelect).toHaveBeenCalledWith({
      label: '강남역',
      coord: { lat: 37.4979, lng: 127.0276 },
    });
  });

  test('최근 출발지 칩 2개 렌더 + tap → onSelect(origin)', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<OriginInput recentOrigins={recents} onSelect={onSelect} />, {
      wrapper,
    });
    expect(getByTestId('recent-origin-chip-0')).toBeTruthy();
    expect(getByTestId('recent-origin-chip-1')).toBeTruthy();
    fireEvent.press(getByTestId('recent-origin-chip-0'));
    expect(onSelect).toHaveBeenCalledWith(recents[0]);
  });

  test('최근 출발지 없음 → 칩 미노출', () => {
    const { queryByTestId } = render(<OriginInput recentOrigins={[]} onSelect={jest.fn()} />, {
      wrapper,
    });
    expect(queryByTestId('recent-origin-chip-0')).toBeNull();
  });
});
