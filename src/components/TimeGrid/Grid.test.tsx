import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';
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

    const { getAllByTestId } = render(<Grid cells={mockCells} />, { wrapper });

    const cells = getAllByTestId(/^grid-cell-/);
    expect(cells.length).toBe(420); // 60 slots * 7 days = 420 cells
  });

  test('triggers onCellPress with correct slot and day coordinates', () => {
    const mockCells = generateMockCells('empty');
    const onCellPressMock = jest.fn();

    const { getByTestId } = render(<Grid cells={mockCells} onCellPress={onCellPressMock} />, {
      wrapper,
    });

    // Tap cell at slot 5, day 3
    const targetCell = getByTestId('grid-cell-5-3');
    fireEvent.press(targetCell);

    expect(onCellPressMock).toHaveBeenCalledWith(5, 3);
  });

  test('colCount=3 prop: 60×3 = 180 cells만 렌더 (Issue 3 fix)', () => {
    const mockCells: CellState[][] = [];
    for (let slot = 0; slot < 60; slot++) {
      const row: CellState[] = [];
      for (let day = 0; day < 3; day++) {
        row.push({ state: 'empty', count: 0 });
      }
      mockCells.push(row);
    }
    const { getAllByTestId } = render(
      <Grid cells={mockCells} colCount={3} dayLabels={['6/5', '6/6', '6/7']} />,
      { wrapper },
    );
    const cells = getAllByTestId(/^grid-cell-/);
    expect(cells.length).toBe(180);
  });

  test('colCount=3 + cellWidth: 분모가 3으로 계산 (Issue 3 fix)', () => {
    const mockCells: CellState[][] = [];
    for (let slot = 0; slot < 60; slot++) {
      mockCells.push([
        { state: 'empty', count: 0 },
        { state: 'empty', count: 0 },
        { state: 'empty', count: 0 },
      ]);
    }
    const onCellWidthChange = jest.fn();
    const { UNSAFE_root } = render(
      <Grid cells={mockCells} colCount={3} onCellWidthChange={onCellWidthChange} />,
      { wrapper },
    );
    const layoutEvent = { nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 600 } } };
    const onLayoutViews = UNSAFE_root.findAll((node) => typeof node.props.onLayout === 'function');
    onLayoutViews[0]?.props.onLayout(layoutEvent);
    // (350-50)/3 = 100
    expect(onCellWidthChange).toHaveBeenCalledWith(100);
  });

  test('panGesture mode: onCellPress가 호출되지 않음 (sweep mode 우선)', () => {
    const mockCells = generateMockCells('empty');
    const onCellPressMock = jest.fn();
    const panGesture = Gesture.Pan();

    const { getByTestId } = render(
      <Grid cells={mockCells} onCellPress={onCellPressMock} panGesture={panGesture} />,
      { wrapper },
    );

    fireEvent.press(getByTestId('grid-cell-5-3'));
    expect(onCellPressMock).not.toHaveBeenCalled();
  });

  test('onCellWidthChange: grid body layout 이벤트 시 cellWidth 통지', () => {
    const mockCells = generateMockCells('empty');
    const onCellWidthChange = jest.fn();

    const { UNSAFE_root } = render(
      <Grid cells={mockCells} onCellWidthChange={onCellWidthChange} />,
      { wrapper },
    );

    // grid body는 첫 layout 가능한 View — onLayout 직접 트리거
    // totalWidth=400, headerWidth=50 → cellWidth = (400-50)/7 = 50
    const layoutEvent = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 600 } } };

    // gridBody는 onLayout이 있는 첫 View → 다른 View 중 핵심은 gridBody만 onLayout 핸들러 보유
    // UNSAFE 접근 없이도, onLayout을 가진 모든 View를 순회해 첫 매칭 호출
    const onLayoutViews = UNSAFE_root.findAll((node) => typeof node.props.onLayout === 'function');
    expect(onLayoutViews.length).toBeGreaterThan(0);
    onLayoutViews[0]?.props.onLayout(layoutEvent);
    expect(onCellWidthChange).toHaveBeenCalledWith(50);
  });

  test('onScrollY: ScrollView scroll 이벤트 시 contentOffset.y 통지', () => {
    const mockCells = generateMockCells('empty');
    const onScrollY = jest.fn();

    const { UNSAFE_root } = render(<Grid cells={mockCells} onScrollY={onScrollY} />, { wrapper });

    const scrollNodes = UNSAFE_root.findAll((node) => typeof node.props.onScroll === 'function');
    expect(scrollNodes.length).toBeGreaterThan(0);
    scrollNodes[0]?.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 120 } } });
    expect(onScrollY).toHaveBeenCalledWith(120);
  });
});
