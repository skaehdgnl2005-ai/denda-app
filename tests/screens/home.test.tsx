import React from 'react';
import { Alert } from 'react-native';
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

  // S15-mapmode-ui-calendar: "지도로 보기" 진입 버튼 → /schedule/map navigation.
  test('"지도로 보기" 버튼 → router.push(/schedule/map)', async () => {
    mockFetchMyGroups.mockResolvedValue([
      { id: 'g1', name: '5/30 저녁', dates: ['2026-05-30'], confirmedAt: null },
    ]);
    const { findByTestId } = render(<HomeScreen />, { wrapper });
    const btn = await findByTestId('schedule-map-entry');
    fireEvent.press(btn);
    expect(mockPush).toHaveBeenCalledWith('/schedule/map');
  });

  // S24: 알림 버튼 → "준비 중" Alert (실연결은 P1 차기).
  test('알림 버튼 → "준비 중" Alert', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<HomeScreen />, { wrapper });
    await act(async () => {});
    fireEvent.press(getByTestId('notifications-button'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('알림함');
    expect(body).toMatch(/준비 중/);
    alertSpy.mockRestore();
  });
});
