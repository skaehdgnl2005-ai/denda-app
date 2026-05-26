import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FriendCard } from './FriendCard';
import { ThemeProvider } from '@/design/theme';

describe('FriendCard Component', () => {
  const wrapper = ThemeProvider;

  const mockFriend = {
    id: 'user-99',
    nickname: '테스트유저',
    recent_meetings_count: 3,
  };

  test('renders nickname and meeting count correctly', () => {
    const handleMakeGroup = jest.fn();
    const handleMore = jest.fn();

    const { getByText } = render(
      <FriendCard friend={mockFriend} onMakeGroup={handleMakeGroup} onMore={handleMore} />,
      { wrapper },
    );

    expect(getByText('테스트유저')).toBeTruthy();
    expect(getByText('최근 모임 3회')).toBeTruthy();
  });

  test('calls onMakeGroup when CTA button is pressed', () => {
    const handleMakeGroup = jest.fn();
    const handleMore = jest.fn();

    const { getByTestId } = render(
      <FriendCard friend={mockFriend} onMakeGroup={handleMakeGroup} onMore={handleMore} />,
      { wrapper },
    );

    const ctaButton = getByTestId('make-group-button');
    fireEvent.press(ctaButton);

    expect(handleMakeGroup).toHaveBeenCalledTimes(1);
    expect(handleMakeGroup).toHaveBeenCalledWith(mockFriend);
  });

  test('calls onMore when more button is pressed', () => {
    const handleMakeGroup = jest.fn();
    const handleMore = jest.fn();

    const { getByTestId } = render(
      <FriendCard friend={mockFriend} onMakeGroup={handleMakeGroup} onMore={handleMore} />,
      { wrapper },
    );

    const moreButton = getByTestId('more-button');
    fireEvent.press(moreButton);

    expect(handleMore).toHaveBeenCalledTimes(1);
    expect(handleMore).toHaveBeenCalledWith(mockFriend);
  });
});
