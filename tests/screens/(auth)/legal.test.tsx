// W1-13 — 약관 전문 화면 (이용약관 / 마케팅). privacy.tsx Section 패턴 재사용.
// doc 파라미터로 문서 전환 + 뒤로가기.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LegalScreen from '../../../app/(auth)/legal';
import { ThemeProvider } from '@/design/theme';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider>{children}</ThemeProvider>
  </SafeAreaProvider>
);

const mockBack = jest.fn();
let mockParams: { doc?: string } = {};
jest.mock('expo-router', () => ({
  router: { back: (...a: unknown[]) => mockBack(...a) },
  useLocalSearchParams: () => mockParams,
}));

describe('LegalScreen (약관 전문 화면)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  test('doc=service → 이용약관 전문 렌더', () => {
    mockParams = { doc: 'service' };
    const { getByText } = render(<LegalScreen />, { wrapper });
    expect(getByText('이용약관')).toBeTruthy();
    expect(getByText(/제1조/)).toBeTruthy();
  });

  test('doc=marketing → 마케팅 정보 수신 전문 렌더', () => {
    mockParams = { doc: 'marketing' };
    const { getByText } = render(<LegalScreen />, { wrapper });
    expect(getByText('마케팅 정보 수신 동의')).toBeTruthy();
    expect(getByText(/언제든지/)).toBeTruthy();
  });

  test('알 수 없는 doc → 이용약관으로 폴백', () => {
    mockParams = { doc: 'unknown' };
    const { getByText } = render(<LegalScreen />, { wrapper });
    expect(getByText('이용약관')).toBeTruthy();
  });

  test('뒤로가기 press → router.back()', () => {
    mockParams = { doc: 'service' };
    const { getByLabelText } = render(<LegalScreen />, { wrapper });
    fireEvent.press(getByLabelText('뒤로 가기'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
