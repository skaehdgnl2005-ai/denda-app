import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendsSearchScreen from '../../../app/(tabs)/friends/search';
import { ThemeProvider } from '@/design/theme';
import { friendsApi } from '@/lib/friends/api';
import { Alert } from 'react-native';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('FriendsSearchScreen Screen', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    friendsApi.__resetMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('calls search API after 300ms debounce and displays results', async () => {
    const searchSpy = jest
      .spyOn(friendsApi, 'search')
      .mockResolvedValueOnce([{ id: 'user-10', nickname: '김하늘' }]);

    const { getByTestId, getByText } = render(<FriendsSearchScreen />, { wrapper });

    const input = getByTestId('search-input-field');
    fireEvent.changeText(input, '김하늘');

    expect(searchSpy).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(searchSpy).toHaveBeenCalledWith('김하늘');

    await waitFor(() => {
      expect(getByText('김하늘')).toBeTruthy();
    });
  });

  test('sends friend request on button press and updates button text to sent state', async () => {
    jest.spyOn(friendsApi, 'search').mockResolvedValueOnce([{ id: 'user-10', nickname: '김하늘' }]);
    const sendRequestSpy = jest.spyOn(friendsApi, 'sendRequest');
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByTestId, getByText } = render(<FriendsSearchScreen />, { wrapper });

    const input = getByTestId('search-input-field');
    fireEvent.changeText(input, '김하늘');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(getByText('김하늘')).toBeTruthy();
    });

    const reqButton = getByTestId('send-request-button');
    expect(getByText('친구 요청')).toBeTruthy();

    await act(async () => {
      fireEvent.press(reqButton);
    });

    expect(sendRequestSpy).toHaveBeenCalledWith('user-10');
    expect(alertSpy).toHaveBeenCalledWith('알림', '친구 요청을 보냈습니다.');
    expect(getByText('요청 보냄')).toBeTruthy();
    expect(reqButton.props.accessibilityState.disabled).toBe(true);
  });

  test('navigates back on back button press', () => {
    const { getByTestId } = render(<FriendsSearchScreen />, { wrapper });
    const backBtn = getByTestId('search-back-button');

    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalled();
  });

  test('renders empty state when no results found', async () => {
    jest.spyOn(friendsApi, 'search').mockResolvedValueOnce([]);

    const { getByTestId, getByText } = render(<FriendsSearchScreen />, { wrapper });

    const input = getByTestId('search-input-field');
    fireEvent.changeText(input, '없는유저');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(getByTestId('search-empty-state')).toBeTruthy();
      expect(getByText('검색 결과가 없어요')).toBeTruthy();
    });
  });
});
