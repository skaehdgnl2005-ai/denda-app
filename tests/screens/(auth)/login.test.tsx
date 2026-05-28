// S17 CP4 — 카카오 OIDC 로그인 화면 smoke.
// 검증: signIn 호출 + router.replace, AuthError 분기(cancelled/network/일반), lastError 노출,
//       authenticating 상태 disabled. 그리드/Naver SDK 등 native 모듈 무접촉.

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import LoginScreen from '../../../app/(auth)/login';
import { ThemeProvider } from '@/design/theme';
import { AuthError, type AuthProviderError } from '@/lib/auth/AuthProvider';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

let mockStatus: 'signed_out' | 'authenticating' = 'signed_out';
let mockLastError: AuthProviderError | null = null;
const mockSignIn = jest.fn();
jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(sel: (s: { status: string; lastError: AuthProviderError | null }) => T) =>
    sel({ status: mockStatus, lastError: mockLastError }),
  authStore: { getState: () => ({ signIn: mockSignIn }) },
}));

describe('LoginScreen', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'signed_out';
    mockLastError = null;
    mockSignIn.mockReset();
  });

  test('카카오 버튼 + 약관 안내 렌더', () => {
    const { getByLabelText, getByText } = render(<LoginScreen />, { wrapper });
    expect(getByLabelText('카카오로 시작하기')).toBeTruthy();
    expect(getByText(/계속하면 이용약관과 개인정보 처리방침에/)).toBeTruthy();
  });

  test('press → signIn 호출 + 성공 시 router.replace("/")', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByLabelText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByLabelText('카카오로 시작하기'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  test('AuthError(cancelled) → silent (Alert 호출 없음, replace 안 함)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockSignIn.mockRejectedValueOnce(new AuthError({ kind: 'cancelled' }));
    const { getByLabelText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByLabelText('카카오로 시작하기'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test('AuthError(network) → Alert "로그인 실패" + 에러 메시지', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockSignIn.mockRejectedValueOnce(
      new AuthError({ kind: 'network', message: '네트워크가 끊겼어요' }),
    );
    const { getByLabelText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByLabelText('카카오로 시작하기'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('로그인 실패');
    expect(body).toBe('네트워크가 끊겼어요');
    alertSpy.mockRestore();
  });

  test('일반 Error → "로그인 중 알 수 없는 오류가 발생했어요." Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockSignIn.mockRejectedValueOnce(new Error('boom'));
    const { getByLabelText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByLabelText('카카오로 시작하기'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('로그인 실패');
    expect(body).toBe('로그인 중 알 수 없는 오류가 발생했어요.');
    alertSpy.mockRestore();
  });

  test('lastError(network) → 친근체 에러 텍스트 노출', () => {
    mockLastError = { kind: 'network', message: '...' };
    const { getByText } = render(<LoginScreen />, { wrapper });
    expect(getByText(/네트워크가 불안정해요/)).toBeTruthy();
  });

  test('status=authenticating → 버튼 disabled 상태', () => {
    mockStatus = 'authenticating';
    const { getByLabelText } = render(<LoginScreen />, { wrapper });
    const btn = getByLabelText('카카오로 시작하기');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });
});
