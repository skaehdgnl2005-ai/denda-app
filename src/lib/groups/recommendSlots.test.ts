import { recommendSlots } from './recommendSlots';

// 격자 row → start_minute 매핑: row r = 540 + r*15 (09:00 시작, 15분 단위).
// recommendSlots는 cells[row][col].count만 읽는다 (state 무관).
const ROW_COUNT = 60;

function emptyGrid(cols: number): { count: number }[][] {
  return Array.from({ length: ROW_COUNT }, () =>
    Array.from({ length: cols }, () => ({ count: 0 })),
  );
}

function setCount(grid: { count: number }[][], col: number, row: number, count: number): void {
  grid[row]![col] = { count };
}

const DATES = ['2026-06-01', '2026-06-02', '2026-06-03'];

describe('recommendSlots', () => {
  test('빈 cells → 빈 배열', () => {
    expect(recommendSlots([], DATES)).toEqual([]);
  });

  test('전부 0 → 빈 배열 (투표 없음)', () => {
    expect(recommendSlots(emptyGrid(3), DATES)).toEqual([]);
  });

  test('단일 연속 구간 → 추천 1개 (start/end/count 정확)', () => {
    const grid = emptyGrid(3);
    // col0 rows 0,1,2 (09:00~09:45) count=1
    setCount(grid, 0, 0, 1);
    setCount(grid, 0, 1, 1);
    setCount(grid, 0, 2, 1);

    const result = recommendSlots(grid, DATES);

    expect(result).toEqual([
      {
        rank: 1,
        dayIndex: 0,
        day: '2026-06-01',
        startMinute: 540,
        endMinute: 585,
        count: 1,
      },
    ]);
  });

  test('인원수 내림차순 — 더 많은 인원이 가능한 구간이 1순위', () => {
    const grid = emptyGrid(3);
    // col0 rows0-1 count=2 (09:00~09:30)
    setCount(grid, 0, 0, 2);
    setCount(grid, 0, 1, 2);
    // col0 rows3-4 count=3 (09:45~10:15) — row2=0이라 분리
    setCount(grid, 0, 3, 3);
    setCount(grid, 0, 4, 3);

    const result = recommendSlots(grid, DATES);

    expect(result.map((r) => r.count)).toEqual([3, 2]);
    expect(result[0]).toMatchObject({ rank: 1, startMinute: 585, endMinute: 615, count: 3 });
    expect(result[1]).toMatchObject({ rank: 2, startMinute: 540, endMinute: 570, count: 2 });
  });

  test('같은 인원수 → 더 긴 구간 우선', () => {
    const grid = emptyGrid(3);
    // col0 rows0-1 count=2 (len 2)
    setCount(grid, 0, 0, 2);
    setCount(grid, 0, 1, 2);
    // col1 rows0-2 count=2 (len 3)
    setCount(grid, 1, 0, 2);
    setCount(grid, 1, 1, 2);
    setCount(grid, 1, 2, 2);

    const result = recommendSlots(grid, DATES);

    expect(result[0]).toMatchObject({ rank: 1, dayIndex: 1, startMinute: 540, endMinute: 585 });
    expect(result[1]).toMatchObject({ rank: 2, dayIndex: 0, startMinute: 540, endMinute: 570 });
  });

  test('같은 인원수·같은 길이 → 이른 날짜(dayIndex) 우선', () => {
    const grid = emptyGrid(3);
    setCount(grid, 2, 0, 2); // col2 row0
    setCount(grid, 2, 1, 2);
    setCount(grid, 0, 0, 2); // col0 row0
    setCount(grid, 0, 1, 2);

    const result = recommendSlots(grid, DATES);

    expect(result.map((r) => r.dayIndex)).toEqual([0, 2]);
  });

  test('여러 날짜가 후보면 여러 날짜를 추천', () => {
    const grid = emptyGrid(3);
    setCount(grid, 0, 0, 3); // col0
    setCount(grid, 0, 1, 3);
    setCount(grid, 2, 4, 2); // col2

    const result = recommendSlots(grid, DATES);

    expect(result).toHaveLength(2);
    expect(new Set(result.map((r) => r.dayIndex))).toEqual(new Set([0, 2]));
  });

  test('상위 3개만 반환 (기본 limit)', () => {
    const grid = emptyGrid(3);
    // 4개의 분리된 단일 셀 구간 (각각 다른 count로 순위 확정)
    setCount(grid, 0, 0, 5);
    setCount(grid, 0, 2, 4);
    setCount(grid, 0, 4, 3);
    setCount(grid, 0, 6, 2);

    const result = recommendSlots(grid, DATES);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.count)).toEqual([5, 4, 3]);
  });

  test('row→minute 매핑 정확 (rows 4~7 = 10:00~11:00)', () => {
    const grid = emptyGrid(3);
    setCount(grid, 0, 4, 2);
    setCount(grid, 0, 5, 2);
    setCount(grid, 0, 6, 2);
    setCount(grid, 0, 7, 2);

    const [rec] = recommendSlots(grid, DATES);

    expect(rec).toMatchObject({ startMinute: 600, endMinute: 660 });
  });

  test('24:00 경계 — 마지막 row(59) 단일 셀 → 23:45~24:00', () => {
    const grid = emptyGrid(3);
    setCount(grid, 0, 59, 1);

    const [rec] = recommendSlots(grid, DATES);

    expect(rec).toMatchObject({ startMinute: 1425, endMinute: 1440, count: 1 });
  });

  test('인접한 다른 인원수는 별도 구간으로 분리', () => {
    const grid = emptyGrid(3);
    // col0: row0=2, row1=3, row2=3, row3=2
    setCount(grid, 0, 0, 2);
    setCount(grid, 0, 1, 3);
    setCount(grid, 0, 2, 3);
    setCount(grid, 0, 3, 2);

    const result = recommendSlots(grid, DATES);

    // 1순위 = count3 (rows1-2, 09:15~09:45), 나머지 2개는 count2 단일 셀
    expect(result[0]).toMatchObject({ count: 3, startMinute: 555, endMinute: 585 });
    expect(result.slice(1).map((r) => r.count)).toEqual([2, 2]);
    // count2 두 구간은 이른 순서 (row0 → row3)
    expect(result[1]!.startMinute).toBeLessThan(result[2]!.startMinute);
  });

  test('day_index에 해당하는 날짜가 없으면 제외 (cells col > dates 길이)', () => {
    const grid = emptyGrid(3); // 3 cols
    setCount(grid, 2, 0, 2); // col2
    setCount(grid, 2, 1, 2);

    // dates에 2개만 → col2(dayIndex 2)는 라벨 불가 → 제외
    const result = recommendSlots(grid, ['2026-06-01', '2026-06-02']);

    expect(result).toEqual([]);
  });

  test('limit 인자로 반환 개수 조절', () => {
    const grid = emptyGrid(3);
    setCount(grid, 0, 0, 5);
    setCount(grid, 0, 2, 4);
    setCount(grid, 0, 4, 3);

    expect(recommendSlots(grid, DATES, 1)).toHaveLength(1);
    expect(recommendSlots(grid, DATES, 2)).toHaveLength(2);
  });
});
