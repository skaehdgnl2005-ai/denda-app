// S17 CP4 — 약관 동의 화면 smoke.
// 검증: 3 약관 렌더 + 필수 gate(CTA disabled until 필수 둘 다) + "모두 동의하기" toggle +
//       agreeToTerms 호출 + router.replace 흐름.

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import TermsScreen from '../../../app/(auth)/terms';
import { ThemeProvider } from '@/design/theme';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

const mockAgreeToTerms = jest.fn();
jest.mock('@/lib/auth/setup', () => ({
  authStore: { getState: () => ({ agreeToTerms: mockAgreeToTerms }) },
}));

describe('TermsScreen', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgreeToTerms.mockReset();
    mockAgreeToTerms.mockResolvedValue(undefined);
  });

  test('3 약관 + "모두 동의하기" + CTA 렌더', () => {
    const { getByLabelText } = render(<TermsScreen />, { wrapper });
    expect(getByLabelText('필수 이용약관 동의')).toBeTruthy();
    expect(getByLabelText('필수 개인정보 수집 및 이용 동의')).toBeTruthy();
    expect(getByLabelText('선택 마케팅 정보 수신 동의')).toBeTruthy();
    expect(getByLabelText('모두 동의하기')).toBeTruthy();
    expect(getByLabelText('동의하고 계속')).toBeTruthy();
  });

  test('필수 미동의 시 CTA disabled + 안내 텍스트 노출', () => {
    const { getByLabelText, getByText } = render(<TermsScreen />, { wrapper });
    const cta = getByLabelText('동의하고 계속');
    expect(cta.props.accessibilityState?.disabled).toBe(true);
    expect(getByText(/필수 약관에 동의하면 시작할 수 있어요/)).toBeTruthy();
  });

  test('필수 둘 다 체크 → CTA enabled + 안내 사라짐', () => {
    const { getByLabelText, queryByText } = render(<TermsScreen />, { wrapper });
    fireEvent.press(getByLabelText('필수 이용약관 동의'));
    fireEvent.press(getByLabelText('필수 개인정보 수집 및 이용 동의'));
    const cta = getByLabelText('동의하고 계속');
    expect(cta.props.accessibilityState?.disabled).toBe(false);
    expect(queryByText(/필수 약관에 동의하면/)).toBeNull();
  });

  test('"모두 동의하기" press → 3개 모두 체크', () => {
    const { getByLabelText } = render(<TermsScreen />, { wrapper });
    fireEvent.press(getByLabelText('모두 동의하기'));
    expect(getByLabelText('필수 이용약관 동의').props.accessibilityState?.checked).toBe(true);
    expect(
      getByLabelText('필수 개인정보 수집 및 이용 동의').props.accessibilityState?.checked,
    ).toBe(true);
    expect(getByLabelText('선택 마케팅 정보 수신 동의').props.accessibilityState?.checked).toBe(
      true,
    );
    expect(getByLabelText('모두 동의하기').props.accessibilityState?.checked).toBe(true);
  });

  test('"모두 동의하기" 두 번 → 전체 해제', () => {
    const { getByLabelText } = render(<TermsScreen />, { wrapper });
    fireEvent.press(getByLabelText('모두 동의하기'));
    fireEvent.press(getByLabelText('모두 동의하기'));
    expect(getByLabelText('모두 동의하기').props.accessibilityState?.checked).toBe(false);
    expect(getByLabelText('필수 이용약관 동의').props.accessibilityState?.checked).toBe(false);
  });

  test('필수 미동의 시 CTA press → agreeToTerms 호출 없음', () => {
    const { getByLabelText } = render(<TermsScreen />, { wrapper });
    fireEvent.press(getByLabelText('동의하고 계속'));
    expect(mockAgreeToTerms).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('"개인정보 처리방침 전문 보기" press → router.push(/(auth)/privacy) — A-6 PIPA', () => {
    const { getByLabelText } = render(<TermsScreen />, { wrapper });
    fireEvent.press(getByLabelText('개인정보 처리방침 전문 보기'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/privacy');
  });

  test('필수 동의 후 CTA press → agreeToTerms + router.replace(onboarding)', async () => {
    const { getByLabelText } = render(<TermsScreen />, { wrapper });
    fireEvent.press(getByLabelText('필수 이용약관 동의'));
    fireEvent.press(getByLabelText('필수 개인정보 수집 및 이용 동의'));
    fireEvent.press(getByLabelText('동의하고 계속'));
    await waitFor(() => expect(mockAgreeToTerms).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
  });
});
