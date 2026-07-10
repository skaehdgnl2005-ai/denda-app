// S-MAP M3 — 중간지점 화면: 출발지 추가 → 중간점 계산 → 근처 추천 → 확정(M2 재사용).

import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MidpointScreen from '../../../app/group/[id]/midpoint';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'g-1' }),
}));

// 추천 검색용 useMapSearch — controllable.
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

// OriginInput stub — 두 출발지(A 강남 / B 홍대)를 더하는 버튼 노출.
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock 팩토리 hoisting */
jest.mock('@/components/map/OriginInput', () => {
  const ReactMod = require('react');
  const { Pressable } = require('react-native');
  const A = { label: '강남역', coord: { lat: 37.4979, lng: 127.0276 } };
  const B = { label: '홍대입구역', coord: { lat: 37.5572, lng: 126.9245 } };
  return {
    OriginInput: ({ onSelect }: { onSelect: (o: unknown) => void }) =>
      ReactMod.createElement(
        ReactMod.Fragment,
        null,
        ReactMod.createElement(Pressable, { testID: 'add-origin-a', onPress: () => onSelect(A) }),
        ReactMod.createElement(Pressable, { testID: 'add-origin-b', onPress: () => onSelect(B) }),
      ),
  };
});

// MapHost stub — fallback(추천 리스트) 렌더 + place 마커 onPress(actionId) 노출.
jest.mock('@/components/map/MapHost', () => {
  const ReactMod = require('react');
  const { Pressable } = require('react-native');
  return {
    MapHost: ({
      scene,
      onMarkerPress,
      fallback,
    }: {
      scene: { markers: { id: string; actionId?: string }[] };
      onMarkerPress?: (actionId: string) => void;
      fallback?: React.ReactNode;
    }) =>
      ReactMod.createElement(
        ReactMod.Fragment,
        null,
        fallback,
        scene.markers
          .filter((m) => m.actionId !== undefined)
          .map((m) =>
            ReactMod.createElement(Pressable, {
              key: m.id,
              testID: `marker-${m.actionId}`,
              onPress: () => m.actionId !== undefined && onMarkerPress?.(m.actionId),
            }),
          ),
      ),
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const mockLoadRecent = jest.fn();
const mockSaveRecent = jest.fn();
jest.mock('@/lib/map/recentOrigins', () => ({
  ...jest.requireActual('@/lib/map/recentOrigins'),
  loadRecentOrigins: (...a: unknown[]) => mockLoadRecent(...a),
  saveRecentOrigin: (...a: unknown[]) => mockSaveRecent(...a),
}));

const mockPersistPlace = jest.fn();
jest.mock('@/lib/places/persist', () => ({
  persistPlace: (...args: unknown[]) => mockPersistPlace(...args),
}));
const mockSetConfirmedPlace = jest.fn();
jest.mock('@/lib/groups/setConfirmedPlace', () => ({
  setConfirmedPlace: (...args: unknown[]) => mockSetConfirmedPlace(...args),
}));

// 중간점(강남·홍대) ≈ (37.52755, 126.97605).
const nearResult: PlaceSearchResult = {
  providerPlaceId: 'naver:가까운식당:37.527:126.976',
  name: '가까운식당',
  category: '한식',
  address: '서울 마포구',
  lat: 37.527,
  lng: 126.976,
  phone: null,
  source: 'naver',
};
const farResult: PlaceSearchResult = {
  providerPlaceId: 'naver:먼식당:37.0:127.5',
  name: '먼식당',
  category: '한식',
  address: '경기',
  lat: 37.0,
  lng: 127.5,
  phone: null,
  source: 'naver',
};

describe('MidpointScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadRecent.mockResolvedValue([]);
    mockSaveRecent.mockResolvedValue([]);
    mockState = {
      query: '',
      setQuery: mockSetQuery,
      results: [],
      isLoading: false,
      error: null,
    };
  });

  test('출발지 2개 추가 → 중간지점 요약 노출', async () => {
    const { getByTestId } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
      fireEvent.press(getByTestId('add-origin-b'));
    });
    expect(getByTestId('midpoint-summary')).toBeTruthy();
  });

  test('출발지 추가 → saveRecentOrigin 호출', async () => {
    const { getByTestId } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
    });
    expect(mockSaveRecent).toHaveBeenCalled();
  });

  test('추천 결과는 중간지점에 가까운 순으로 정렬', async () => {
    mockState.results = [farResult, nearResult];
    mockState.query = '식당';
    const { getByTestId } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
      fireEvent.press(getByTestId('add-origin-b'));
    });
    // 가까운식당 이 reco-result-0 에 와야 함.
    expect(within(getByTestId('reco-result-0')).getByText('가까운식당')).toBeTruthy();
  });

  test('추천 결과 tap → ConfirmSheet 확정 → persist + setConfirmedPlace + place 라우트', async () => {
    mockState.results = [nearResult];
    mockState.query = '식당';
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);

    const { getByTestId } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
      fireEvent.press(getByTestId('add-origin-b'));
    });
    fireEvent.press(getByTestId('reco-result-0'));
    await act(async () => {
      fireEvent.press(getByTestId('mid-confirm-confirm'));
    });

    await waitFor(() => {
      expect(mockPersistPlace).toHaveBeenCalledWith(nearResult);
      expect(mockSetConfirmedPlace).toHaveBeenCalledWith('g-1', 'place-uuid');
      expect(mockReplace).toHaveBeenCalledWith('/group/g-1/place?placeId=place-uuid');
    });
  });

  test('지도 place 마커 onPress(actionId) → 리스트 탭과 동일 확정 (M2 통일)', async () => {
    mockState.results = [nearResult];
    mockState.query = '식당';
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);

    const { getByTestId } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
      fireEvent.press(getByTestId('add-origin-b'));
    });
    fireEvent.press(getByTestId(`marker-${nearResult.providerPlaceId}`));
    await act(async () => {
      fireEvent.press(getByTestId('mid-confirm-confirm'));
    });

    await waitFor(() => {
      expect(mockPersistPlace).toHaveBeenCalledWith(nearResult);
      expect(mockReplace).toHaveBeenCalledWith('/group/g-1/place?placeId=place-uuid');
    });
  });

  test('뒤로 가기 → router.back()', async () => {
    const { getByLabelText } = render(<MidpointScreen />, { wrapper });
    await act(async () => {}); // mount 시 loadRecentOrigins promise flush
    fireEvent.press(getByLabelText('뒤로 가기'));
    expect(mockBack).toHaveBeenCalled();
  });
});
