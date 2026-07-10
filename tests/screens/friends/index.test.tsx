import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendsIndexScreen from '../../../app/(tabs)/friends/index';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { friendsApi } from '@/lib/friends/api';
import { invitationsApi } from '@/lib/groups/invitations';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// S07-report: friends index가 useAuth import → setup.ts → @react-native-kakao/user ESM 체인 회피.
// useAuth selector는 reporter_id null로만 사용되므로 mock으로 충분.
jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(selector: (s: { session: null }) => T) => selector({ session: null }),
}));

// supabase client mock — friends index가 submitReport / blockUser import → @/lib/supabase/client → env 변수 throw 회피.
jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

// S24: native Share API 회피 + shareInviteToKakao 호출 검증.
jest.mock('@/lib/share/kakaoShare', () => ({
  createNativeShareApi: jest.fn(() => ({ share: jest.fn() })),
}));
const mockShareInvite = jest.fn().mockResolvedValue({ shared: true });
jest.mock('@/lib/share/inviteShare', () => ({
  shareInviteToKakao: (...args: unknown[]) => mockShareInvite(...args),
}));

// W2-10: 배지 카운트에 모임 초대 합산 — invitationsApi 모킹(기본 빈 배열).
jest.mock('@/lib/groups/invitations', () => ({
  invitationsApi: { listMyInvitations: jest.fn().mockResolvedValue([]) },
}));

// S21: friendsApi가 supabase로 전면 교체됨 — mock data는 spy로 명시.
const DEFAULT_FRIENDS = [
  { id: 'user-2', nickname: '홍길동' },
  { id: 'user-3', nickname: '김영희' },
  { id: 'user-4', nickname: '이철수' },
];
const DEFAULT_INCOMING = [
  {
    id: 'req-1',
    sender_id: 'user-5',
    receiver_id: 'me',
    sender: { id: 'user-5', nickname: '박민수' },
    created_at: '2026-05-23T10:00:00Z',
  },
  {
    id: 'req-2',
    sender_id: 'user-6',
    receiver_id: 'me',
    sender: { id: 'user-6', nickname: '최수지' },
    created_at: '2026-05-23T11:30:00Z',
  },
];

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

describe('FriendsIndexScreen Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    friendsApi.__resetMocks();
    jest.spyOn(friendsApi, 'list').mockResolvedValue([...DEFAULT_FRIENDS]);
    jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValue([...DEFAULT_INCOMING]);
  });

  test('renders loading and then list of friends', async () => {
    const { getByText, getAllByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('홍길동')).toBeTruthy();
      expect(getByText('김영희')).toBeTruthy();
      expect(getByText('이철수')).toBeTruthy();
    });

    const friendCards = getAllByTestId('friend-card');
    expect(friendCards.length).toBe(3);
  });

  test('renders badge count based on incoming requests count', async () => {
    const { getByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      const badge = getByTestId('requests-badge');
      expect(badge).toBeTruthy();
    });
  });

  test('W2-10 — 배지 카운트 = 받은 요청 + 모임 초대 합산', async () => {
    jest
      .spyOn(friendsApi, 'listIncomingRequests')
      .mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }] as never);
    (invitationsApi.listMyInvitations as jest.Mock).mockResolvedValueOnce([
      { id: 'i1' },
      { id: 'i2' },
      { id: 'i3' },
    ]);

    const { getByText } = render(<FriendsIndexScreen />, { wrapper });
    await waitFor(() => {
      expect(getByText('5')).toBeTruthy(); // 2 요청 + 3 초대
    });
  });

  test('navigates to search screen on search button press', async () => {
    const { getByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      const searchBtn = getByTestId('search-nav-button');
      fireEvent.press(searchBtn);
      expect(mockPush).toHaveBeenCalledWith('/friends/search');
    });
  });

  test('navigates to requests screen on requests button press', async () => {
    const { getByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      const requestsBtn = getByTestId('requests-nav-button');
      fireEvent.press(requestsBtn);
      expect(mockPush).toHaveBeenCalledWith('/friends/requests');
    });
  });

  test('renders empty state when list is empty', async () => {
    (friendsApi.list as jest.Mock).mockResolvedValueOnce([]);
    (friendsApi.listIncomingRequests as jest.Mock).mockResolvedValueOnce([]);

    const { getByText, getByTestId, queryByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('아직 친구가 없어요')).toBeTruthy();
      expect(getByTestId('empty-state')).toBeTruthy();
      expect(queryByTestId('friend-card')).toBeNull();
    });
  });

  // S24: 카톡 초대 버튼 → shareInviteToKakao 호출 (가짜 Alert 아님).
  test('빈 상태 카톡 초대 버튼 → shareInviteToKakao 호출', async () => {
    (friendsApi.list as jest.Mock).mockResolvedValueOnce([]);
    (friendsApi.listIncomingRequests as jest.Mock).mockResolvedValueOnce([]);

    const { getByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      const btn = getByTestId('kakao-invite-button');
      fireEvent.press(btn);
    });

    await waitFor(() => {
      expect(mockShareInvite).toHaveBeenCalledTimes(1);
    });
    const [args, options] = mockShareInvite.mock.calls[0]!;
    expect(args).toEqual(expect.objectContaining({ inviterNickname: expect.any(String) }));
    expect(options).toEqual(expect.objectContaining({ shareApi: expect.anything() }));
  });

  // S18: 모임 만들기 CTA → 모임 생성 화면 진입 (이전 Alert stub 대체).
  test('navigates to new group screen on make group CTA click', async () => {
    const { getAllByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      const makeGroupBtns = getAllByTestId('make-group-button');
      fireEvent.press(makeGroupBtns[0]!);
    });

    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });

  test('opens block/report sheet on friend more button click', async () => {
    const { getAllByTestId, getByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      const moreBtns = getAllByTestId('more-button');
      fireEvent.press(moreBtns[0]!);
    });

    const sheet = getByTestId('report-block-sheet');
    expect(sheet).toBeTruthy();
  });

  // W1-8: 첫 로딩이 빈 화면이 아니라 Skeleton.
  test('첫 로딩은 Skeleton (빈 화면 아님)', () => {
    const { getByTestId } = render(<FriendsIndexScreen />, { wrapper });
    expect(getByTestId('friends-loading')).toBeTruthy();
  });

  // W1-8: fetch 실패를 빈 상태로 위장하지 않고 EmptyState error로 표출 + 재시도.
  test('fetch 실패 → EmptyState error (빈 상태 위장 아님) + 다시 시도 refetch', async () => {
    (friendsApi.list as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const { getByTestId, queryByText, findByText } = render(<FriendsIndexScreen />, { wrapper });
    await waitFor(() => expect(getByTestId('friends-error')).toBeTruthy());
    expect(queryByText('아직 친구가 없어요')).toBeNull();
    fireEvent.press(getByTestId('friends-error-cta'));
    expect(await findByText('홍길동')).toBeTruthy();
  });

  // W1-4: 성공/실패 피드백이 시스템 Alert이 아닌 디자인 토스트.
  test('차단 성공 → success 토스트 (Alert 아님)', async () => {
    jest.spyOn(friendsApi, 'blockUser').mockResolvedValue(undefined);
    const { getAllByTestId, getByTestId, findByText } = render(<FriendsIndexScreen />, { wrapper });
    await waitFor(() => expect(getAllByTestId('more-button').length).toBeGreaterThan(0));
    fireEvent.press(getAllByTestId('more-button')[0]!);
    fireEvent.press(getByTestId('block-option'));
    expect(await findByText('차단했어요.')).toBeTruthy();
  });
});
