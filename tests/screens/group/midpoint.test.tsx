// S-MAP M5 — 중간지점 화면: 서버 출발지(n/m 진행·본인만 쓰기) → 중간점 계산 → 근처 추천 → 확정(M2 재사용).

import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MidpointScreen from '../../../app/group/[id]/midpoint';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import type { StationSnap } from '@/lib/map/stationSnap';

let mockSnap: StationSnap | null = null;
jest.mock('@/lib/map/stationSnap', () => ({
  ...jest.requireActual('@/lib/map/stationSnap'),
  nearestStation: () => mockSnap,
}));
jest.mock('@/lib/map/stations.data', () => ({ SUBWAY_STATIONS: [] }));

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
let mockParams: Record<string, string> = { id: 'g-1' };
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react') as typeof React;
  return {
    useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void | (() => void)) => ReactMod.useEffect(cb, [cb]),
  };
});

// 추천 검색용 useMapSearch — controllable.
type SearchState = {
  query: string;
  setQuery: (q: string) => void;
  results: PlaceSearchResult[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
};
let mockState: SearchState;
const mockSetQuery = jest.fn();
const mockRetry = jest.fn();
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

let mockUserId: string | undefined = 'me';
jest.mock('@/lib/auth/setup', () => ({
  useAuth: (sel: (s: { session?: { user: { id: string | undefined } } }) => unknown) =>
    sel({ session: { user: { id: mockUserId } } }),
}));

const mockFetchOrigins = jest.fn();
const mockUpsertOrigin = jest.fn();
const mockDeleteOrigin = jest.fn();
jest.mock('@/lib/map/groupOrigins', () => ({
  fetchGroupOrigins: (...a: unknown[]) => mockFetchOrigins(...a),
  upsertMyOrigin: (...a: unknown[]) => mockUpsertOrigin(...a),
  deleteMyOrigin: (...a: unknown[]) => mockDeleteOrigin(...a),
}));

const mockFetchGroup = jest.fn();
jest.mock('@/lib/groups/queries', () => ({
  fetchGroupForConfirm: (...a: unknown[]) => mockFetchGroup(...a),
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

const MY_ORIGIN = {
  userId: 'me',
  nickname: '나',
  label: '강남역',
  coord: { lat: 37.4979, lng: 127.0276 },
};
const OTHER_ORIGIN = {
  userId: 'u2',
  nickname: '지연',
  label: '홍대입구역',
  coord: { lat: 37.5572, lng: 126.9245 },
};

describe('MidpointScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnap = null;
    mockParams = { id: 'g-1' };
    mockLoadRecent.mockResolvedValue([]);
    mockSaveRecent.mockResolvedValue([]);
    mockState = {
      query: '',
      setQuery: mockSetQuery,
      results: [],
      isLoading: false,
      error: null,
      retry: mockRetry,
    };
    mockUserId = 'me';
    mockFetchOrigins.mockResolvedValue([]);
    mockUpsertOrigin.mockResolvedValue(undefined);
    mockDeleteOrigin.mockResolvedValue(undefined);
    mockFetchGroup.mockResolvedValue({
      id: 'g-1',
      hostId: 'host',
      name: '모임',
      dates: [],
      memberCount: 5,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
  });

  test('focus 시 서버 출발지 fetch → 진행 표시 "2/5명 입력" + 타인 행 읽기 전용', async () => {
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    const { findByTestId, getByText, queryByTestId } = render(<MidpointScreen />, { wrapper });
    await findByTestId('origin-progress');
    expect(getByText(/2\/5명 입력/)).toBeTruthy();
    expect(getByText(/지연 · 홍대입구역/)).toBeTruthy();
    // 내 행에만 삭제 버튼
    expect(queryByTestId('my-origin-remove')).toBeTruthy();
  });

  test('OriginInput 선택 → upsertMyOrigin(g-1, me, origin) + refetch', async () => {
    const { getByTestId } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
    });
    expect(mockUpsertOrigin).toHaveBeenCalledWith('g-1', 'me', {
      label: '강남역',
      coord: { lat: 37.4979, lng: 127.0276 },
    });
    expect(mockFetchOrigins.mock.calls.length).toBeGreaterThanOrEqual(2); // mount + upsert 후
  });

  test('내 출발지 삭제 → deleteMyOrigin(g-1, me)', async () => {
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    const { findByTestId } = render(<MidpointScreen />, { wrapper });
    const removeBtn = await findByTestId('my-origin-remove');
    await act(async () => {
      fireEvent.press(removeBtn);
    });
    expect(mockDeleteOrigin).toHaveBeenCalledWith('g-1', 'me');
  });

  test('서버 출발지 2개 이상 → 중간지점 요약 노출 (미입력자 제외 진행)', async () => {
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    const { findByTestId } = render(<MidpointScreen />, { wrapper });
    expect(await findByTestId('midpoint-summary')).toBeTruthy();
  });

  test('fetch 실패 → 한국어 에러 + 재시도 버튼이 재호출', async () => {
    mockFetchOrigins.mockRejectedValueOnce(
      new Error('출발지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    );
    const { findByTestId, getByText } = render(<MidpointScreen />, { wrapper });
    const retry = await findByTestId('origins-error-retry');
    expect(getByText(/출발지를 불러오지 못했어요/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(retry);
    });
    expect(mockFetchOrigins.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('느린 첫 fetch가 뒤늦게 resolve돼도 최신 출발지를 덮어쓰지 않는다 (load 경합 가드)', async () => {
    // 1) mount 시 첫 load의 fetchGroupOrigins는 pending — 나중에 stale []로 resolve될 promise A.
    let resolveFirst: (v: unknown) => void = () => {};
    const firstFetch = new Promise((res) => {
      resolveFirst = res;
    });
    mockFetchOrigins.mockImplementationOnce(() => firstFetch);
    // 2) upsert 성공 후의 두 번째 load(promise B)는 즉시 최신 상태로 resolve.
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);

    const { getByTestId, getByText, findByTestId } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
    });
    await findByTestId('origin-progress');
    expect(getByText(/2\/5명 입력/)).toBeTruthy();

    // 3) 먼저 시작된 느린 fetch(promise A)가 이제서야 stale []로 resolve.
    await act(async () => {
      resolveFirst([]);
    });
    // 4) 최신 상태 유지 — stale 결과가 덮어쓰면 "0/5명 입력"으로 회귀.
    expect(getByText(/2\/5명 입력/)).toBeTruthy();
  });

  test('출발지 추가 → saveRecentOrigin 호출', async () => {
    const { getByTestId } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
    });
    expect(mockSaveRecent).toHaveBeenCalled();
  });

  test('라우트 파라미터에 id 없음 → 안전 화면 렌더 + 빈 groupId로 fetch하지 않음', async () => {
    // 딥링크가 params 없이 착지하는 경우 — index.tsx의 `if (!groupId)` 가드와 동일 패턴.
    mockParams = {};
    const { findByText } = render(<MidpointScreen />, { wrapper });
    expect(await findByText('모임 ID가 없어요.')).toBeTruthy();
    expect(mockFetchOrigins).not.toHaveBeenCalled();
    expect(mockFetchGroup).not.toHaveBeenCalled();
  });

  test('세션 hydration 전(userId undefined) 출발지 추가 → 조용한 무시 대신 안내 토스트', async () => {
    // 콜드스타트/딥링크 직후 세션 복원 전에 진입하면 userId가 undefined —
    // 이때 추가가 아무 피드백 없이 무시되면 사용자는 "고장"으로 인지한다.
    mockUserId = undefined;
    const { getByTestId, findByText } = render(<MidpointScreen />, { wrapper });
    await act(async () => {
      fireEvent.press(getByTestId('add-origin-a'));
    });
    expect(mockUpsertOrigin).not.toHaveBeenCalled();
    // 서버 저장이 안 된 출발지를 최근 칩에 남기면 다음 진입 때 혼동 — 함께 차단.
    expect(mockSaveRecent).not.toHaveBeenCalled();
    expect(await findByText(/로그인 정보를 확인하는 중이에요/)).toBeTruthy();
  });

  test('추천 결과는 중간지점에 가까운 순으로 정렬', async () => {
    mockState.results = [farResult, nearResult];
    mockState.query = '식당';
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    const { getByTestId, findByTestId } = render(<MidpointScreen />, { wrapper });
    await findByTestId('midpoint-summary');
    // 가까운식당 이 reco-result-0 에 와야 함.
    expect(within(getByTestId('reco-result-0')).getByText('가까운식당')).toBeTruthy();
  });

  test('추천 결과 tap → ConfirmSheet 확정 → persist + setConfirmedPlace + place 라우트', async () => {
    mockState.results = [nearResult];
    mockState.query = '식당';
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);

    const { getByTestId, findByTestId } = render(<MidpointScreen />, { wrapper });
    await findByTestId('midpoint-summary');
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
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);

    const { getByTestId, findByTestId } = render(<MidpointScreen />, { wrapper });
    await findByTestId('midpoint-summary');
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
    await act(async () => {}); // mount 시 loadRecentOrigins + 서버 fetch promise flush
    fireEvent.press(getByLabelText('뒤로 가기'));
    expect(mockBack).toHaveBeenCalled();
  });

  const SNAP: StationSnap = {
    name: '공덕역',
    coord: { lat: 37.5432, lng: 126.9512 },
    distanceMeters: 420,
  };

  test('역 스냅 성공 → 역 카드 + "○○역 맛집" 자동 검색 발사', async () => {
    mockSnap = SNAP;
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    const { findByTestId, getByText } = render(<MidpointScreen />, { wrapper });
    expect(await findByTestId('station-card')).toBeTruthy();
    expect(getByText(/공덕역 근처가 중간이에요/)).toBeTruthy();
    expect(getByText(/420m/)).toBeTruthy();
    await waitFor(() => expect(mockSetQuery).toHaveBeenCalledWith('공덕역 맛집'));
  });

  test('카테고리 칩 전환 → 쿼리 재발사', async () => {
    mockSnap = SNAP;
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    const { findByTestId } = render(<MidpointScreen />, { wrapper });
    const chip = await findByTestId('reco-chip-카페');
    await act(async () => {
      fireEvent.press(chip);
    });
    expect(mockSetQuery).toHaveBeenCalledWith('공덕역 카페');
  });

  test('수동 검색 입력 → 자동 모드 해제 (칩 selected 해제 + 입력값 그대로 검색)', async () => {
    mockSnap = SNAP;
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    const { findByTestId, getByTestId } = render(<MidpointScreen />, { wrapper });
    await findByTestId('station-card');
    await act(async () => {
      fireEvent.changeText(getByTestId('reco-search-input'), '파스타');
    });
    expect(mockSetQuery).toHaveBeenCalledWith('파스타');
    expect(getByTestId('reco-chip-맛집').props.accessibilityState?.selected).toBe(false);
  });

  test('역 3km 초과(스냅 null) → 역 카드·칩 없음, 기존 수동 검색 유지 (교외 폴백)', async () => {
    mockSnap = null;
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    const { findByTestId, queryByTestId } = render(<MidpointScreen />, { wrapper });
    await findByTestId('midpoint-summary');
    expect(queryByTestId('station-card')).toBeNull();
    expect(queryByTestId('reco-chip-맛집')).toBeNull();
  });

  test('출발지 2명 미만 → 안내 카피 노출', async () => {
    mockFetchOrigins.mockResolvedValue([]);
    const { findByText } = render(<MidpointScreen />, { wrapper });
    expect(
      await findByText('출발지를 등록해주세요 · 2명 이상 모이면 중간지점을 찾아드려요'),
    ).toBeTruthy();
  });

  test('추천 검색 에러 → 재시도 버튼 press 시 retry() 호출', async () => {
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    mockState.error = '결과를 새로 불러오지 못했어요.';
    const { findByTestId } = render(<MidpointScreen />, { wrapper });
    const retryBtn = await findByTestId('reco-error-retry');
    await act(async () => {
      fireEvent.press(retryBtn);
    });
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  test('에러 상태에서 선택된 칩 재탭 → setCategory 재발사가 아니라 retry() 경유', async () => {
    mockSnap = SNAP; // category 기본값 '맛집' → reco-chip-맛집이 이미 selected
    mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
    mockState.error = '결과를 새로 불러오지 못했어요.';
    const { findByTestId, getByTestId } = render(<MidpointScreen />, { wrapper });
    await findByTestId('station-card');
    const setQueryCallsBefore = mockSetQuery.mock.calls.length;

    await act(async () => {
      fireEvent.press(getByTestId('reco-chip-맛집'));
    });

    expect(mockRetry).toHaveBeenCalledTimes(1);
    // 선택된 칩 그대로이므로 자동 재검색 useEffect(deps: snap/category/setQuery)는 재발사되지 않는다.
    expect(mockSetQuery.mock.calls.length).toBe(setQueryCallsBefore);
  });
});
