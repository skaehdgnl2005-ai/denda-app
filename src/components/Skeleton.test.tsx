import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';

import { Skeleton } from './Skeleton';
import { ThemeProvider } from '@/design/theme';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

jest.mock('@/lib/motion/useReducedMotion');
const mockReduced = useReducedMotion as jest.Mock;

const wrapper = ThemeProvider;

describe('Skeleton', () => {
  beforeEach(() => {
    mockReduced.mockReturnValue(false);
  });

  test('testID로 렌더된다', () => {
    const { getByTestId } = render(<Skeleton testID="sk" height={20} />, { wrapper });
    expect(getByTestId('sk')).toBeTruthy();
  });

  test('스크린리더 포커스에서 제외된다 (장식 요소)', () => {
    const { getByTestId } = render(<Skeleton testID="sk" />, { wrapper });
    expect(getByTestId('sk').props.accessible).toBe(false);
  });

  test('언마운트해도 throw 하지 않는다 (애니메이션 cleanup)', () => {
    const { unmount } = render(<Skeleton testID="sk" />, { wrapper });
    expect(() => unmount()).not.toThrow();
  });

  test('펄스는 700ms 하드코딩이 아닌 duration.long(400)을 쓴다 (§11.1)', () => {
    jest.spyOn(Animated, 'loop').mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
    } as never);
    const timingSpy = jest.spyOn(Animated, 'timing');
    render(<Skeleton testID="sk" />, { wrapper });
    const durations = timingSpy.mock.calls.map((c) => (c[1] as { duration?: number }).duration);
    expect(durations).toContain(400);
    expect(durations).not.toContain(700);
  });

  test('모션 감소 시 loop 애니메이션을 시작하지 않고 정적 표시한다 (§6.4)', () => {
    mockReduced.mockReturnValue(true);
    const loopSpy = jest.spyOn(Animated, 'loop');
    const { getByTestId } = render(<Skeleton testID="sk" />, { wrapper });
    expect(getByTestId('sk')).toBeTruthy();
    expect(loopSpy).not.toHaveBeenCalled();
  });
});
