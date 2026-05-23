import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FriendRequestCard } from './FriendRequestCard';
import { ThemeProvider } from '@/design/theme';
import { FriendRequest } from '@/lib/friends/api';

describe('FriendRequestCard Component', () => {
  const wrapper = ThemeProvider;

  const mockIncomingRequest: FriendRequest = {
    id: 'req-10',
    sender_id: 'user-20',
    receiver_id: 'current-user',
    sender: { id: 'user-20', nickname: '수신테스트' },
    created_at: '2026-05-23T14:30:00Z', // 23시 30분 KST
  };

  const mockOutgoingRequest: FriendRequest = {
    id: 'req-11',
    sender_id: 'current-user',
    receiver_id: 'user-30',
    receiver: { id: 'user-30', nickname: '발신테스트' },
    created_at: '2026-05-23T10:15:00Z', // 19시 15분 KST
  };

  test('renders incoming request info correctly with KST formatted time', () => {
    const { getByText, queryByTestId } = render(
      <FriendRequestCard
        request={mockIncomingRequest}
        type="incoming"
      />,
      { wrapper }
    );

    expect(getByText('수신테스트')).toBeTruthy();
    // 2026-05-23T14:30:00Z is 2026-05-23 23:30:00 KST
    expect(getByText('2026.05.23 23:30')).toBeTruthy();
    expect(queryByTestId('accept-button')).toBeTruthy();
    expect(queryByTestId('reject-button')).toBeTruthy();
    expect(queryByTestId('cancel-button')).toBeNull();
  });

  test('renders outgoing request info correctly with KST formatted time', () => {
    const { getByText, queryByTestId } = render(
      <FriendRequestCard
        request={mockOutgoingRequest}
        type="outgoing"
      />,
      { wrapper }
    );

    expect(getByText('발신테스트')).toBeTruthy();
    // 2026-05-23T10:15:00Z is 2026-05-23 19:15:00 KST
    expect(getByText('2026.05.23 19:15')).toBeTruthy();
    expect(queryByTestId('cancel-button')).toBeTruthy();
    expect(queryByTestId('accept-button')).toBeNull();
    expect(queryByTestId('reject-button')).toBeNull();
  });

  test('calls onAccept and onReject for incoming requests', () => {
    const handleAccept = jest.fn();
    const handleReject = jest.fn();

    const { getByTestId } = render(
      <FriendRequestCard
        request={mockIncomingRequest}
        type="incoming"
        onAccept={handleAccept}
        onReject={handleReject}
      />,
      { wrapper }
    );

    fireEvent.press(getByTestId('accept-button'));
    expect(handleAccept).toHaveBeenCalledWith(mockIncomingRequest);

    fireEvent.press(getByTestId('reject-button'));
    expect(handleReject).toHaveBeenCalledWith(mockIncomingRequest);
  });

  test('calls onCancel for outgoing requests', () => {
    const handleCancel = jest.fn();

    const { getByTestId } = render(
      <FriendRequestCard
        request={mockOutgoingRequest}
        type="outgoing"
        onCancel={handleCancel}
      />,
      { wrapper }
    );

    fireEvent.press(getByTestId('cancel-button'));
    expect(handleCancel).toHaveBeenCalledWith(mockOutgoingRequest);
  });
});
