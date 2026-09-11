import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { Button, buttonPalette } from './Button';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';

jest.mock('@/lib/motion/useReducedMotion', () => ({ useReducedMotion: () => true }));

const wrapper = ThemeProvider;
const L = tokens.light;

function bgOf(el: { props: { style?: unknown } }): string | undefined {
  return (StyleSheet.flatten(el.props.style) as { backgroundColor?: string }).backgroundColor;
}

describe('Button (W0-1)', () => {
  test('라벨을 렌더하고 탭하면 onPress를 호출한다', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = render(
      <Button label="확정하기" onPress={onPress} testID="btn" />,
      { wrapper },
    );
    expect(getByText('확정하기')).toBeTruthy();
    fireEvent.press(getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('primary 기본 배경은 brand-500 (렌더)', () => {
    const { getByTestId } = render(<Button label="확정" onPress={() => {}} testID="btn" />, {
      wrapper,
    });
    expect(bgOf(getByTestId('btn'))).toBe(L.brand[500]);
  });

  test('pressed는 opacity가 아닌 색 전환 — primary→brand-600 (§9.1)', () => {
    // Pressable pressed 상태는 responder 계층이라 단위 테스트에선 팔레트 계약으로 검증.
    expect(buttonPalette('primary', L, false, false).bg).toBe(L.brand[500]);
    expect(buttonPalette('primary', L, true, false).bg).toBe(L.brand[600]);
    expect(buttonPalette('secondary', L, true, false).bg).toBe(L.surface[2]);
    expect(buttonPalette('ghost', L, true, false).bg).toBe(L.surface[3]);
    // disabled는 pressed여도 회색 유지 (§17.5)
    expect(buttonPalette('primary', L, true, true).bg).toBe(L.surface[2]);
    expect(buttonPalette('primary', L, true, true).fg).toBe(L.text.tertiary);
  });

  test('disabled면 회색(surface-2)·text-tertiary이고 onPress를 호출하지 않는다 (§17.5)', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Button label="동의 필요" onPress={onPress} disabled testID="btn" />,
      { wrapper },
    );
    const btn = getByTestId('btn');
    expect(bgOf(btn)).toBe(L.surface[2]);
    expect(btn.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('loading이면 스피너를 인라인으로 표시하고 라벨을 유지하며 onPress를 막는다 (§11.1)', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = render(
      <Button label="처리 중" onPress={onPress} loading testID="btn" />,
      { wrapper },
    );
    expect(getByTestId('btn-spinner')).toBeTruthy();
    expect(getByText('처리 중')).toBeTruthy(); // 라벨 유지
    expect(getByTestId('btn').props.accessibilityState.busy).toBe(true);
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('destructive는 error-fg 텍스트 + 절제된 error.bg (§10.6)', () => {
    const { getByTestId, getByText } = render(
      <Button label="차단하기" onPress={() => {}} variant="destructive" testID="btn" />,
      { wrapper },
    );
    expect(bgOf(getByTestId('btn'))).toBe(L.semantic.error.bg);
    expect(StyleSheet.flatten(getByText('차단하기').props.style).color).toBe(L.semantic.error.fg);
  });

  test('destructive는 error.border 1pt 테두리로 흰 배경에서도 형태가 보인다 (리뷰 #10)', () => {
    expect(buttonPalette('destructive', L, false, false).border).toBe(L.semantic.error.border);
    const { getByTestId } = render(
      <Button label="차단하기" onPress={() => {}} variant="destructive" testID="btn" />,
      { wrapper },
    );
    const s = StyleSheet.flatten(getByTestId('btn').props.style) as {
      borderWidth?: number;
      borderColor?: string;
    };
    expect(s.borderWidth).toBe(1);
    expect(s.borderColor).toBe(L.semantic.error.border);
  });

  test('style prop이 적용된다 (리뷰 #7)', () => {
    const { getByTestId } = render(
      <Button label="A" onPress={() => {}} style={{ marginTop: 12 }} testID="btn" />,
      { wrapper },
    );
    const s = StyleSheet.flatten(getByTestId('btn').props.style) as { marginTop?: number };
    expect(s.marginTop).toBe(12);
  });

  test('size lg=56 / md=48 높이 (§10.3)', () => {
    const { getByTestId, rerender } = render(
      <Button label="A" onPress={() => {}} size="lg" testID="btn" />,
      { wrapper },
    );
    expect((StyleSheet.flatten(getByTestId('btn').props.style) as { height?: number }).height).toBe(
      56,
    );
    rerender(<Button label="A" onPress={() => {}} size="md" testID="btn" />);
    expect((StyleSheet.flatten(getByTestId('btn').props.style) as { height?: number }).height).toBe(
      48,
    );
  });

  test('접근성 role=button + 라벨', () => {
    const { getByTestId } = render(
      <Button label="확정" onPress={() => {}} accessibilityLabel="모임 확정하기" testID="btn" />,
      { wrapper },
    );
    const btn = getByTestId('btn');
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('모임 확정하기');
  });
});
