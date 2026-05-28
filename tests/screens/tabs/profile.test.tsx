import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import ProfileScreen from '../../../app/(tabs)/profile';
import { ThemeProvider } from '@/design/theme';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
}));

const mockSignOut = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(selector: (s: { session: { user: { id: string; nickname: string } } }) => T) =>
    selector({ session: { user: { id: 'user-1', nickname: '민지' } } }),
  authStore: { getState: () => ({ signOut: () => mockSignOut() }) },
}));

// S06 reauth helpers — false 반환으로 ReauthModal 미노출.
jest.mock('@/lib/calendar/reauth', () => ({
  isGoogleReauthNeeded: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/lib/calendar/setup', () => ({
  createGoogleCalendarProvider: jest.fn(),
  signInGoogleAndUpload: jest.fn(),
}));

// supabase client mock — env throw 회피.
jest.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: jest.fn().mockResolvedValue({ data: null, error: null }) },
}));

describe('ProfileScreen — S24 dead-end onPress', () => {
  const wrapper = ThemeProvider;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('알림 설정 행 → "준비 중" Alert', async () => {
    const { getByTestId } = render(<ProfileScreen />, { wrapper });
    await waitFor(() => expect(getByTestId('notifications-row')).toBeTruthy());
    fireEvent.press(getByTestId('notifications-row'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('알림 설정');
    expect(body).toMatch(/준비 중/);
  });

  test('신고·차단 관리 행 → "준비 중" + 친구 카드 안내', async () => {
    const { getByTestId } = render(<ProfileScreen />, { wrapper });
    await waitFor(() => expect(getByTestId('reports-row')).toBeTruthy());
    fireEvent.press(getByTestId('reports-row'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('신고·차단 관리');
    expect(body).toMatch(/친구 카드/);
  });

  test('화면 모드 행 → "기기 설정" 안내 (D6)', async () => {
    const { getByTestId } = render(<ProfileScreen />, { wrapper });
    await waitFor(() => expect(getByTestId('theme-row')).toBeTruthy());
    fireEvent.press(getByTestId('theme-row'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('화면 모드');
    expect(body).toMatch(/기기 설정/);
  });

  test('에브리타임 import 행은 onPress route (기존 동작 회귀 방지)', async () => {
    // 정상 동작은 router.push — Alert는 호출되지 않아야 함.
    const { getByTestId } = render(<ProfileScreen />, { wrapper });
    await waitFor(() => expect(getByTestId('everytime-import-link')).toBeTruthy());
    fireEvent.press(getByTestId('everytime-import-link'));
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
