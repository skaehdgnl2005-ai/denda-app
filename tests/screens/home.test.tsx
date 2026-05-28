import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import HomeScreen from '../../app/(tabs)/index';
import { ThemeProvider } from '@/design/theme';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/lib/auth/setup', () => ({
  useAuth: (sel: (s: unknown) => unknown) => sel({ session: { user: { nickname: '민지' } } }),
}));

const mockFetchMyGroups = jest.fn();
jest.mock('@/lib/groups/list', () => ({
  fetchMyGroups: () => mockFetchMyGroups(),
}));

describe('HomeScreen', () => {
  const wrapper = ThemeProvider;
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMyGroups.mockReset();
  });

  test('"새 모임 만들기" CTA → router.push(/group/new)', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { getByTestId } = render(<HomeScreen />, { wrapper });
    await act(async () => {});
    fireEvent.press(getByTestId('create-group-card'));
    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });

  test('모임 있으면 카드 렌더 + 탭 시 그리드로 push', async () => {
    mockFetchMyGroups.mockResolvedValue([
      { id: 'g1', name: '5/30 저녁', dates: ['2026-05-30'], confirmedAt: null },
    ]);
    const { findByTestId } = render(<HomeScreen />, { wrapper });
    const card = await findByTestId('my-group-g1');
    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith('/group/g1');
  });

  test('모임 없으면 빈 상태 노출', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { findByText } = render(<HomeScreen />, { wrapper });
    expect(await findByText('잡힌 모임이 아직 없어요')).toBeTruthy();
  });
});
