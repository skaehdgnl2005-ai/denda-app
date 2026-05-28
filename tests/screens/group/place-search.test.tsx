import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import PlaceSearchScreen from '../../../app/group/[id]/place-search';
import { ThemeProvider } from '@/design/theme';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';

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

function autoConfirmAlert(text: '확정' | '취소'): jest.SpyInstance {
  return jest.spyOn(Alert, 'alert').mockImplementation(((
    _title: string,
    _message?: string,
    buttons?: readonly { text: string; onPress?: () => void }[],
  ) => {
    const btn = buttons?.find((b) => b.text === text);
    btn?.onPress?.();
  }) as typeof Alert.alert);
}

describe('PlaceSearchScreen', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetQuery.mockReset();
    mockPersistPlace.mockReset();
    mockSetConfirmedPlace.mockReset();
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

  test('결과 리스트 렌더 + 카드 tap → 확인 단계 (Alert) 표시', () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.press(getByTestId('place-result-0'));
    expect(alertSpy).toHaveBeenCalled();
    // 확인 단계의 title/message 가 장소 이름을 포함
    const args = alertSpy.mock.calls[0] ?? [];
    expect(String(args[0] ?? '') + String(args[1] ?? '')).toContain('한솥도시락 안암점');
    alertSpy.mockRestore();
  });

  test('Alert 확정 → persistPlace + setConfirmedPlace + place 라우트 replace', async () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);

    const alertSpy = autoConfirmAlert('확정');
    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });

    await act(async () => {
      fireEvent.press(getByTestId('place-result-0'));
    });

    await waitFor(() => {
      expect(mockPersistPlace).toHaveBeenCalledWith(sampleResult);
      expect(mockSetConfirmedPlace).toHaveBeenCalledWith('g-1', 'place-uuid');
      expect(mockReplace).toHaveBeenCalledWith('/group/g-1/place?placeId=place-uuid');
    });
    alertSpy.mockRestore();
  });

  test('Alert 취소 → persistPlace 미호출, navigation 없음', () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    const alertSpy = autoConfirmAlert('취소');
    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.press(getByTestId('place-result-0'));
    expect(mockPersistPlace).not.toHaveBeenCalled();
    expect(mockSetConfirmedPlace).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test('persistPlace 실패 → 에러 Alert, setConfirmedPlace 미호출, navigation 없음', async () => {
    mockState.results = [sampleResult];
    mockState.query = '한솥';
    mockPersistPlace.mockRejectedValue(
      new Error('장소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.'),
    );

    // 첫 alert(확인 단계)는 자동 확정, 두 번째 alert(에러 토스트)는 무시.
    let callIdx = 0;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(((
      _title: string,
      _message?: string,
      buttons?: readonly { text: string; onPress?: () => void }[],
    ) => {
      if (callIdx === 0) {
        callIdx++;
        buttons?.find((b) => b.text === '확정')?.onPress?.();
      }
    }) as typeof Alert.alert);

    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('place-result-0'));
    });

    await waitFor(() => {
      expect(mockPersistPlace).toHaveBeenCalled();
      // 두 번째 alert (에러) 호출됐는지
      expect(alertSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(mockSetConfirmedPlace).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
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
    const { getByTestId } = render(<PlaceSearchScreen />, { wrapper });
    fireEvent.press(getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalled();
  });
});
