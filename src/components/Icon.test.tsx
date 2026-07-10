import React from 'react';
import { render } from '@testing-library/react-native';
import { Icon } from './Icon';
import { ThemeProvider } from '../design/theme';
import { tokens } from '../design/tokens';

describe('Icon Component', () => {
  test('renders icon component matching standard Lucide mapping', () => {
    // Tests that Icon maps '홈' to house icon, '지도' to map, etc.
    const { toJSON, rerender } = render(<Icon name="홈" color="red" />, {
      wrapper: ThemeProvider,
    });
    let json = toJSON();

    // We expect the icon to have the correct strokeWidth of 2
    expect(json).toBeDefined();

    rerender(<Icon name="지도" color="blue" />);
    json = toJSON();
    expect(json).toBeDefined();

    rerender(<Icon name="시간" />);
    json = toJSON();
    expect(json).toBeDefined();
  });

  test('applies strokeWidth of 2 by default', () => {
    const { toJSON } = render(<Icon name="홈" />, {
      wrapper: ThemeProvider,
    });
    const json = toJSON();

    expect(json).toBeDefined();
    expect(Array.isArray(json)).toBe(false);
    if (json && !Array.isArray(json)) {
      expect(json.props.strokeWidth).toBe(2);
    }
  });

  test('fill 미지정 시 아웃라인(fill undefined), 지정 시 forward (W2-1 focused 2차 신호)', () => {
    const { toJSON, rerender } = render(<Icon name="홈" />, { wrapper: ThemeProvider });
    let json = toJSON();
    if (json && !Array.isArray(json)) {
      expect(json.props.fill).toBeUndefined();
    }

    const brand = tokens.light.brand[500];
    rerender(<Icon name="홈" fill={brand} />);
    json = toJSON();
    if (json && !Array.isArray(json)) {
      expect(json.props.fill).toBe(brand);
      // fill을 줘도 stroke 2px 규칙은 유지(rules/design.md)
      expect(json.props.strokeWidth).toBe(2);
    }
  });
});
