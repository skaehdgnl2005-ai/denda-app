// A-6 — 개인정보 처리방침 화면 smoke. 필수 섹션 8개 헤더 렌더 + back 버튼.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import PrivacyScreen from '../../../app/(auth)/privacy';
import { ThemeProvider } from '@/design/theme';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: () => mockBack() },
}));

describe('PrivacyScreen', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    mockBack.mockReset();
  });

  test('PIPA 필수 8 섹션 헤더 렌더', () => {
    const { getByText } = render(<PrivacyScreen />, { wrapper });
    expect(getByText('1. 수집하는 개인정보 항목')).toBeTruthy();
    expect(getByText('2. 개인정보의 이용 목적')).toBeTruthy();
    expect(getByText('3. 보유·이용 기간')).toBeTruthy();
    expect(getByText('4. 제3자 제공')).toBeTruthy();
    expect(getByText('5. 처리 위탁')).toBeTruthy();
    expect(getByText('6. 정보주체의 권리')).toBeTruthy();
    expect(getByText('7. iOS 앱 추적 투명성(ATT)')).toBeTruthy();
    expect(getByText('8. 개인정보 보호책임자')).toBeTruthy();
  });

  test('IP/UA 해시 수집 항목 명시 (Apple ATT + D28 정합)', () => {
    const { getByText } = render(<PrivacyScreen />, { wrapper });
    expect(getByText(/IP 주소 및 User-Agent의 해시값/)).toBeTruthy();
  });

  test('위탁 5종 전부 명시 (Supabase/Expo/Naver/Google/Apple)', () => {
    const { getByText } = render(<PrivacyScreen />, { wrapper });
    expect(getByText('Supabase')).toBeTruthy();
    expect(getByText('Expo (EAS Push)')).toBeTruthy();
    expect(getByText('네이버 클라우드')).toBeTruthy();
    expect(getByText('Google (Gemini)')).toBeTruthy();
    expect(getByText('Apple / Google')).toBeTruthy();
  });

  test('back 버튼 press → router.back', () => {
    const { getByLabelText } = render(<PrivacyScreen />, { wrapper });
    fireEvent.press(getByLabelText('뒤로 가기'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
