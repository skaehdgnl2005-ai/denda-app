import React from 'react';
import { render } from '@testing-library/react-native';

import { MiniTimeGrid } from './MiniTimeGrid';
import { ThemeProvider } from '@/design/theme';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

// useReducedMotion은 자체 테스트(useReducedMotion.test)로 검증됨 — 여기선 sweep gate 배선만.
jest.mock('@/lib/motion/useReducedMotion', () => ({ useReducedMotion: jest.fn() }));
const mockReduced = useReducedMotion as jest.Mock;

describe('MiniTimeGrid — 온보딩 sweep 데모', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reduce-motion: sweep 타이머 미예약 — 정적 가득 찬 그리드 (W3-5, §6.4)', () => {
    mockReduced.mockReturnValue(true);
    jest.useFakeTimers();
    render(<MiniTimeGrid animated testID="mtg" />, { wrapper: ThemeProvider });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('animated + 모션 허용: sweep 타이머 예약 (애니메이션 동작)', () => {
    mockReduced.mockReturnValue(false);
    jest.useFakeTimers();
    render(<MiniTimeGrid animated testID="mtg" />, { wrapper: ThemeProvider });
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });

  it('animated=false: 애니메이션 미실행 (타이머 없음)', () => {
    mockReduced.mockReturnValue(false);
    jest.useFakeTimers();
    render(<MiniTimeGrid animated={false} testID="mtg" />, { wrapper: ThemeProvider });
    expect(jest.getTimerCount()).toBe(0);
  });
});
