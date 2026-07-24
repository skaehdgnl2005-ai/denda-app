// 재진입(및 모든 신규 마운트)에서 기존 투표가 있는 사용자가 새 슬롯 1개를 sweep하면
// useSweepGesture selection이 기존 투표로 시드되지 않아 diff의 removed로 기존 투표
// 전체가 서버에서 DELETE되는 회귀 테스트 (P2 버그 헌트 confirmed critical).
// confirm.test.tsx와 달리 실제 useSweepGesture를 사용하고 Grid만 prop 캡처 mock으로
// 대체해 jest.setup.js의 RNGH _handlers stub으로 실제 sweep 파이프라인을 구동한다.

import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GroupConfirmScreen from '../../../app/group/[id]/index';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { commitVoteDiff } from '@/lib/votes/api';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const HOST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_GROUP_ID = '11111111-2222-3333-4444-555555555555';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react');
  return {
    useLocalSearchParams: () => ({ id: '11111111-2222-3333-4444-555555555555' }),
    useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
    useFocusEffect: (cb: () => void) => ReactMod.useEffect(() => cb(), [cb]),
  };
});

jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(selector: (s: { session: { user: { id: string } } | null }) => T) =>
    selector({ session: { user: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } } }),
}));

const mockFetchGroup = jest.fn();
const mockFetchUserVotes = jest.fn();
jest.mock('@/lib/groups/queries', () => ({
  fetchGroupForConfirm: (...args: unknown[]) => mockFetchGroup(...args),
  fetchUserVotes: (...args: unknown[]) => mockFetchUserVotes(...args),
}));
jest.mock('@/lib/groups/confirm', () => ({
  confirmGroup: jest.fn(),
}));

jest.mock('@/lib/votes/api', () => ({
  commitVoteDiff: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/heatmap/useHeatmapSubscription', () => ({
  useHeatmapSubscription: () => ({
    cells: Array.from({ length: 60 }, () =>
      Array.from({ length: 7 }, () => ({ state: 'heat-0', count: 0 })),
    ),
    isConnected: true,
    status: 'connected',
  }),
}));

// Grid mock — 실제 useSweepGesture가 만든 panGesture prop을 캡처하고,
// 실기기에서 onLayout이 하듯 cellWidth(40)를 배선한다.
interface GestureHandlers {
  onStart?: (e: { x: number; y: number }) => void;
  onUpdate?: (e: { x: number; y: number }) => void;
  onEnd?: () => void;
}
let mockGridProps: {
  panGesture?: { _handlers: GestureHandlers };
  onCellWidthChange?: (w: number) => void;
  testID?: string;
} | null = null;
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock 팩토리 hoisting */
jest.mock('@/components/TimeGrid/Grid', () => {
  const ReactMod = require('react');
  const { View } = require('react-native');
  return {
    Grid: (props: Record<string, unknown>): React.JSX.Element => {
      mockGridProps = props as unknown as typeof mockGridProps;
      const onCellWidthChange = props.onCellWidthChange;
      ReactMod.useEffect(() => {
        if (typeof onCellWidthChange === 'function') onCellWidthChange(40);
      });
      return ReactMod.createElement(View, { testID: props.testID as string });
    },
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

describe('GroupConfirmScreen — sweep 재진입 시드', () => {
  const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockGridProps = null;
  });

  test('기존 투표가 있는 상태에서 새 슬롯 1개 sweep → 기존 투표가 삭제되면 안 된다', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '재진입 모임',
      dates: ['2026-07-25', '2026-07-26'],
      memberCount: 2,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    // 사용자는 과거 세션에서 7/25 09:00 슬롯(col 0, row 0)에 투표해 둔 상태
    mockFetchUserVotes.mockResolvedValue([{ day: '2026-07-25', start_minute: 540 }]);

    const { findByText } = render(<GroupConfirmScreen />, { wrapper });
    await findByText('재진입 모임'); // fetch 완료 → selectionRecord·prevVoteSetRef 시드 완료

    const handlers = mockGridProps!.panGesture!._handlers;

    // 새 슬롯 1개만 sweep: col=1(7/26), row=4(10:00)
    // layout: headerWidth 50, cellWidth 40, cellHeight 16 → x=50+40+1=91, y=4*16+1=65
    await act(async () => {
      handlers.onStart!({ x: 91, y: 65 });
      handlers.onEnd!();
    });

    // 기대: 새 슬롯만 added, 기존 투표는 유지(removed 없음).
    expect(commitVoteDiff).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: VALID_GROUP_ID,
        userId: HOST_ID,
        added: [{ day: '2026-07-26', start_minute: 600 }],
        removed: [],
      }),
    );
  });

  test('commit1 in-flight 중 sweep2 → 커밋이 직렬화되어 착지 순서 역전이 없다', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '재진입 모임',
      dates: ['2026-07-25', '2026-07-26'],
      memberCount: 2,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    mockFetchUserVotes.mockResolvedValue([]);

    // commit1은 느린 네트워크 — resolve를 손에 쥔다.
    let resolveCommit1: (v?: unknown) => void = () => {};
    (commitVoteDiff as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveCommit1 = res;
          }),
      )
      .mockResolvedValue(undefined);

    const { findByText } = render(<GroupConfirmScreen />, { wrapper });
    await findByText('재진입 모임');
    const handlers = mockGridProps!.panGesture!._handlers;

    // sweep1: col0 row0 추가 (INSERT in-flight)
    await act(async () => {
      handlers.onStart!({ x: 51, y: 1 });
      handlers.onEnd!();
    });
    // sweep2: 같은 셀 다시 sweep → 제거 (DELETE). commit1 미해결 상태.
    await act(async () => {
      handlers.onStart!({ x: 51, y: 1 });
      handlers.onEnd!();
    });

    // 직렬화: commit2는 commit1 resolve 전까지 발사되면 안 된다.
    expect(commitVoteDiff).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCommit1();
    });
    expect(commitVoteDiff).toHaveBeenCalledTimes(2);
    expect(commitVoteDiff).toHaveBeenLastCalledWith(
      expect.objectContaining({
        added: [],
        removed: [{ day: '2026-07-25', start_minute: 540 }],
      }),
    );
  });

  test('commit 실패 → diff 기준선 롤백으로 다음 sweep이 실패분을 재전송한다', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '재진입 모임',
      dates: ['2026-07-25', '2026-07-26'],
      memberCount: 2,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    mockFetchUserVotes.mockResolvedValue([]);

    (commitVoteDiff as jest.Mock)
      .mockRejectedValueOnce(new Error('네트워크 오류'))
      .mockResolvedValue(undefined);

    const { findByText } = render(<GroupConfirmScreen />, { wrapper });
    await findByText('재진입 모임');
    const handlers = mockGridProps!.panGesture!._handlers;

    // sweep1: A(col0 row0) 추가 — 커밋 실패
    await act(async () => {
      handlers.onStart!({ x: 51, y: 1 });
      handlers.onEnd!();
    });
    // sweep2: B(col1 row4) 추가 — 스냅샷엔 A도 포함(selection 유지),
    // 기준선이 롤백됐다면 diff가 A를 다시 added로 산출해 재전송한다.
    await act(async () => {
      handlers.onStart!({ x: 91, y: 65 });
      handlers.onEnd!();
    });

    expect(commitVoteDiff).toHaveBeenLastCalledWith(
      expect.objectContaining({
        added: expect.arrayContaining([
          { day: '2026-07-25', start_minute: 540 },
          { day: '2026-07-26', start_minute: 600 },
        ]),
        removed: [],
      }),
    );
  });

  test('기존 투표 셀에서 sweep 시작 → add가 아닌 remove 모드로 판정 (baseline 시드)', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: HOST_ID,
      name: '재진입 모임',
      dates: ['2026-07-25', '2026-07-26'],
      memberCount: 2,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    mockFetchUserVotes.mockResolvedValue([{ day: '2026-07-25', start_minute: 540 }]);

    const { findByText } = render(<GroupConfirmScreen />, { wrapper });
    await findByText('재진입 모임');

    const handlers = mockGridProps!.panGesture!._handlers;

    // 기존 투표 셀(col 0, row 0)에서 sweep 시작·종료 → 그 셀 제거가 기대 동작
    await act(async () => {
      handlers.onStart!({ x: 51, y: 1 });
      handlers.onEnd!();
    });

    expect(commitVoteDiff).toHaveBeenCalledWith(
      expect.objectContaining({
        added: [],
        removed: [{ day: '2026-07-25', start_minute: 540 }],
      }),
    );
  });
});
