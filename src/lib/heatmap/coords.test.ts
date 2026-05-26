// pointToCell — 포인터 좌표 → 그리드 cell 매핑 worklet 헬퍼.
//
// Grid layout (TimeGrid/Grid.tsx 기준):
//   - timeColumnSpacer = 50px (왼쪽 시간 라벨)
//   - row height = 10px (DESIGN §10.1: 8pt cell + 2pt margin)
//   - 7 day columns (flex 1 — cellWidth는 layout-time 측정 결과 주입)
//   - rowCount = 60, colCount = 7
//
// scrollOffsetY는 ScrollView가 위로 이동한 양. 포인터 y에 더해야 실제 grid 좌표 = pt.y + scrollOffsetY.

import { pointToCell, type GridLayout } from './coords';

describe('pointToCell', () => {
  const baseLayout: GridLayout = {
    headerWidth: 50,
    cellHeight: 10,
    cellWidth: 40, // 임의 (실제는 layout-time 측정)
    rowCount: 60,
    colCount: 7,
    scrollOffsetY: 0,
  };

  test('정상 영역 내부 — 첫 셀(row=0, col=0)', () => {
    expect(pointToCell({ x: 51, y: 1 }, baseLayout)).toEqual({ row: 0, col: 0 });
  });

  test('정상 영역 내부 — 마지막 셀(row=59, col=6)', () => {
    expect(pointToCell({ x: 50 + 6 * 40 + 1, y: 59 * 10 + 1 }, baseLayout)).toEqual({
      row: 59,
      col: 6,
    });
  });

  test('헤더 왼쪽(시간 라벨 영역) → null', () => {
    expect(pointToCell({ x: 49, y: 5 }, baseLayout)).toBeNull();
  });

  test('그리드 위쪽 negative y → null', () => {
    expect(pointToCell({ x: 100, y: -1 }, baseLayout)).toBeNull();
  });

  test('마지막 row 초과 → null', () => {
    expect(pointToCell({ x: 100, y: 60 * 10 + 1 }, baseLayout)).toBeNull();
  });

  test('마지막 col 초과 → null', () => {
    expect(pointToCell({ x: 50 + 7 * 40 + 1, y: 5 }, baseLayout)).toBeNull();
  });

  test('scrollOffsetY 반영 — 스크롤 100px 내려간 상태에서 y=1은 row=10', () => {
    const scrolled: GridLayout = { ...baseLayout, scrollOffsetY: 100 };
    expect(pointToCell({ x: 100, y: 1 }, scrolled)).toEqual({ row: 10, col: 1 });
  });

  test('경계값 — x가 정확히 cell 경계(col 1 시작)', () => {
    // col 0의 폭: [50, 90), col 1의 폭: [90, 130)
    expect(pointToCell({ x: 90, y: 5 }, baseLayout)).toEqual({ row: 0, col: 1 });
    expect(pointToCell({ x: 89, y: 5 }, baseLayout)).toEqual({ row: 0, col: 0 });
  });

  test('경계값 — y가 정확히 row 1 시작', () => {
    // row 0의 높이: [0, 10), row 1의 높이: [10, 20)
    expect(pointToCell({ x: 100, y: 10 }, baseLayout)).toEqual({ row: 1, col: 1 });
    expect(pointToCell({ x: 100, y: 9 }, baseLayout)).toEqual({ row: 0, col: 1 });
  });
});
