// W2-13 — 공용 SearchField 프리미티브. clear(X)·returnKeyType="search"·a11y 라벨.
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { SearchField } from '@/components/SearchField';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';

const L = tokens.light;
const wrapper = ThemeProvider;
const flatten = (style: unknown): Record<string, unknown> =>
  StyleSheet.flatten(style as never) as Record<string, unknown>;

describe('SearchField (W2-13)', () => {
  test('placeholder·value 렌더 + 입력 시 onChangeText', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = render(
      <SearchField
        value=""
        onChangeText={onChangeText}
        placeholder="식당·카페·지역을 검색해요"
        accessibilityLabel="장소 검색 입력창"
        testID="sf"
      />,
      { wrapper },
    );
    const input = getByTestId('sf');
    expect(input.props.placeholder).toBe('식당·카페·지역을 검색해요');
    expect(input.props.accessibilityLabel).toBe('장소 검색 입력창');
    fireEvent.changeText(input, '홍대');
    expect(onChangeText).toHaveBeenCalledWith('홍대');
  });

  test('returnKeyType=search + onSubmit(onSubmitEditing) 호출', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <SearchField
        value="홍대"
        onChangeText={jest.fn()}
        accessibilityLabel="검색"
        testID="sf"
        onSubmit={onSubmit}
      />,
      { wrapper },
    );
    const input = getByTestId('sf');
    expect(input.props.returnKeyType).toBe('search');
    fireEvent(input, 'submitEditing');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('clear(X) — value 비면 숨김, 있으면 노출', () => {
    const { queryByTestId, rerender } = render(
      <SearchField value="" onChangeText={jest.fn()} accessibilityLabel="검색" testID="sf" />,
      { wrapper },
    );
    expect(queryByTestId('sf-clear')).toBeNull();

    rerender(
      <SearchField value="홍대" onChangeText={jest.fn()} accessibilityLabel="검색" testID="sf" />,
    );
    expect(queryByTestId('sf-clear')).toBeTruthy();
  });

  test('clear 누르면 onClear 우선, 없으면 onChangeText("")', () => {
    const onClear = jest.fn();
    const { getByTestId, rerender } = render(
      <SearchField
        value="홍대"
        onChangeText={jest.fn()}
        accessibilityLabel="검색"
        testID="sf"
        onClear={onClear}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('sf-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);

    const onChangeText = jest.fn();
    rerender(
      <SearchField
        value="홍대"
        onChangeText={onChangeText}
        accessibilityLabel="검색"
        testID="sf"
      />,
    );
    fireEvent.press(getByTestId('sf-clear'));
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  test('clear 버튼 a11y (button role + "검색어 지우기")', () => {
    const { getByTestId } = render(
      <SearchField value="홍대" onChangeText={jest.fn()} accessibilityLabel="검색" testID="sf" />,
      { wrapper },
    );
    const clear = getByTestId('sf-clear');
    expect(clear.props.accessibilityRole).toBe('button');
    expect(clear.props.accessibilityLabel).toBe('검색어 지우기');
  });

  test('컨테이너 토큰 — surface-2 배경, border-strong, radius-md, 44pt 높이', () => {
    const { getByTestId } = render(
      <SearchField value="" onChangeText={jest.fn()} accessibilityLabel="검색" testID="sf" />,
      { wrapper },
    );
    const container = flatten(getByTestId('sf-container').props.style);
    expect(container.backgroundColor).toBe(L.surface[2]);
    expect(container.borderColor).toBe(L.border.strong);
    expect(container.borderRadius).toBe(tokens.radius.md);
    expect(container.height).toBe(44);
  });

  test('autoFocus prop 전달', () => {
    const { getByTestId } = render(
      <SearchField
        value=""
        onChangeText={jest.fn()}
        accessibilityLabel="검색"
        testID="sf"
        autoFocus
      />,
      { wrapper },
    );
    expect(getByTestId('sf').props.autoFocus).toBe(true);
  });
});
