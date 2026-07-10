import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GroupConfirmScreen from '../../../app/group/[id]/index';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const HOST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const NON_HOST_ID = '99999999-8888-7777-6666-555555555555';
const VALID_GROUP_ID = '11111111-2222-3333-4444-555555555555';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react');
  return {
    useLocalSearchParams: () => ({ id: '11111111-2222-3333-4444-555555555555' }),
    useRouter: () => ({ back: mockBack, push: mockPush, replace: mockRouterReplace }),
    // useFocusEffect는 마운트/포커스 시 콜백 실행 — 테스트에선 useEffect로 근사(첫 포커스=마운트).
    useFocusEffect: (cb: () => void) => ReactMod.useEffect(() => cb(), [cb]),
  };
});

let mockUserId: string | null = HOST_ID;
jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(selector: (s: { session: { user: { id: string } } | null }) => T) =>
    selector(mockUserId ? { session: { user: { id: mockUserId } } } : { session: null }),
}));

const mockFetchGroup = jest.fn();
const mockFetchUserVotes = jest.fn();
const mockConfirmGroup = jest.fn();
jest.mock('@/lib/groups/queries', () => ({
  fetchGroupForConfirm: (...args: unknown[]) => mockFetchGroup(...args),
  fetchUserVotes: (...args: unknown[]) => mockFetchUserVotes(...args),
}));
jest.mock('@/lib/groups/confirm', () => ({
  confirmGroup: (...args: unknown[]) => mockConfirmGroup(...args),
}));

jest.mock('@/lib/votes/api', () => ({
  commitVoteDiff: jest.fn().mockResolvedValue(undefined),
}));

// useHeatmapSubscription을 stub — supabase channel 회피.
// mockCells를 가변으로 두어 추천(recommendSlots) 입력을 테스트별로 제어한다.
let mockCells: { state: string; count: number }[][] = [];
function makeEmptyCells(): { state: string; count: number }[][] {
  return Array.from({ length: 60 }, () =>
    Array.from({ length: 7 }, () => ({ state: 'heat-0', count: 0 })),
  );
}
function setCell(
  cells: { state: string; count: number }[][],
  col: number,
  row: number,
  count: number,
): void {
  cells[row]![col] = { state: 'heat-2', count };
}
jest.mock('@/lib/heatmap/useHeatmapSubscription', () => ({
  useHeatmapSubscription: () => ({
    cells: mockCells,
    isConnected: true,
    status: 'connected',
  }),
}));

// useSweepGesture mock — gesture-handler 의존 회피. 그리드 panGesture 우회.
// Issue 1A — SelectionOverlay가 구독하는 startCoord/currentCoord/toggleAdd도 노출.
jest.mock('@/lib/votes/useSweepGesture', () => ({
  useSweepGesture: () => ({
    panGesture: { _handlers: {} },
    selection: { value: {} },
    scrollOffsetY: { value: 0 },
    startCoord: { value: null },
    currentCoord: { value: null },
    toggleAdd: { value: true },
  }),
}));

// reanimated mock (이미 jest.setup.js에 있지만 useSharedValue 안전성)
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated/mock');
  return {
    ...actual,
    useSharedValue: (v: unknown) => ({ value: v }),
  };
});

describe('GroupConfirmScreen', () => {
  const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = HOST_ID;
    mockFetchGroup.mockReset();
    mockConfirmGroup.mockReset();
    mockFetchUserVotes.mockReset();
    mockFetchUserVotes.mockResolvedValue([]);
    mockCells = makeEmptyCells();
  });

  test('초기 loading 메시지 → group fetch 후 이름 노출', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '안암 회식',
      dates: ['2026-06-01', '2026-06-02'],
      memberCount: 3,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });

    const { getByText, getByTestId } = render(<GroupConfirmScreen />, { wrapper });
    expect(getByTestId('group-loading-skeleton')).toBeTruthy();
    await waitFor(() => expect(getByText('안암 회식')).toBeTruthy());
    expect(getByText('멤버 3명 · 2일 후보')).toBeTruthy();
  });

  test('load error → EmptyState error variant (raw 메시지 위장 해제 §11.3)', async () => {
    mockFetchGroup.mockRejectedValue(new Error('모임을 찾을 수 없어요.'));
    const { findByTestId, queryByText } = render(<GroupConfirmScreen />, { wrapper });
    expect(await findByTestId('group-load-error')).toBeTruthy();
    // raw 기술 메시지는 사용자에게 노출하지 않는다
    expect(queryByText('모임을 찾을 수 없어요.')).toBeNull();
  });

  test('호스트 + 미확정 → HostConfirmButton 노출', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: 'x',
      dates: ['2026-06-01'],
      memberCount: 1,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    const { findByTestId } = render(<GroupConfirmScreen />, { wrapper });
    expect(await findByTestId('host-confirm-button')).toBeTruthy();
  });

  test('비호스트 → HostConfirmButton 미노출', async () => {
    mockUserId = NON_HOST_ID;
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: 'x',
      dates: ['2026-06-01'],
      memberCount: 1,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    const { queryByTestId, findByText } = render(<GroupConfirmScreen />, { wrapper });
    await findByText('x');
    expect(queryByTestId('host-confirm-button')).toBeNull();
  });

  test('확정된 모임 → ConfirmedTimeCard + 확정 버튼 미노출 (read-only)', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '확정된 모임',
      dates: ['2026-06-01'],
      memberCount: 2,
      confirmedAt: '2026-05-30T10:00:00.000Z',
      confirmedStartAt: '2026-06-01T10:00:00.000Z',
      confirmedEndAt: '2026-06-01T12:00:00.000Z',
      confirmedPlaceId: null,
    });
    const { findByTestId, queryByTestId } = render(<GroupConfirmScreen />, { wrapper });
    expect(await findByTestId('confirmed-time-card')).toBeTruthy();
    expect(queryByTestId('host-confirm-button')).toBeNull();
  });

  test('투표 없음 → 확정 버튼 누르면 추천 시트 빈 상태 노출 (alert 아님)', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: 'x',
      dates: ['2026-06-01'],
      memberCount: 1,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    // mockCells 기본값 = 전부 0 → recommendSlots 빈 배열
    const { findByTestId, findByText } = render(<GroupConfirmScreen />, { wrapper });
    fireEvent.press(await findByTestId('host-confirm-button'));
    expect(await findByText(/아직 추천할 시간이 없어요/)).toBeTruthy();
    expect(mockConfirmGroup).not.toHaveBeenCalled();
  });

  test('히트맵에 표가 있으면 → 확정 버튼 → 추천 목록 → 선택 시 confirmGroup 호출', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: 'x',
      dates: ['2026-06-01', '2026-06-02'],
      memberCount: 3,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    // col0 rows0-1 count=2 (09:00~09:30) → 단일 추천
    setCell(mockCells, 0, 0, 2);
    setCell(mockCells, 0, 1, 2);
    mockConfirmGroup.mockResolvedValue({
      ok: true,
      confirmedAt: '2026-06-01T00:00:00.000Z',
      alreadyConfirmed: false,
      f5Dispatch: { fulfilled: 3, rejected: 0 },
    });

    const { findByTestId } = render(<GroupConfirmScreen />, { wrapper });
    fireEvent.press(await findByTestId('host-confirm-button'));

    const row = await findByTestId('confirm-slot-sheet-slot-0');
    fireEvent.press(row);

    await waitFor(() =>
      expect(mockConfirmGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: VALID_GROUP_ID,
          dayIndex: 0,
          startMinute: 540,
          endMinute: 570,
          confirmedPlaceId: null,
        }),
      ),
    );
  });

  test('S20: 호스트 + 확정 + 장소 미정 → "장소 정하기" 버튼 → place-search push', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '확정된 모임',
      dates: ['2026-06-01'],
      memberCount: 2,
      confirmedAt: '2026-05-30T10:00:00.000Z',
      confirmedStartAt: '2026-06-01T10:00:00.000Z',
      confirmedEndAt: '2026-06-01T12:00:00.000Z',
      confirmedPlaceId: null,
    });
    const { findByTestId } = render(<GroupConfirmScreen />, { wrapper });
    const btn = await findByTestId('place-pick-button');
    fireEvent.press(btn);
    expect(mockPush).toHaveBeenCalledWith(`/group/${VALID_GROUP_ID}/place-search`);
  });

  test('S-MAP M3: 호스트 + 확정 + 장소 미정 → "중간지점으로 찾기" → midpoint push', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '확정된 모임',
      dates: ['2026-06-01'],
      memberCount: 2,
      confirmedAt: '2026-05-30T10:00:00.000Z',
      confirmedStartAt: '2026-06-01T10:00:00.000Z',
      confirmedEndAt: '2026-06-01T12:00:00.000Z',
      confirmedPlaceId: null,
    });
    const { findByTestId } = render(<GroupConfirmScreen />, { wrapper });
    const btn = await findByTestId('midpoint-entry-button');
    fireEvent.press(btn);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/group/[id]/midpoint',
      params: { id: VALID_GROUP_ID },
    });
  });

  test('S20: 비호스트 + 확정 + 장소 미정 → "장소 정하기" 버튼 미노출', async () => {
    mockUserId = NON_HOST_ID;
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '확정된 모임',
      dates: ['2026-06-01'],
      memberCount: 2,
      confirmedAt: '2026-05-30T10:00:00.000Z',
      confirmedStartAt: '2026-06-01T10:00:00.000Z',
      confirmedEndAt: '2026-06-01T12:00:00.000Z',
      confirmedPlaceId: null,
    });
    const { queryByTestId, findByText } = render(<GroupConfirmScreen />, { wrapper });
    await findByText('확정된 모임');
    expect(queryByTestId('place-pick-button')).toBeNull();
  });

  test('S20: 미확정 → "장소 정하기" 버튼 미노출 (시간 확정 먼저)', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '미확정',
      dates: ['2026-06-01'],
      memberCount: 1,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    const { queryByTestId, findByText } = render(<GroupConfirmScreen />, { wrapper });
    await findByText('미확정');
    expect(queryByTestId('place-pick-button')).toBeNull();
  });

  test('S20: 확정 + 장소 정해짐 → "장소 보기" 버튼 → place 라우트 push', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '확정된 모임',
      dates: ['2026-06-01'],
      memberCount: 2,
      confirmedAt: '2026-05-30T10:00:00.000Z',
      confirmedStartAt: '2026-06-01T10:00:00.000Z',
      confirmedEndAt: '2026-06-01T12:00:00.000Z',
      confirmedPlaceId: 'place-uuid-x',
    });
    const { findByTestId } = render(<GroupConfirmScreen />, { wrapper });
    const btn = await findByTestId('place-view-button');
    fireEvent.press(btn);
    expect(mockPush).toHaveBeenCalledWith(`/group/${VALID_GROUP_ID}/place?placeId=place-uuid-x`);
  });

  test('S22: 호스트 → 헤더 "친구 초대" 버튼 → /group/[id]/invite push', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: 'x',
      dates: ['2026-06-01'],
      memberCount: 1,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    const { findByTestId } = render(<GroupConfirmScreen />, { wrapper });
    fireEvent.press(await findByTestId('invite-button'));
    expect(mockPush).toHaveBeenCalledWith(`/group/${VALID_GROUP_ID}/invite`);
  });

  test('S22: 비호스트 → 헤더 "친구 초대" 버튼 미노출', async () => {
    mockUserId = NON_HOST_ID;
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: 'x',
      dates: ['2026-06-01'],
      memberCount: 1,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    const { queryByTestId, findByText } = render(<GroupConfirmScreen />, { wrapper });
    await findByText('x');
    expect(queryByTestId('invite-button')).toBeNull();
  });

  test('back-button → router.back 호출', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: 'x',
      dates: ['2026-06-01'],
      memberCount: 1,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    const { findByTestId } = render(<GroupConfirmScreen />, { wrapper });
    fireEvent.press(await findByTestId('back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
