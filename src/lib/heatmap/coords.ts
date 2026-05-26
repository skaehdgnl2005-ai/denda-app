// pointToCell — 포인터 좌표 → CellCoord 매핑 (worklet 호출 가능 순수 함수).
//
// D12 의무: Gesture.Pan worklet의 onUpdate에서 호출 → setState 없이 useSharedValue 갱신.
// 본 함수 자체는 어디서든 호출 가능 (worklet 마킹은 호출하는 worklet 컨텍스트에서 적용).
//
// Grid layout 측정 책임:
//   - headerWidth, cellHeight: 상수 (TimeGrid/Grid.tsx의 styles)
//   - cellWidth: layout-time 측정 (onLayout으로 받은 grid container width / colCount)
//   - scrollOffsetY: ScrollView의 onScroll → useSharedValue로 추적
//
// 반환 null은 그리드 영역 밖(헤더 위, 시간 라벨 좌측, row/col 범위 초과).

import type { CellCoord } from './sweep';

export interface GridLayout {
  headerWidth: number;
  cellHeight: number;
  cellWidth: number;
  rowCount: number;
  colCount: number;
  scrollOffsetY: number;
}

export interface PointerPosition {
  x: number;
  y: number;
}

export function pointToCell(pt: PointerPosition, layout: GridLayout): CellCoord | null {
  'worklet';
  const localX = pt.x - layout.headerWidth;
  const localY = pt.y + layout.scrollOffsetY;
  if (localX < 0 || localY < 0) return null;
  if (layout.cellWidth <= 0 || layout.cellHeight <= 0) return null;
  const col = Math.floor(localX / layout.cellWidth);
  const row = Math.floor(localY / layout.cellHeight);
  if (col < 0 || col >= layout.colCount) return null;
  if (row < 0 || row >= layout.rowCount) return null;
  return { row, col };
}
