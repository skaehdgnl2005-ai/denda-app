import React from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider, useToast, type ToastOptions } from './Toast';
import { ThemeProvider } from '@/design/theme';

jest.mock('@/lib/motion/useReducedMotion', () => ({ useReducedMotion: () => false }));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Trigger({ opts }: { opts: ToastOptions }): React.JSX.Element {
  const { show } = useToast();
  return (
    <Pressable testID="trigger" onPress={() => show(opts)}>
      <Text>t</Text>
    </Pressable>
  );
}

function renderWithToast(opts: ToastOptions) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <ToastProvider>
          <Trigger opts={opts} />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('Toast + ToastProvider + useToast (W0-2)', () => {
  test('Provider 밖에서 useToast는 throw한다', () => {
    function Bad(): null {
      useToast();
      return null;
    }
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });

  test('show()로 메시지를 띄운다', () => {
    const { getByTestId, getByText } = renderWithToast({ message: '요청 보냈어요!' });
    fireEvent.press(getByTestId('trigger'));
    expect(getByText('요청 보냈어요!')).toBeTruthy();
  });

  test('success variant는 아이콘을 동반한다 (§12.6 색 단독 의존 금지)', () => {
    const { getByTestId, queryByTestId } = renderWithToast({
      message: '됐어요!',
      variant: 'success',
    });
    fireEvent.press(getByTestId('trigger'));
    expect(queryByTestId('toast-icon')).toBeTruthy();
  });

  test('default variant는 시맨틱 아이콘 없이 중립 표시', () => {
    const { getByTestId, queryByTestId } = renderWithToast({ message: '안내' });
    fireEvent.press(getByTestId('trigger'));
    expect(queryByTestId('toast-icon')).toBeNull();
  });

  test('action 버튼을 누르면 콜백이 실행된다 ("보러 가기")', () => {
    const onAction = jest.fn();
    const { getByTestId } = renderWithToast({
      message: '모임에 합류했어요!',
      action: { label: '보러 가기', onPress: onAction },
    });
    fireEvent.press(getByTestId('trigger'));
    fireEvent.press(getByTestId('toast-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('마운트 시 announceForAccessibility로 스크린리더에 안내한다 (§12.3)', () => {
    const spy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const { getByTestId } = renderWithToast({ message: '요청 보냈어요!' });
    fireEvent.press(getByTestId('trigger'));
    expect(spy).toHaveBeenCalledWith('요청 보냈어요!');
    spy.mockRestore();
  });

  test('action이 있으면 컨테이너 accessible을 병합하지 않는다 (액션 도달성 §12.3)', () => {
    const { getByTestId } = renderWithToast({
      message: '합류했어요!',
      action: { label: '보러 가기', onPress: jest.fn() },
    });
    fireEvent.press(getByTestId('trigger'));
    expect(getByTestId('toast').props.accessible).not.toBe(true);
  });

  test('action 터치 타깃은 44pt 이상이다 (§12.1)', () => {
    const { getByTestId } = renderWithToast({
      message: '합류했어요!',
      action: { label: '보러 가기', onPress: jest.fn() },
    });
    fireEvent.press(getByTestId('trigger'));
    const style = StyleSheet.flatten(getByTestId('toast-action').props.style) as {
      minHeight?: number;
    };
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  test('durationMs 후 자동으로 사라진다', () => {
    jest.useFakeTimers();
    try {
      const { getByTestId, queryByText } = renderWithToast({
        message: '사라져요',
        durationMs: 3000,
      });
      fireEvent.press(getByTestId('trigger'));
      expect(queryByText('사라져요')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(3000 + 300);
      });
      expect(queryByText('사라져요')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
