import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Cell, cellBackgroundColor } from './Cell';
import { ThemeProvider } from '../../design/theme';
import { tokens } from '../../design/tokens';

let mockReduced = false;
jest.mock('../../lib/motion/useReducedMotion', () => ({
  useReducedMotion: (): boolean => mockReduced,
}));

const L = tokens.light;
const wrapper = ThemeProvider;
const bgOf = (node: { props: { [k: string]: unknown } }): unknown =>
  (StyleSheet.flatten(node.props.style as never) as { backgroundColor?: unknown }).backgroundColor;

describe('Cell Component', () => {
  beforeEach(() => {
    mockReduced = false;
  });

  test('renders heat states correctly with heat colors from tokens (fresh mount = 정적 색)', () => {
    // 색은 이제 애니메이션 배경 레이어(`${testID}-bg`)에 적용된다 (W2-6). 신규 마운트는
    // 전환 애니메이션이 없어 정적 색 → 각 state를 fresh mount로 검증 (rerender는 전환 유발).
    const cases: [React.ComponentProps<typeof Cell>['state'], string][] = [
      ['empty', L.heat[0]],
      ['heat-0', L.heat[0]],
      ['heat-1', L.heat[1]],
      ['heat-2', L.heat[2]],
      ['heat-3', L.heat[3]],
      ['heat-4', L.heat[4]],
    ];
    cases.forEach(([state, color]) => {
      const { getByTestId, unmount } = render(
        <Cell state={state} count={0} isHeader={false} testID="grid-cell" />,
        { wrapper },
      );
      expect(bgOf(getByTestId('grid-cell-bg'))).toBe(color);
      unmount();
    });
  });

  test('renders self selected state correctly with brand colors and icons', () => {
    const { getByTestId, getByText } = render(
      <Cell state="self" count={3} isHeader={false} testID="grid-cell" />,
      { wrapper },
    );
    // self 배경은 brand-50 (배경 레이어). brand-500 ring은 inner absolute View로 분리.
    expect(bgOf(getByTestId('grid-cell-bg'))).toBe(L.brand[50]);

    const countText = getByText('3');
    expect(countText).toBeTruthy();
    expect(countText.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontVariant: ['tabular-nums'] })]),
    );
  });

  test('cellBackgroundColor 순수 함수 색 계약(heat ramp + self)', () => {
    expect(cellBackgroundColor('empty', L)).toBe(L.heat[0]);
    expect(cellBackgroundColor('heat-0', L)).toBe(L.heat[0]);
    expect(cellBackgroundColor('heat-4', L)).toBe(L.heat[4]);
    expect(cellBackgroundColor('self', L)).toBe(L.brand[50]);
    // 다크 램프도 독립 검증
    expect(cellBackgroundColor('heat-4', tokens.dark)).toBe(tokens.dark.heat[4]);
  });

  test('defines hitSlop to reach 44pt touch target from 16pt visual height (alignment fix 2026-06-08)', () => {
    const { getByTestId } = render(
      <Cell state="empty" count={0} isHeader={false} testID="grid-cell" />,
      { wrapper },
    );
    const hitSlop = getByTestId('grid-cell').props.hitSlop;
    expect(hitSlop).toBeDefined();
    if (hitSlop) {
      expect(hitSlop.top).toBeGreaterThanOrEqual(14);
      expect(hitSlop.bottom).toBeGreaterThanOrEqual(14);
      expect(16 + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(44);
    }
  });

  test('renders header cell properly', () => {
    const { getByText } = render(
      <Cell state="empty" count={0} isHeader={true} label="Header text" />,
      { wrapper },
    );
    expect(getByText('Header text')).toBeTruthy();
  });

  test('W2-7a — a11y 라벨에 날짜·시간·인원 주입 (§12.3)', () => {
    // slotIndex 42 → 09:00 + 42*15분 = 19:30
    const { getByTestId, rerender } = render(
      <Cell state="heat-2" count={3} isHeader={false} testID="c" slotIndex={42} dayLabel="7/8" />,
      { wrapper },
    );
    expect(getByTestId('c').props.accessibilityLabel).toBe('7/8 19시 30분, 3명 가능');

    rerender(
      <Cell state="empty" count={0} isHeader={false} testID="c" slotIndex={0} dayLabel="7/8" />,
    );
    expect(getByTestId('c').props.accessibilityLabel).toBe('7/8 9시, 투표 없음');

    rerender(
      <Cell state="self" count={5} isHeader={false} testID="c" slotIndex={4} dayLabel="7/9" />,
    );
    expect(getByTestId('c').props.accessibilityLabel).toBe('7/9 10시, 본인 선택, 5명 가능');
  });

  test('W2-6 — heat-4 진입은 xLong+emphasized 축하 모션', () => {
    const timingSpy = jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({ start: jest.fn() } as unknown as Animated.CompositeAnimation);
    const { rerender } = render(<Cell state="heat-3" count={3} isHeader={false} testID="c" />, {
      wrapper,
    });
    timingSpy.mockClear();
    rerender(<Cell state="heat-4" count={5} isHeader={false} testID="c" />);
    expect(timingSpy).toHaveBeenCalled();
    const cfg = timingSpy.mock.calls.at(-1)?.[1] as { duration: number } | undefined;
    expect(cfg?.duration).toBe(tokens.duration.xLong);
    timingSpy.mockRestore();
  });

  test('W2-6 — 한 단계 색 변화는 short 전환(축하 아님)', () => {
    const timingSpy = jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({ start: jest.fn() } as unknown as Animated.CompositeAnimation);
    const { rerender } = render(<Cell state="heat-1" count={1} isHeader={false} testID="c" />, {
      wrapper,
    });
    timingSpy.mockClear();
    rerender(<Cell state="heat-2" count={2} isHeader={false} testID="c" />);
    const cfg = timingSpy.mock.calls.at(-1)?.[1] as { duration: number } | undefined;
    expect(cfg?.duration).toBe(tokens.duration.short);
    expect(cfg?.duration).not.toBe(tokens.duration.xLong);
    timingSpy.mockRestore();
  });

  test('W2-6 — reduce-motion 시 축하 모션 없이 즉시 스냅', () => {
    mockReduced = true;
    const timingSpy = jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({ start: jest.fn() } as unknown as Animated.CompositeAnimation);
    const { rerender } = render(<Cell state="heat-3" count={3} isHeader={false} testID="c" />, {
      wrapper,
    });
    timingSpy.mockClear();
    rerender(<Cell state="heat-4" count={5} isHeader={false} testID="c" />);
    expect(timingSpy).not.toHaveBeenCalled();
    timingSpy.mockRestore();
  });
});
