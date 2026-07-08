import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmSheet } from './ConfirmSheet';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';

jest.mock('@/lib/motion/useReducedMotion', () => ({ useReducedMotion: () => true }));

const L = tokens.light;
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderSheet(props: Partial<React.ComponentProps<typeof ConfirmSheet>> = {}) {
  const base: React.ComponentProps<typeof ConfirmSheet> = {
    visible: true,
    onClose: jest.fn(),
    title: '로그아웃할까요?',
    message: '다시 로그인해야 해요.',
    confirmLabel: '로그아웃',
    onConfirm: jest.fn(),
    testID: 'cs',
  };
  const merged = { ...base, ...props };
  return {
    ...render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <ConfirmSheet {...merged} />
        </ThemeProvider>
      </SafeAreaProvider>,
    ),
    props: merged,
  };
}

function bgOf(el: { props: { style?: unknown } }): string | undefined {
  return (StyleSheet.flatten(el.props.style) as { backgroundColor?: string }).backgroundColor;
}

describe('ConfirmSheet (W0-3, §10.3)', () => {
  test('visible=false면 아무것도 렌더하지 않는다', () => {
    const { queryByText } = renderSheet({ visible: false });
    expect(queryByText('로그아웃할까요?')).toBeNull();
  });

  test('visible=true면 타이틀·본문·버튼 페어를 렌더한다', () => {
    const { getByText, getByTestId } = renderSheet();
    expect(getByText('로그아웃할까요?')).toBeTruthy();
    expect(getByText('다시 로그인해야 해요.')).toBeTruthy();
    expect(getByTestId('cs-confirm')).toBeTruthy();
    expect(getByTestId('cs-cancel')).toBeTruthy();
  });

  test('확정 버튼을 누르면 onConfirm을 호출한다', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = renderSheet({ onConfirm });
    fireEvent.press(getByTestId('cs-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('취소 버튼·backdrop 탭은 onClose를 호출한다', () => {
    const onClose = jest.fn();
    const { getByTestId } = renderSheet({ onClose });
    fireEvent.press(getByTestId('cs-cancel'));
    fireEvent.press(getByTestId('cs-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('backdrop은 overlay.scrim 토큰을 쓴다 (하드코딩 아님)', () => {
    const { getByTestId } = renderSheet();
    expect(bgOf(getByTestId('cs-backdrop', { includeHiddenElements: true }))).toBe(L.overlay.scrim);
  });

  test('destructive면 확정 버튼이 error 팔레트다 (§10.6)', () => {
    const { getByTestId } = renderSheet({ destructive: true });
    expect(bgOf(getByTestId('cs-confirm'))).toBe(L.semantic.error.bg);
  });

  test('grabber를 렌더한다 (§10.3)', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('cs-grabber')).toBeTruthy();
  });

  test('시트를 accessibilityViewIsModal로 격리한다 (읽기 순서 §12.3)', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('cs-sheet').props.accessibilityViewIsModal).toBe(true);
  });

  test('loading 중에는 backdrop·취소로 닫히지 않는다 (리뷰 #8)', () => {
    const onClose = jest.fn();
    const { getByTestId } = renderSheet({ loading: true, onClose });
    fireEvent.press(getByTestId('cs-backdrop', { includeHiddenElements: true }));
    fireEvent.press(getByTestId('cs-cancel'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
