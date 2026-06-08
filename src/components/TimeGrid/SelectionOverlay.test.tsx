// SelectionOverlay smoke test — Reanimated worklet runtime은 jest에서 mock이라 실제 색/위치
// 계산은 검증 불가. 본 테스트는 mount 안전성 + testID 노출만 검증. 실 동작은 dev client/preview.

import React from 'react';
import { render } from '@testing-library/react-native';

import { SelectionOverlay } from './SelectionOverlay';
import { ThemeProvider } from '../../design/theme';

// jest 환경에서 useSharedValue는 react-native-reanimated의 mock — { value: T } 객체 반환
import { useSharedValue } from 'react-native-reanimated';
import type { GridLayout } from '@/lib/heatmap/coords';
import type { CellCoord } from '@/lib/heatmap/sweep';

describe('SelectionOverlay', () => {
  const wrapper = ThemeProvider;

  test('drag 비활성(startCoord=null) 시 mount 가능 + testID 노출', () => {
    const layout = useSharedValue<GridLayout>({
      headerWidth: 50,
      cellHeight: 14,
      cellWidth: 44,
      rowCount: 60,
      colCount: 7,
      scrollOffsetY: 0,
    });
    const startCoord = useSharedValue<CellCoord | null>(null);
    const currentCoord = useSharedValue<CellCoord | null>(null);
    const toggleAdd = useSharedValue<boolean>(true);

    const { getByTestId } = render(
      <SelectionOverlay
        layout={layout}
        startCoord={startCoord}
        currentCoord={currentCoord}
        toggleAdd={toggleAdd}
        testID="selection-overlay"
      />,
      { wrapper },
    );

    expect(getByTestId('selection-overlay')).toBeTruthy();
  });
});
