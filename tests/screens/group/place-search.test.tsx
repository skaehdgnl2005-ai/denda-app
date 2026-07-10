import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PlaceSearchScreen from '../../../app/group/[id]/place-search';
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

// useMapSearch 는 컨트롤 가능한 mock 으로 — 각 테스트에서 setMockState 로 주입.
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

const mockPersistPlace = jest.fn();
jest.mock('@/lib/places/persist', () => ({
  persistPlace: (...args: unknown[]) => mockPersistPlace(...args),
}));

const mockSetConfirmedPlace = jest.fn();
jest.mock('@/lib/groups/setConfirmedPlace', () => ({
  setConfirmedPlace: (...args: unknown[]) => mockSetConfirmedPlace(...args),
}));

// 제휴 판정 seam — Phase 1+2는 stub(false). 테스트에서 capability 점등을 검증하기 위해 제어 가능 mock.
let mockIsPartner = false;
jest.mock('@/lib/places/partnership', () => ({
  isResultPartner: () => mockIsPartner,
}));

// MapHost stub — 점등(native) 없이 마커 onPress(actionId) 통일을 검증하기 위해 fallback(리스트)을
// 그대로 렌더하고, scene.markers마다 onMarkerPress를 호출하는 Pressable을 노출한다.
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock 팩토리 hoisting */
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
        scene.markers.map((m) =>
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

const sampleResult: PlaceSearchResult = {
  providerPlaceId: 'naver:한솥도시락 안암점:37.123:127.456',
  name: '한솥도시락 안암점',
  category: '한식',
  address: '서울 성북구 안암동',
  lat: 37.123,
  lng: 127.456,
  phone: null,
  source: 'naver',
};

describe('PlaceSearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetQuery.mockReset();
    mockPersistPlace.mockReset();
    mockSetConfirmedPlace.mockReset();
    mockIsPartner = false;
    mockState = {
      query: '',
      setQuery: mockSetQuery,
      results: [],
      isLoading: false,
      error: null,
    };
  });

  test('검색 input 입력 → setQuery 호출', () => {
    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.changeText(getByTestId('place-search-input'), '안암 한식');
    expect(mockSetQuery).toHaveBeenCalledWith('안암 한식');
  });

  test('결과 리스트 렌더 + 카드 tap → 확인 ConfirmSheet 표시 (장소명 포함)', () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    const { getByTestId, getByText } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.press(getByTestId('place-result-0'));
    // ConfirmSheet 타이틀(장소명 + "여기로 정할까요?")
    expect(getByText(/한솥도시락 안암점, 여기로 정할까요/)).toBeTruthy();
    expect(getByTestId('place-confirm-confirm')).toBeTruthy();
  });

  test('확정 → persistPlace + setConfirmedPlace + place 라우트 replace', async () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);

    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.press(getByTestId('place-result-0'));
    await act(async () => {
      fireEvent.press(getByTestId('place-confirm-confirm'));
    });

    await waitFor(() => {
      expect(mockPersistPlace).toHaveBeenCalledWith(sampleResult);
      expect(mockSetConfirmedPlace).toHaveBeenCalledWith('g-1', 'place-uuid');
      expect(mockReplace).toHaveBeenCalledWith('/group/g-1/place?placeId=place-uuid');
    });
  });

  test('취소(다음에 정할게요) → persistPlace 미호출, navigation 없음', () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.press(getByTestId('place-result-0'));
    fireEvent.press(getByTestId('place-confirm-cancel'));
    expect(mockPersistPlace).not.toHaveBeenCalled();
    expect(mockSetConfirmedPlace).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('persistPlace 실패 → 에러 토스트, setConfirmedPlace 미호출, navigation 없음', async () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    mockPersistPlace.mockRejectedValue(
      new Error('장소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.'),
    );

    const { getByTestId, findByText } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.press(getByTestId('place-result-0'));
    await act(async () => {
      fireEvent.press(getByTestId('place-confirm-confirm'));
    });

    // 에러가 시스템 Alert이 아닌 디자인 시스템 토스트로 표출
    expect(await findByText(/저장하지 못했어요/)).toBeTruthy();
    expect(mockSetConfirmedPlace).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('isLoading=true → 로딩 표시', () => {
    mockState.isLoading = true;
    mockState.query = '한솥';
    const { queryByTestId } = render(<PlaceSearchScreen />, { wrapper });
    expect(queryByTestId('place-search-loading')).not.toBeNull();
  });

  test('error 메시지 표시', () => {
    mockState.error = '장소를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
    mockState.query = '한솥';
    const { getByText } = render(<PlaceSearchScreen />, { wrapper });
    expect(getByText(/장소를 불러오지 못했어요/)).toBeTruthy();
  });

  test('빈 결과 + 검색어 있음 + 로딩 X → 빈 상태 카피', () => {
    mockState.results = [];
    mockState.query = '없는검색어';
    mockState.isLoading = false;
    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    expect(getByTestId('place-search-empty')).toBeTruthy();
  });

  test('뒤로 가기 → router.back()', () => {
    const { getByLabelText } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.press(getByLabelText('뒤로 가기'));
    expect(mockBack).toHaveBeenCalled();
  });

  test('제휴 배지 — 기본 stub(데이터 미연동) → 리스트 행에 미노출 (② Phase 3 경계 유지)', () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    const { queryByTestId } = render(<PlaceSearchScreen />, { wrapper });
    expect(queryByTestId('partner-badge')).toBeNull();
  });

  test('제휴 capability — isResultPartner=true 시 리스트 행에 제휴 배지 (M4 시각 capability wired)', () => {
    mockIsPartner = true;
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    expect(getByTestId('partner-badge')).toBeTruthy();
  });

  test('지도 마커 onPress(actionId) → 리스트 탭과 동일 확정 액션 (M2 통일)', async () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);

    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });

    // 마커 actionId = providerPlaceId → findResultByActionId → requestConfirm → 동일 ConfirmSheet.
    fireEvent.press(getByTestId(`marker-${sampleResult.providerPlaceId}`));
    await act(async () => {
      fireEvent.press(getByTestId('place-confirm-confirm'));
    });

    await waitFor(() => {
      expect(mockPersistPlace).toHaveBeenCalledWith(sampleResult);
      expect(mockSetConfirmedPlace).toHaveBeenCalledWith('g-1', 'place-uuid');
      expect(mockReplace).toHaveBeenCalledWith('/group/g-1/place?placeId=place-uuid');
    });
  });
});
