// W1-9 — 지도 탭 검색 화면.
// 죽은 카드 → 탭 가능 + 상세 시트(카톡 공유) · 첫 로드만 Skeleton(이전 결과 유지) ·
// 에러 재시도 CTA + 이전 결과 보존 · 빈 상태 §11.2 · 검색 clear(X) + returnKeyType.

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MapScreen from '../../../app/(tabs)/map';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import type { UseMapSearchState } from '@/lib/places/useMapSearch';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockSetQuery = jest.fn();
const mockRetry = jest.fn();
let mockState: UseMapSearchState;

jest.mock('@/lib/places/useMapSearch', () => ({
  useMapSearch: () => mockState,
}));

const mockSharePlace = jest.fn();
jest.mock('@/lib/share/kakaoShare', () => ({
  sharePlaceToKakao: (...args: unknown[]) => mockSharePlace(...args),
  createNativeShareApi: () => ({ share: jest.fn() }),
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
    retry: mockRetry,
    ...over,
  };
}

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <ToastProvider>
          <MapScreen />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('MapScreen (W1-9 상태 디자인)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setState({});
    mockSharePlace.mockResolvedValue({ shared: true });
  });

  it('지도 타이틀 + 검색 입력창 + 준비 중 안내 렌더', () => {
    const { getByText, getByTestId } = renderScreen();
    expect(getByText('지도')).toBeTruthy();
    expect(getByTestId('map-search-input')).toBeTruthy();
    expect(getByTestId('map-pending-notice')).toBeTruthy();
  });

  it('검색 입력 → setQuery 호출 + returnKeyType=search', () => {
    const { getByTestId } = renderScreen();
    const input = getByTestId('map-search-input');
    expect(input.props.returnKeyType).toBe('search');
    fireEvent.changeText(input, '강남 카페');
    expect(mockSetQuery).toHaveBeenCalledWith('강남 카페');
  });

  it('첫 로드(결과 없음+로딩) → Skeleton 표시 (ActivityIndicator 아님)', () => {
    setState({ query: '강남', isLoading: true, results: [] });
    const { getByTestId, queryByTestId } = renderScreen();
    expect(getByTestId('map-search-skeleton')).toBeTruthy();
    expect(queryByTestId('map-search-loading')).toBeNull();
  });

  it('로딩 중이라도 이전 결과가 있으면 결과 유지 (점멸 없음)', () => {
    setState({ query: '강남', isLoading: true, results: [place('스타벅스 강남', '카페', null)] });
    const { getByText, queryByTestId } = renderScreen();
    expect(getByText('스타벅스 강남')).toBeTruthy();
    expect(queryByTestId('map-search-skeleton')).toBeNull();
  });

  it('에러 + 이전 결과 → 결과 유지 + 재시도 배너, 재시도 press → retry()', () => {
    setState({
      query: '강남',
      error: '호출 한도를 초과했어요.',
      results: [place('한신포차', '한식', null)],
    });
    const { getByText, getByTestId } = renderScreen();
    expect(getByText('한신포차')).toBeTruthy();
    fireEvent.press(getByTestId('map-error-retry'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('에러 + 결과 없음 → EmptyState error + 재시도 CTA → retry()', () => {
    setState({ query: '강남', error: '연결이 불안정해요.', results: [] });
    const { getByTestId } = renderScreen();
    expect(getByTestId('map-error')).toBeTruthy();
    fireEvent.press(getByTestId('map-error-cta'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('results → 장소 이름·카테고리 카드 렌더', () => {
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

  it('카드 탭 → 상세 시트 노출', () => {
    setState({ query: '강남', results: [place('스타벅스 강남', '카페', '서울 강남구')] });
    const { getByLabelText, getByTestId } = renderScreen();
    fireEvent.press(getByLabelText('스타벅스 강남 상세 보기'));
    expect(getByTestId('map-detail-sheet')).toBeTruthy();
  });

  it('상세 시트 "카톡으로 공유" → sharePlaceToKakao(groupName 없음) 호출', async () => {
    setState({ query: '강남', results: [place('스타벅스 강남', '카페', '서울 강남구')] });
    const { getByLabelText, getByTestId } = renderScreen();
    fireEvent.press(getByLabelText('스타벅스 강남 상세 보기'));
    fireEvent.press(getByTestId('map-detail-confirm'));
    await waitFor(() => expect(mockSharePlace).toHaveBeenCalledTimes(1));
    expect(mockSharePlace.mock.calls[0][0]).toEqual(
      expect.objectContaining({ groupName: '', placeName: '스타벅스 강남' }),
    );
  });

  it('검색어 입력 후 결과 없음 → 빈 상태 안내(§11.2)', () => {
    setState({ query: '없는장소', results: [] });
    const { getByTestId } = renderScreen();
    expect(getByTestId('map-empty-state')).toBeTruthy();
  });

  it('초기(검색어 없음) → 초기 안내 상태', () => {
    setState({ query: '' });
    const { getByTestId } = renderScreen();
    expect(getByTestId('map-initial-state')).toBeTruthy();
  });

  it('검색어 있으면 clear(X) 버튼 → press 시 setQuery("")', () => {
    setState({ query: '강남' });
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('map-search-clear'));
    expect(mockSetQuery).toHaveBeenCalledWith('');
  });

  it('검색어 없으면 clear(X) 버튼 미표시', () => {
    setState({ query: '' });
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('map-search-clear')).toBeNull();
  });
});
