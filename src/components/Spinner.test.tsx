import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';

import { Spinner } from './Spinner';
import { ThemeProvider } from '@/design/theme';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

jest.mock('@/lib/motion/useReducedMotion');
const mockReduced = useReducedMotion as jest.Mock;
const wrapper = ThemeProvider;

describe('Spinner (§11.1)', () => {
  beforeEach(() => mockReduced.mockReturnValue(false));

  test('a11y: progressbar 역할 + "불러오는 중" 라벨', () => {
    const { getByTestId } = render(<Spinner testID="sp" />, { wrapper });
    const el = getByTestId('sp');
    expect(el.props.accessibilityRole).toBe('progressbar');
    expect(el.props.accessibilityLabel).toBe('불러오는 중');
  });

  test('1초 linear 회전 애니메이션을 돌린다 (모션 켜짐)', () => {
    const timingSpy = jest.spyOn(Animated, 'timing');
    jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn() } as never);
    render(<Spinner testID="sp" />, { wrapper });
    const durations = timingSpy.mock.calls.map((c) => (c[1] as { duration?: number }).duration);
    expect(durations).toContain(1000);
  });

  test('모션 감소 시 회전을 시작하지 않고 정적 표시한다 (§6.4)', () => {
    mockReduced.mockReturnValue(true);
    const loopSpy = jest.spyOn(Animated, 'loop');
    const { getByTestId } = render(<Spinner testID="sp" />, { wrapper });
    expect(getByTestId('sp')).toBeTruthy();
    expect(loopSpy).not.toHaveBeenCalled();
  });

  test('언마운트해도 throw 하지 않는다', () => {
    const { unmount } = render(<Spinner testID="sp" />, { wrapper });
    expect(() => unmount()).not.toThrow();
  });

  test('decorative면 스크린리더에서 무음 처리된다 (임베드용, 리뷰 #6)', () => {
    const { getByTestId } = render(<Spinner testID="sp" decorative />, { wrapper });
    const el = getByTestId('sp');
    expect(el.props.accessible).toBe(false);
    expect(el.props.accessibilityRole).toBeUndefined();
  });
});
