import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { ScreenHeader } from './ScreenHeader';
import { ThemeProvider } from '@/design/theme';

const wrapper = ThemeProvider;

describe('ScreenHeader (W0-5)', () => {
  test('타이틀을 렌더한다', () => {
    const { getByText } = render(<ScreenHeader title="개인정보 처리방침" />, { wrapper });
    expect(getByText('개인정보 처리방침')).toBeTruthy();
  });

  test('onBack이 있으면 뒤로 버튼(44pt)을 렌더하고 누르면 콜백을 호출한다', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<ScreenHeader title="약관" onBack={onBack} testID="hdr" />, {
      wrapper,
    });
    const back = getByTestId('hdr-back');
    expect(back.props.accessibilityLabel).toBe('뒤로 가기');
    const style = Array.isArray(back.props.style)
      ? Object.assign({}, ...back.props.style)
      : back.props.style;
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
    fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('onBack이 없으면 뒤로 버튼을 렌더하지 않는다 (좌측 spacer)', () => {
    const { queryByTestId } = render(<ScreenHeader title="홈" testID="hdr" />, { wrapper });
    expect(queryByTestId('hdr-back')).toBeNull();
  });

  test('우측 액션 슬롯을 렌더한다', () => {
    const { getByText } = render(<ScreenHeader title="친구" right={<Text>편집</Text>} />, {
      wrapper,
    });
    expect(getByText('편집')).toBeTruthy();
  });
});
