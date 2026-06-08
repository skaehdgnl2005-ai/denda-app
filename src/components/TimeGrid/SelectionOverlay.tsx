// SelectionOverlay — drag 중 사각형 시각 피드백 (Issue 1A, D12 60fps).
//
// 책임: useSweepGesture가 노출한 startCoord / currentCoord / layout SharedValue를
//   구독해 drag 영역을 절대 위치 Animated.View로 그림. UI thread에서 매 frame 갱신.
//
// 원래 round-trip 경로 (drag → onCommit → 네트워크 → Realtime → setState → 재렌더 ≈ 1초):
//   본 overlay가 그 사이 갭을 즉시 채움. Cell 자체 색은 commit·broadcast 후 천천히 따라옴.
//
// 마운트 위치: Grid의 overlay slot (gridBody 안에 absolutely positioned, scroll 같이 됨).
//
// 색: toggleAdd=true (add 모드) = brand[500] 반투명 / false (remove 모드) = surface[3].
// drag 중 toggleAdd는 변하지 않으므로 한 drag 안에서 색 일관.

import React from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '../../design/theme';
import type { GridLayout } from '@/lib/heatmap/coords';
import type { CellCoord } from '@/lib/heatmap/sweep';

export interface SelectionOverlayProps {
  layout: SharedValue<GridLayout>;
  startCoord: SharedValue<CellCoord | null>;
  currentCoord: SharedValue<CellCoord | null>;
  toggleAdd: SharedValue<boolean>;
  testID?: string;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  layout,
  startCoord,
  currentCoord,
  toggleAdd,
  testID,
}) => {
  const { colors } = useTheme();
  // 클로저 캡쳐 — worklet 안에서 theme 직접 호출 불가
  const addColor = colors.brand[500];
  const removeColor = colors.surface[3];

  const animatedStyle = useAnimatedStyle(() => {
    const start = startCoord.value;
    const current = currentCoord.value;
    const l = layout.value;
    if (!start || !current || l.cellWidth <= 0 || l.cellHeight <= 0) {
      return {
        opacity: 0,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        backgroundColor: addColor,
      };
    }
    const minRow = Math.min(start.row, current.row);
    const maxRow = Math.max(start.row, current.row);
    const minCol = Math.min(start.col, current.col);
    const maxCol = Math.max(start.col, current.col);
    return {
      opacity: 0.42,
      left: l.headerWidth + minCol * l.cellWidth + 1,
      top: minRow * l.cellHeight + 1,
      width: (maxCol - minCol + 1) * l.cellWidth - 2,
      height: (maxRow - minRow + 1) * l.cellHeight - 2,
      backgroundColor: toggleAdd.value ? addColor : removeColor,
    };
  });

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          borderRadius: 2,
        },
        animatedStyle,
      ]}
    />
  );
};
