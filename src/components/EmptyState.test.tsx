import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { EmptyState } from './EmptyState';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';

jest.mock('@/lib/motion/useReducedMotion', () => ({ useReducedMotion: () => true }));

const wrapper = ThemeProvider;
const L = tokens.light;

function bgOf(el: { props: { style?: unknown } }): string | undefined {
  return (StyleSheet.flatten(el.props.style) as { backgroundColor?: string }).backgroundColor;
}

describe('EmptyState (W0-4, §11.2)', () => {
  test('헤드라인 + 보조 카피를 렌더한다', () => {
    const { getByText } = render(
      <EmptyState icon="친구" title="아직 친구가 없어요" body="카톡으로 친구를 초대해보세요" />,
      { wrapper },
    );
    expect(getByText('아직 친구가 없어요')).toBeTruthy();
    expect(getByText('카톡으로 친구를 초대해보세요')).toBeTruthy();
  });

  test('CTA를 렌더하고 누르면 콜백을 호출한다', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <EmptyState
        icon="친구"
        title="아직 친구가 없어요"
        cta={{ label: '카톡으로 초대', onPress }}
        testID="empty"
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('empty-cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('아이콘 원은 surface-2 (보라 금지 D5)', () => {
    const { getByTestId } = render(<EmptyState icon="친구" title="비었어요" testID="empty" />, {
      wrapper,
    });
    const circle = getByTestId('empty-icon');
    expect(bgOf(circle)).toBe(L.surface[2]);
    expect(bgOf(circle)).not.toBe(L.brand[500]);
    expect(bgOf(circle)).not.toBe(L.brand[50]);
  });

  test('error variant는 error.bg 원 + "다시 시도" CTA (§11.3)', () => {
    const onRetry = jest.fn();
    const { getByTestId, getByText } = render(
      <EmptyState
        title="불러오지 못했어요"
        variant="error"
        cta={{ label: '다시 시도', onPress: onRetry }}
        testID="empty"
      />,
      { wrapper },
    );
    expect(bgOf(getByTestId('empty-icon'))).toBe(L.semantic.error.bg);
    fireEvent.press(getByTestId('empty-cta'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(getByText('다시 시도')).toBeTruthy();
  });

  test('CTA가 없으면 버튼을 렌더하지 않는다', () => {
    const { queryByTestId } = render(<EmptyState icon="친구" title="비었어요" testID="empty" />, {
      wrapper,
    });
    expect(queryByTestId('empty-cta')).toBeNull();
  });
});
