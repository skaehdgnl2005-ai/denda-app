import React from 'react';
import { render } from '@testing-library/react-native';

import { ConfirmedTimeCard } from './ConfirmedTimeCard';
import { ThemeProvider } from '@/design/theme';

describe('ConfirmedTimeCard', () => {
  const wrapper = ThemeProvider;

  test('UTC ISO → KST 날짜·요일·시간 포맷', () => {
    // 2026-06-01 (월) KST 19:00 = 2026-06-01T10:00:00Z UTC
    // 21:00 KST = 2026-06-01T12:00:00Z UTC
    const { getByText } = render(
      <ConfirmedTimeCard
        startAtUtc="2026-06-01T10:00:00.000Z"
        endAtUtc="2026-06-01T12:00:00.000Z"
      />,
      { wrapper },
    );
    // M월 D일 (요일) HH:mm ~ HH:mm — 정확 포맷은 자유, 핵심은 KST 변환 + 한국어 요일
    expect(getByText(/2026/)).toBeTruthy();
    expect(getByText(/19:00/)).toBeTruthy();
    expect(getByText(/21:00/)).toBeTruthy();
    // 2026-06-01은 월요일
    expect(getByText(/월/)).toBeTruthy();
  });

  test('자정 직전 (23:45) 정확히 표시', () => {
    // 2026-06-01 23:45 KST = 2026-06-01T14:45:00Z
    const { getByText } = render(
      <ConfirmedTimeCard
        startAtUtc="2026-06-01T14:45:00.000Z"
        endAtUtc="2026-06-01T15:00:00.000Z"
      />,
      { wrapper },
    );
    expect(getByText(/23:45/)).toBeTruthy();
    expect(getByText(/00:00/)).toBeTruthy();
  });

  test('한국어 라벨 "확정된 시간" 노출', () => {
    const { getByText } = render(
      <ConfirmedTimeCard
        startAtUtc="2026-06-01T10:00:00.000Z"
        endAtUtc="2026-06-01T12:00:00.000Z"
      />,
      { wrapper },
    );
    expect(getByText('확정된 시간')).toBeTruthy();
  });
});
