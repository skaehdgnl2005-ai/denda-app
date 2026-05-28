// S17 CP4 — 3 슬라이드 온보딩 smoke.
// 검증: 첫 슬라이드 mount + "건너뛰기" complete 경로 + 페이지 전환 시 CTA "시작하기" 변경 +
//       마지막 슬라이드에서 CTA press → completeOnboarding + router.replace.

import React from 'react';
import { Dimensions, ScrollView } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import OnboardingScreen from '../../../app/(auth)/onboarding';
import { ThemeProvider } from '@/design/theme';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

const mockCompleteOnboarding = jest.fn();
jest.mock('@/lib/auth/setup', () => ({
  authStore: { getState: () => ({ completeOnboarding: mockCompleteOnboarding }) },
}));

// 미니 시각 컴포넌트는 디자인 시스템 의존 — render는 ThemeProvider로 충분.
// Reanimated worklet은 jest-expo + jest.setup.js가 mock 처리.

describe('OnboardingScreen', () => {
  const wrapper = ThemeProvider;
  const width = Dimensions.get('window').width;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCompleteOnboarding.mockReset();
    mockCompleteOnboarding.mockResolvedValue(undefined);
  });

  test('첫 슬라이드 mount → 시간 카피 + "다음" CTA + "건너뛰기"', () => {
    const { getByText, getByLabelText } = render(<OnboardingScreen />, { wrapper });
    expect(getByText('친구와 시간을 맞춰요')).toBeTruthy();
    expect(getByLabelText('다음')).toBeTruthy();
    expect(getByLabelText('건너뛰기')).toBeTruthy();
  });

  test('"건너뛰기" press → completeOnboarding + router.replace("/(tabs)")', async () => {
    const { getByLabelText } = render(<OnboardingScreen />, { wrapper });
    fireEvent.press(getByLabelText('건너뛰기'));
    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  test('마지막 슬라이드로 scroll → CTA 라벨 "시작하기"로 변경', async () => {
    const { UNSAFE_getAllByType, getByLabelText } = render(<OnboardingScreen />, { wrapper });
    const scrollView = UNSAFE_getAllByType(ScrollView)[0]!;
    fireEvent(scrollView, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: width * 2, y: 0 },
        contentSize: { width: width * 3, height: 800 },
        layoutMeasurement: { width, height: 800 },
      },
    });
    await waitFor(() => expect(getByLabelText('시작하기')).toBeTruthy());
  });

  test('마지막 슬라이드에서 "시작하기" press → completeOnboarding + replace', async () => {
    const { UNSAFE_getAllByType, findByLabelText } = render(<OnboardingScreen />, { wrapper });
    const scrollView = UNSAFE_getAllByType(ScrollView)[0]!;
    fireEvent(scrollView, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: width * 2, y: 0 },
        contentSize: { width: width * 3, height: 800 },
        layoutMeasurement: { width, height: 800 },
      },
    });
    const cta = await findByLabelText('시작하기');
    fireEvent.press(cta);
    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  test('completeOnboarding 진행 중 중복 press → 한 번만 호출', async () => {
    let resolveComplete: () => void = () => {};
    mockCompleteOnboarding.mockImplementation(
      () => new Promise<void>((resolve) => (resolveComplete = resolve)),
    );
    const { getByLabelText } = render(<OnboardingScreen />, { wrapper });
    const skip = getByLabelText('건너뛰기');
    fireEvent.press(skip);
    fireEvent.press(skip);
    fireEvent.press(skip);
    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    resolveComplete();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });
});
