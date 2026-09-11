import React from 'react';
import { render } from '@testing-library/react-native';

import { VoteGuide } from './VoteGuide';
import { ThemeProvider } from '@/design/theme';

const wrapper = ThemeProvider;

describe('VoteGuide', () => {
  test('선택 전 → 드래그 사용법 안내 노출', () => {
    const { getByText } = render(<VoteGuide hasSelection={false} />, { wrapper });
    expect(getByText(/꾹 눌러/)).toBeTruthy();
  });

  test('선택 후 → 사용법 안내 숨김 (범례는 유지)', () => {
    const { queryByText, getByText } = render(<VoteGuide hasSelection />, { wrapper });
    expect(queryByText(/꾹 눌러/)).toBeNull();
    expect(getByText(/내가 고른/)).toBeTruthy();
  });

  test('히트맵 범례(진해져요) 노출', () => {
    const { getByText } = render(<VoteGuide hasSelection={false} />, { wrapper });
    expect(getByText(/진해/)).toBeTruthy();
  });
});
