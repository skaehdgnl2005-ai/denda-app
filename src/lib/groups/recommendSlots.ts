// 모임 확정 추천 — 히트맵 cells에서 "가장 많은 인원이 가능한" 단일 날짜 연속 구간을 뽑는다.
//
// 배경: 투표는 여러 날짜 자유 (handleSweepCommit). 하지만 모임 확정은 단일 날짜의 한 연속
// 구간이어야 한다 (confirmGroup: dayIndex + start/end minute). 호스트의 투표 선택을 그대로
// 확정 입력으로 쓰면 "한 날짜만" 충돌이 났다 → 확정은 투표와 분리해 히트맵 집계에서 추천한다.
//
// D11: 클라이언트 raw votes 합산 금지. cells는 votes_aggregate Edge가 합산 후 broadcast한
// 결과(=호스트가 화면에서 보는 히트맵)다. 추천은 이 cells.count만 읽는다 (state 무관 — self
// 셀도 count 그대로 반영).
//
// 후보 정의: 같은 col(날짜) 안에서 count가 동일한 최대 연속 run. count > 0만.
// 정렬: 인원수(count) 내림차순 → 길이 내림차순 → 이른 날짜(dayIndex) → 이른 시간(startMinute).

const SLOT_MINUTES = 15;
const GRID_START_MINUTE = 540; // 09:00 (row 0)

export interface RecommendedSlot {
  /** 1-based 순위 */
  rank: number;
  dayIndex: number;
  /** dates[dayIndex] — UI 요일 라벨용 */
  day: string;
  startMinute: number;
  endMinute: number;
  /** 해당 구간 가능 인원수 */
  count: number;
}

interface Candidate {
  dayIndex: number;
  day: string;
  startMinute: number;
  endMinute: number;
  count: number;
}

/** cells[row][col].count만 필요 (CellState 구조적 부분집합). */
type CountCell = { count: number };

export function recommendSlots(
  cells: readonly (readonly CountCell[])[],
  dates: readonly string[],
  limit = 3,
): RecommendedSlot[] {
  const rowCount = cells.length;
  if (rowCount === 0) return [];
  const colCount = cells[0]?.length ?? 0;

  const candidates: Candidate[] = [];

  // dates로 라벨 가능한 col만 (cells col이 dates보다 많으면 라벨 불가 → 제외)
  const maxCol = Math.min(colCount, dates.length);

  for (let col = 0; col < maxCol; col++) {
    const day = dates[col]!;
    let runStartRow = -1;
    let runCount = 0;

    const flush = (endRowExclusive: number): void => {
      if (runStartRow < 0 || runCount <= 0) return;
      candidates.push({
        dayIndex: col,
        day,
        startMinute: GRID_START_MINUTE + runStartRow * SLOT_MINUTES,
        endMinute: GRID_START_MINUTE + endRowExclusive * SLOT_MINUTES,
        count: runCount,
      });
    };

    for (let row = 0; row < rowCount; row++) {
      const count = cells[row]?.[col]?.count ?? 0;
      if (count === runCount && count > 0) {
        // 같은 count 연속 — run 유지
        continue;
      }
      // count가 바뀜 → 직전 run 마감
      flush(row);
      runStartRow = count > 0 ? row : -1;
      runCount = count > 0 ? count : 0;
    }
    flush(rowCount);
  }

  candidates.sort(
    (a, b) =>
      b.count - a.count ||
      b.endMinute - b.startMinute - (a.endMinute - a.startMinute) ||
      a.dayIndex - b.dayIndex ||
      a.startMinute - b.startMinute,
  );

  return candidates.slice(0, limit).map((c, i) => ({
    rank: i + 1,
    dayIndex: c.dayIndex,
    day: c.day,
    startMinute: c.startMinute,
    endMinute: c.endMinute,
    count: c.count,
  }));
}
