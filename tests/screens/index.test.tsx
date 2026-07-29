// 라우팅 게이트 splash — W1-11: 다크에서 흰 flash 제거(surface-0 배경 + BrandMark + Spinner).
// 2026-07-29: 닉네임 단계 redirect 배선 추가. 분기 로직 자체는 src/lib/auth/gate.test.ts가
// 검증하고, 여기서는 각 결정이 실제로 어느 라우트로 이어지는지(배선)만 본다.
import React from 'react';
import { render } from '@testing-library/react-native';

import IndexRoute from '../../app/index';
import { ThemeProvider } from '@/design/theme';

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }): null => {
    mockRedirect(props.href);
    return null;
  },
}));

type MockAuthState = {
  status: string;
  hasAgreedToTerms: boolean;
  hasCompletedOnboarding: boolean;
  session: { user: { nicknameSetAt?: string | null } } | null;
};

let mockAuthState: MockAuthState = {
  status: 'initializing',
  hasAgreedToTerms: false,
  hasCompletedOnboarding: false,
  session: null,
};

jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(sel: (s: MockAuthState) => T) => sel(mockAuthState),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = {
    status: 'initializing',
    hasAgreedToTerms: false,
    hasCompletedOnboarding: false,
    session: null,
  };
});

describe('IndexRoute splash', () => {
  it('initializing → splash-gate 렌더(무색 ActivityIndicator 아님)', () => {
    const { getByTestId, getByLabelText } = render(<IndexRoute />, { wrapper: ThemeProvider });
    expect(getByTestId('splash-gate')).toBeTruthy();
    // §11.1 스펙 Spinner(progressbar '불러오는 중') — 무색 ActivityIndicator 대체 확인
    expect(getByLabelText('불러오는 중')).toBeTruthy();
  });
});

describe('IndexRoute redirect 배선', () => {
  it('닉네임 미설정(null) → /(auth)/nickname', () => {
    mockAuthState = {
      status: 'signed_in',
      hasAgreedToTerms: true,
      hasCompletedOnboarding: true,
      session: { user: { nicknameSetAt: null } },
    };

    render(<IndexRoute />, { wrapper: ThemeProvider });

    expect(mockRedirect).toHaveBeenCalledWith('/(auth)/nickname');
  });

  it('프로필 조회 전(undefined) → 닉네임 화면으로 보내지 않는다', () => {
    mockAuthState = {
      status: 'signed_in',
      hasAgreedToTerms: true,
      hasCompletedOnboarding: true,
      session: { user: {} },
    };

    render(<IndexRoute />, { wrapper: ThemeProvider });

    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
  });

  it('닉네임 설정 완료 + 온보딩 미완료 → /(auth)/onboarding', () => {
    mockAuthState = {
      status: 'signed_in',
      hasAgreedToTerms: true,
      hasCompletedOnboarding: false,
      session: { user: { nicknameSetAt: '2026-07-29T00:00:00Z' } },
    };

    render(<IndexRoute />, { wrapper: ThemeProvider });

    expect(mockRedirect).toHaveBeenCalledWith('/(auth)/onboarding');
  });
});
