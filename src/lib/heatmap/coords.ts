// pointToCell — 포인터 좌표 → CellCoord 매핑 (worklet 호출 가능 순수 함수).
//
// D12 의무: Gesture.Pan worklet의 onUpdate에서 호출 → setState 없이 useSharedValue 갱신.
// 본 함수 자체는 어디서든 호출 가능 (worklet 마킹은 호출하는 worklet 컨텍스트에서 적용).
//
// Grid layout 측정 책임:
//   - headerWidth, cellHeight: 상수 (TimeGrid/Grid.tsx의 styles)
//   - cellWidth: layout-time 측정 (onLayout으로 받은 grid container width / colCount)
//
// scrollOffsetY는 GridLayout 타입에 유지되지만 pointToCell은 사용하지 않는다.
// 이유 (2026-06-05 dev client 회귀로 확인): GestureDetector가 부착된 view(gridBody)는
//   ScrollView의 스크롤된 콘텐츠 그 자체이므로 RNGH의 e.y는 이미 view-local(스크롤 반영
//   완료) 좌표를 보고한다. 여기에 scrollOffsetY를 더하면 이중 가산 → 의도보다 아래 row를
//   가리켜 SelectionOverlay가 드래그 범위보다 더 아래·더 길게 그려지는 회귀가 발생.
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
  // pt.y는 gridBody view-local 좌표 (이미 scroll 반영). scrollOffsetY는 가산 X.
  const localY = pt.y;
  if (localX < 0 || localY < 0) return null;
  if (layout.cellWidth <= 0 || layout.cellHeight <= 0) return null;
  const col = Math.floor(localX / layout.cellWidth);
  const row = Math.floor(localY / layout.cellHeight);
  if (col < 0 || col >= layout.colCount) return null;
  if (row < 0 || row >= layout.rowCount) return null;
  return { row, col };
}
