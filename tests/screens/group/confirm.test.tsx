import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import GroupConfirmScreen from '../../../app/group/[id]/index';
import { ThemeProvider } from '@/design/theme';

const HOST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const NON_HOST_ID = '99999999-8888-7777-6666-555555555555';
const VALID_GROUP_ID = '11111111-2222-3333-4444-555555555555';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '11111111-2222-3333-4444-555555555555' }),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

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

// useHeatmapSubscription을 stub — supabase channel 회피
jest.mock('@/lib/heatmap/useHeatmapSubscription', () => ({
  useHeatmapSubscription: () => ({
    cells: Array.from({ length: 60 }, () =>
      Array.from({ length: 7 }, () => ({ state: 'heat-0', count: 0 })),
    ),
    isConnected: true,
    status: 'connected',
  }),
}));

// useSweepGesture mock — gesture-handler 의존 회피. 그리드 panGesture 우회.
jest.mock('@/lib/votes/useSweepGesture', () => ({
  useSweepGesture: () => ({
    panGesture: { _handlers: {} },
    selection: { value: {} },
    scrollOffsetY: { value: 0 },
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
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = HOST_ID;
    mockFetchGroup.mockReset();
    mockConfirmGroup.mockReset();
    mockFetchUserVotes.mockReset();
    mockFetchUserVotes.mockResolvedValue([]);
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

    const { getByText } = render(<GroupConfirmScreen />, { wrapper });
    expect(getByText('모임을 불러오는 중...')).toBeTruthy();
    await waitFor(() => expect(getByText('안암 회식')).toBeTruthy());
    expect(getByText('멤버 3명 · 2일 후보')).toBeTruthy();
  });

  test('load error → 에러 메시지 노출', async () => {
    mockFetchGroup.mockRejectedValue(new Error('모임을 찾을 수 없어요.'));
    const { findByText } = render(<GroupConfirmScreen />, { wrapper });
    expect(await findByText('모임을 찾을 수 없어요.')).toBeTruthy();
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

  test('호스트가 선택 없이 확정 버튼 누름 → "시간을 먼저 선택해주세요" alert', async () => {
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
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { findByTestId } = render(<GroupConfirmScreen />, { wrapper });
    const btn = await findByTestId('host-confirm-button');
    fireEvent.press(btn);
    expect(alertSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('시간'));
    alertSpy.mockRestore();
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
