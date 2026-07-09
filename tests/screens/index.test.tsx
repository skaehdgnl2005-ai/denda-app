// 라우팅 게이트 splash — W1-11: 다크에서 흰 flash 제거(surface-0 배경 + BrandMark + Spinner).
import React from 'react';
import { render } from '@testing-library/react-native';

import IndexRoute from '../../app/index';
import { ThemeProvider } from '@/design/theme';

jest.mock('expo-router', () => ({
  Redirect: (): null => null,
}));

jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(
    sel: (s: { status: string; hasAgreedToTerms: boolean; hasCompletedOnboarding: boolean }) => T,
  ) => sel({ status: 'initializing', hasAgreedToTerms: false, hasCompletedOnboarding: false }),
}));

describe('IndexRoute splash', () => {
  it('initializing → splash-gate 렌더(무색 ActivityIndicator 아님)', () => {
    const { getByTestId, getByLabelText } = render(<IndexRoute />, { wrapper: ThemeProvider });
    expect(getByTestId('splash-gate')).toBeTruthy();
    // §11.1 스펙 Spinner(progressbar '불러오는 중') — 무색 ActivityIndicator 대체 확인
    expect(getByLabelText('불러오는 중')).toBeTruthy();
  });
});
