import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendsRequestsScreen from '../../../app/(tabs)/friends/requests';
import { ThemeProvider } from '@/design/theme';
import { friendsApi } from '@/lib/friends/api';
import { Alert } from 'react-native';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('FriendsRequestsScreen Screen', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    friendsApi.__resetMocks();
  });

  test('renders incoming requests by default', async () => {
    const { getByText, getAllByTestId } = render(<FriendsRequestsScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
      expect(getByText('최수지')).toBeTruthy();
    });

    const cards = getAllByTestId('friend-request-card');
    expect(cards.length).toBe(2);
  });

  test('switches tab to outgoing requests and displays them', async () => {
    const { getByText, getByTestId, getAllByTestId } = render(<FriendsRequestsScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    const outgoingTab = getByTestId('outgoing-tab');
    fireEvent.press(outgoingTab);

    await waitFor(() => {
      expect(getByText('정다은')).toBeTruthy();
    });

    const cards = getAllByTestId('friend-request-card');
    expect(cards.length).toBe(1);
  });

  test('handles accept request flow', async () => {
    const acceptSpy = jest.spyOn(friendsApi, 'acceptRequest');
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText, getAllByTestId } = render(<FriendsRequestsScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    const acceptButtons = getAllByTestId('accept-button');
    await act(async () => {
      fireEvent.press(acceptButtons[0]!);
    });

    expect(acceptSpy).toHaveBeenCalledWith('req-1');
    expect(alertSpy).toHaveBeenCalledWith('알림', '친구 요청을 수락했습니다.');
  });

  test('handles reject request flow', async () => {
    const rejectSpy = jest.spyOn(friendsApi, 'rejectRequest');
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText, getAllByTestId } = render(<FriendsRequestsScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    const rejectButtons = getAllByTestId('reject-button');
    await act(async () => {
      fireEvent.press(rejectButtons[0]!);
    });

    expect(rejectSpy).toHaveBeenCalledWith('req-1');
    expect(alertSpy).toHaveBeenCalledWith('알림', '친구 요청을 거절했습니다.');
  });

  test('handles cancel request flow in outgoing tab', async () => {
    const cancelSpy = jest.spyOn(friendsApi, 'cancelRequest');
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText, getByTestId, getAllByTestId } = render(<FriendsRequestsScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    const outgoingTab = getByTestId('outgoing-tab');
    fireEvent.press(outgoingTab);

    await waitFor(() => {
      expect(getByText('정다은')).toBeTruthy();
    });

    const cancelButtons = getAllByTestId('cancel-button');
    await act(async () => {
      fireEvent.press(cancelButtons[0]!);
    });

    expect(cancelSpy).toHaveBeenCalledWith('req-3');
    expect(alertSpy).toHaveBeenCalledWith('알림', '보낸 친구 요청을 취소했습니다.');
  });

  test('navigates back on back button press', () => {
    const { getByTestId } = render(<FriendsRequestsScreen />, { wrapper });
    const backBtn = getByTestId('requests-back-button');

    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalled();
  });
});
