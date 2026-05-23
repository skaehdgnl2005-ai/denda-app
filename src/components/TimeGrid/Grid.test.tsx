import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Grid, CellState } from './Grid';
import { ThemeProvider } from '../../design/theme';

describe('Grid Component', () => {
  const wrapper = ThemeProvider;

  // Helper to generate a 60x7 mock cells matrix
  const generateMockCells = (defaultState: CellState['state'] = 'empty'): CellState[][] => {
    const cells: CellState[][] = [];
    for (let slot = 0; slot < 60; slot++) {
      const row: CellState[] = [];
      for (let day = 0; day < 7; day++) {
        row.push({ state: defaultState, count: 0 });
      }
      cells.push(row);
    }
    return cells;
  };

  test('renders 420 cells correctly based on props', () => {
    const mockCells = generateMockCells('empty');
    // Set a few specific cell states to verify mapping
    const row0 = mockCells[0];
    if (row0) {
      row0[0] = { state: 'self', count: 1 };
    }
    const row1 = mockCells[1];
    if (row1) {
      row1[2] = { state: 'heat-3', count: 3 };
    }

    const { getAllByTestId } = render(
      <Grid cells={mockCells} />,
      { wrapper }
    );

    const cells = getAllByTestId(/^grid-cell-/);
    expect(cells.length).toBe(420); // 60 slots * 7 days = 420 cells
  });

  test('triggers onCellPress with correct slot and day coordinates', () => {
    const mockCells = generateMockCells('empty');
    const onCellPressMock = jest.fn();

    const { getByTestId } = render(
      <Grid cells={mockCells} onCellPress={onCellPressMock} />,
      { wrapper }
    );

    // Tap cell at slot 5, day 3
    const targetCell = getByTestId('grid-cell-5-3');
    fireEvent.press(targetCell);

    expect(onCellPressMock).toHaveBeenCalledWith(5, 3);
  });
});
