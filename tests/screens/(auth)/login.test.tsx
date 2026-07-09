// S17 CP4 — 카카오 OIDC 로그인 화면 smoke.
// 검증: signIn 호출 + router.replace, AuthError 분기(cancelled/network/일반), lastError 노출,
//       authenticating 상태 disabled. 그리드/Naver SDK 등 native 모듈 무접촉.

import React from 'react';
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

  test('AuthError(cancelled) → silent (replace 안 함)', async () => {
    mockSignIn.mockRejectedValueOnce(new AuthError({ kind: 'cancelled' }));
    const { getByLabelText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByLabelText('카카오로 시작하기'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // W1-4: 실패는 시스템 Alert 이중화 제거 → replace 없이 lastError 인라인 에러(아래 테스트)로만 표출.
  test('signIn 실패 → 네비게이션 없음 (실패 표출은 lastError 인라인)', async () => {
    mockSignIn.mockRejectedValueOnce(
      new AuthError({ kind: 'network', message: '네트워크가 끊겼어요' }),
    );
    const { getByLabelText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByLabelText('카카오로 시작하기'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
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
