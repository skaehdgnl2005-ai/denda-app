import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendsIndexScreen from '../../../app/(tabs)/friends/index';
import { ThemeProvider } from '@/design/theme';
import { friendsApi } from '@/lib/friends/api';
import { Alert } from 'react-native';

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

describe('FriendsIndexScreen Screen', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    friendsApi.__resetMocks();
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
    jest.spyOn(friendsApi, 'list').mockResolvedValueOnce([]);
    jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValueOnce([]);

    const { getByText, getByTestId, queryByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('아직 친구가 없어요')).toBeTruthy();
      expect(getByTestId('empty-state')).toBeTruthy();
      expect(queryByTestId('friend-card')).toBeNull();
    });
  });

  test('triggers Alert on make group CTA click', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getAllByTestId } = render(<FriendsIndexScreen />, { wrapper });

    await waitFor(() => {
      const makeGroupBtns = getAllByTestId('make-group-button');
      fireEvent.press(makeGroupBtns[0]!);
    });

    expect(alertSpy).toHaveBeenCalledWith('모임 만들기', '홍길동님과 모임을 만듭니다.');
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
