import React from 'react';
import { render } from '@testing-library/react-native';

import { Skeleton } from './Skeleton';
import { ThemeProvider } from '@/design/theme';

const wrapper = ThemeProvider;

describe('Skeleton', () => {
  test('testID로 렌더된다', () => {
    const { getByTestId } = render(<Skeleton testID="sk" height={20} />, { wrapper });
    expect(getByTestId('sk')).toBeTruthy();
  });

  test('스크린리더 포커스에서 제외된다 (장식 요소)', () => {
    const { getByTestId } = render(<Skeleton testID="sk" />, { wrapper });
    expect(getByTestId('sk').props.accessible).toBe(false);
  });

  test('언마운트해도 throw 하지 않는다 (애니메이션 cleanup)', () => {
    const { unmount } = render(<Skeleton testID="sk" />, { wrapper });
    expect(() => unmount()).not.toThrow();
  });
});
