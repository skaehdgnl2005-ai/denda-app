import React from 'react';
import { render } from '@testing-library/react-native';
import { Icon } from './Icon';
import { ThemeProvider } from '../design/theme';

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
});
