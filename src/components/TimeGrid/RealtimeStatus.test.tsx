import React from 'react';
import { render } from '@testing-library/react-native';
import { RealtimeStatus } from './RealtimeStatus';
import { ThemeProvider } from '../../design/theme';
import { tokens } from '../../design/tokens';

describe('RealtimeStatus Component', () => {
  const wrapper = ThemeProvider;

  test('renders nothing when connected is true', () => {
    const { toJSON } = render(
      <RealtimeStatus isConnected={true} testID="status-chip" />,
      { wrapper }
    );
    expect(toJSON()).toBeNull();
  });

  test('renders chip when connected is false', () => {
    const { getByTestId, getByText } = render(
      <RealtimeStatus isConnected={false} testID="status-chip" />,
      { wrapper }
    );
    const chip = getByTestId('status-chip');
    expect(chip).toBeTruthy();

    // Check style using colors.semantic.info values in light mode
    expect(chip.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: tokens.light.semantic.info.bg,
          borderColor: tokens.light.semantic.info.border,
        }),
      ])
    );

    // Verify text
    const textNode = getByText('실시간 갱신 일시 중단 — 30s 후 폴링');
    expect(textNode).toBeTruthy();
  });
});
