import React from 'react';
import { render } from '@testing-library/react-native';
import { Cell } from './Cell';
import { ThemeProvider } from '../../design/theme';
import { tokens } from '../../design/tokens';

describe('Cell Component', () => {
  const wrapper = ThemeProvider;

  test('renders heat states correctly with heat colors from tokens', () => {
    // Test for heat-0 / empty (which uses heat[0])
    const { getByTestId, rerender } = render(
      <Cell state="empty" count={0} isHeader={false} testID="grid-cell" />,
      { wrapper }
    );
    let cell = getByTestId('grid-cell');
    // For empty/heat-0 in light mode, background should be tokens.light.heat[0]
    expect(cell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: tokens.light.heat[0],
        }),
      ])
    );

    // Test for heat-1
    rerender(<Cell state="heat-1" count={1} isHeader={false} testID="grid-cell" />);
    cell = getByTestId('grid-cell');
    expect(cell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: tokens.light.heat[1],
        }),
      ])
    );

    // Test for heat-2
    rerender(<Cell state="heat-2" count={2} isHeader={false} testID="grid-cell" />);
    cell = getByTestId('grid-cell');
    expect(cell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: tokens.light.heat[2],
        }),
      ])
    );

    // Test for heat-3
    rerender(<Cell state="heat-3" count={3} isHeader={false} testID="grid-cell" />);
    cell = getByTestId('grid-cell');
    expect(cell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: tokens.light.heat[3],
        }),
      ])
    );

    // Test for heat-4
    rerender(<Cell state="heat-4" count={4} isHeader={false} testID="grid-cell" />);
    cell = getByTestId('grid-cell');
    expect(cell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: tokens.light.heat[4],
        }),
      ])
    );
  });

  test('renders self selected state correctly with brand colors and icons', () => {
    const { getByTestId, getByText } = render(
      <Cell state="self" count={3} isHeader={false} testID="grid-cell" />,
      { wrapper }
    );
    const cell = getByTestId('grid-cell');

    // Self state should have brand-50 background and brand-500 border
    expect(cell.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: tokens.light.brand[50],
          borderColor: tokens.light.brand[500],
          borderWidth: 2,
        }),
      ])
    );

    // Check count text
    const countText = getByText('3');
    expect(countText).toBeTruthy();
    // Count label should have tabular-nums
    expect(countText.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontVariant: ['tabular-nums'],
        }),
      ])
    );
  });

  test('defines minimum hitSlop for 44pt touch target when cell is 8pt visual height', () => {
    const { getByTestId } = render(
      <Cell state="empty" count={0} isHeader={false} testID="grid-cell" />,
      { wrapper }
    );
    const cell = getByTestId('grid-cell');
    // hitSlop should expand top/bottom by at least 18pt to reach 44pt from 8pt height
    const hitSlop = cell.props.hitSlop;
    expect(hitSlop).toBeDefined();
    if (hitSlop) {
      expect(hitSlop.top).toBeGreaterThanOrEqual(18);
      expect(hitSlop.bottom).toBeGreaterThanOrEqual(18);
    }
  });

  test('renders header cell properly', () => {
    const { getByText } = render(
      <Cell state="empty" count={0} isHeader={true} label="Header text" />,
      { wrapper }
    );
    expect(getByText('Header text')).toBeTruthy();
  });
});
