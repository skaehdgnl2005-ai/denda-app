import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import MapScreen from '../../../app/(tabs)/map';
import { ThemeProvider } from '@/design/theme';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import type { UseMapSearchState } from '@/lib/places/useMapSearch';

const mockSetQuery = jest.fn();
let mockState: UseMapSearchState;

jest.mock('@/lib/places/useMapSearch', () => ({
  useMapSearch: () => mockState,
}));

function place(name: string, category: string | null, address: string | null): PlaceSearchResult {
  return {
    providerPlaceId: `naver:${name}`,
    name,
    category,
    address,
    lat: 37.5,
    lng: 127.0,
    phone: null,
    source: 'naver',
  };
}

function setState(over: Partial<UseMapSearchState>): void {
  mockState = {
    query: '',
    setQuery: mockSetQuery,
    results: [],
    isLoading: false,
    error: null,
    ...over,
  };
}

describe('MapScreen (지도 탭 — 검색 데이터 wire)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setState({});
  });

  function renderScreen() {
    return render(
      <ThemeProvider>
        <MapScreen />
      </ThemeProvider>,
    );
  }

  it('지도 타이틀 + 검색 입력창 렌더', () => {
    const { getByText, getByTestId } = renderScreen();
    expect(getByText('지도')).toBeTruthy();
    expect(getByTestId('map-search-input')).toBeTruthy();
  });

  it('검색 입력 → setQuery 호출', () => {
    const { getByTestId } = renderScreen();
    fireEvent.changeText(getByTestId('map-search-input'), '강남 카페');
    expect(mockSetQuery).toHaveBeenCalledWith('강남 카페');
  });

  it('네이티브 지도 준비 중 안내(info) 노출', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('map-pending-notice')).toBeTruthy();
  });

  it('isLoading → 로딩 인디케이터', () => {
    setState({ query: '강남', isLoading: true });
    const { getByTestId } = renderScreen();
    expect(getByTestId('map-search-loading')).toBeTruthy();
  });

  it('error → 한국어 에러 메시지 노출', () => {
    setState({ query: '강남', error: '네이버 지역검색 호출 한도를 초과했어요.' });
    const { getByText } = renderScreen();
    expect(getByText(/한도를 초과/)).toBeTruthy();
  });

  it('results → 장소 이름·카테고리 리스트 렌더', () => {
    setState({
      query: '강남',
      results: [
        place('스타벅스 강남', '카페', '서울 강남구'),
        place('한신포차', '한식', '서울 강남구'),
      ],
    });
    const { getByText } = renderScreen();
    expect(getByText('스타벅스 강남')).toBeTruthy();
    expect(getByText('한신포차')).toBeTruthy();
  });

  it('검색어 입력 후 결과 없음 → 빈 상태 안내', () => {
    setState({ query: '없는장소', results: [] });
    const { getByTestId } = renderScreen();
    expect(getByTestId('map-empty-state')).toBeTruthy();
  });
});
