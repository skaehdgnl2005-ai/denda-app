import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { HostConfirmButton } from './HostConfirmButton';
import { ThemeProvider } from '@/design/theme';

describe('HostConfirmButton', () => {
  const wrapper = ThemeProvider;

  test('렌더링: "모임 확정" 라벨 + accessibilityRole=button', () => {
    const onPress = jest.fn();
    const { getByText, getByRole } = render(
      <HostConfirmButton onPress={onPress} disabled={false} inflight={false} />,
      { wrapper },
    );
    expect(getByText('모임 확정')).toBeTruthy();
    expect(getByRole('button')).toBeTruthy();
  });

  test('disabled=false → onPress 호출', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <HostConfirmButton onPress={onPress} disabled={false} inflight={false} />,
      { wrapper },
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabled=true → onPress 호출 안 됨', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <HostConfirmButton onPress={onPress} disabled={true} inflight={false} />,
      { wrapper },
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('inflight=true → ActivityIndicator 노출 + onPress 호출 안 됨 (더블 탭 방지)', () => {
    const onPress = jest.fn();
    const { getByTestId, getByRole } = render(
      <HostConfirmButton onPress={onPress} disabled={false} inflight={true} testID="confirm-btn" />,
      { wrapper },
    );
    expect(getByTestId('confirm-btn-spinner')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('inflight=true → accessibilityState.busy=true', () => {
    const { getByRole } = render(
      <HostConfirmButton onPress={() => {}} disabled={false} inflight={true} />,
      { wrapper },
    );
    const btn = getByRole('button');
    expect(btn.props.accessibilityState?.busy).toBe(true);
  });
});
