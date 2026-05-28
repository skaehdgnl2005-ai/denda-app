import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendsIndexScreen from '../../../app/(tabs)/friends/index';
import { ThemeProvider } from '@/design/theme';
import { friendsApi } from '@/lib/friends/api';

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

describe('FriendsIndexScreen Screen', () => {
  const wrapper = ThemeProvider;

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
});
