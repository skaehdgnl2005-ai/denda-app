// W2-3 — 중앙 '모임 만들기' FAB (§10.7). Lucide 캘린더+더하기 코드 합성(자산 0, D40 선례).
// 56pt radius-md(둥근 사각형·원형 아님) brand-500 e4, press scale 0.96(instant), reduce-motion 정적.
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { GroupFab } from '@/components/GroupFab';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockReduced = false;
jest.mock('@/lib/motion/useReducedMotion', () => ({
  useReducedMotion: (): boolean => mockReduced,
}));

const L = tokens.light;
const wrapper = ThemeProvider;
const flatten = (style: unknown): Record<string, unknown> =>
  StyleSheet.flatten(style as never) as Record<string, unknown>;

describe('GroupFab (W2-3 중앙 FAB)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReduced = false;
  });

  test('56×56 둥근 사각형 — radius-md(8), 원형(9999) 아님', () => {
    const { getByTestId } = render(<GroupFab />, { wrapper });
    const body = flatten(getByTestId('group-fab-body').props.style);
    expect(body.width).toBe(56);
    expect(body.height).toBe(56);
    expect(body.borderRadius).toBe(tokens.radius.md);
    expect(body.borderRadius).not.toBe(tokens.radius.full);
  });

  test('brand-500 fill (D5 sanctioned — 모임 만들기 primary CTA)', () => {
    const { getByTestId } = render(<GroupFab />, { wrapper });
    const body = flatten(getByTestId('group-fab-body').props.style);
    expect(body.backgroundColor).toBe(L.brand[500]);
  });

  test('캘린더+더하기 두 글리프 합성 렌더', () => {
    const { getByTestId } = render(<GroupFab />, { wrapper });
    expect(getByTestId('group-fab-calendar')).toBeTruthy();
    expect(getByTestId('group-fab-plus')).toBeTruthy();
  });

  test('a11y — button role + "새 모임 만들기" 라벨', () => {
    const { getByTestId } = render(<GroupFab />, { wrapper });
    const fab = getByTestId('group-fab');
    expect(fab.props.accessibilityRole).toBe('button');
    expect(fab.props.accessibilityLabel).toBe('새 모임 만들기');
  });

  test('press → /group/new 이동 1회', () => {
    const { getByTestId } = render(<GroupFab />, { wrapper });
    fireEvent.press(getByTestId('group-fab'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });

  test('onPress prop 우선 — 주어지면 router.push 대신 호출', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<GroupFab onPress={onPress} />, { wrapper });
    fireEvent.press(getByTestId('group-fab'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('reduce-motion — scale transform 없음(정적), 이동은 유지', () => {
    mockReduced = true;
    const { getByTestId } = render(<GroupFab />, { wrapper });
    const body = flatten(getByTestId('group-fab-body').props.style);
    expect(Array.isArray(body.transform) ? body.transform.length : 0).toBe(0);
    fireEvent.press(getByTestId('group-fab'));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  test('모션 활성 시 scale transform 존재', () => {
    mockReduced = false;
    const { getByTestId } = render(<GroupFab />, { wrapper });
    const body = flatten(getByTestId('group-fab-body').props.style);
    expect(Array.isArray(body.transform) ? body.transform.length : 0).toBe(1);
  });
});
