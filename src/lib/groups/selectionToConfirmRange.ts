// S05-screen-confirm — sweep selection을 confirmGroup 입력으로 변환.
//
// 사용자가 시간 그리드에서 선택한 슬롯들 (Record<SlotKey, boolean>)을
// 단일 날짜 · 연속 범위로 검증하고 {dayIndex, startMinute, endMinute}로 산출한다.
//
// 모임 확정은 단일 날짜의 하나의 연속 구간이어야 함:
//   - 두 날짜 동시 선택 → 한 날짜만 선택해주세요
//   - 같은 날 비연속 → 연속된 시간을 선택해주세요
//   - 빈 선택 → 시간을 먼저 선택해주세요
//
// SlotKey 형식: `${col}:${start_minute}` — useSweepGesture의 selection sharedValue 키와 동일.

const SLOT_MINUTES = 15;
const GRID_START_MINUTE = 540; // 09:00
const GRID_END_MINUTE = 1440; // 24:00

export type ConfirmRangeResult =
  | { ok: true; dayIndex: number; startMinute: number; endMinute: number }
  | { ok: false; error: string };

interface ParsedSlot {
  col: number;
  startMinute: number;
}

function parseSlotKey(key: string): ParsedSlot | null {
  const colonIdx = key.indexOf(':');
  if (colonIdx <= 0 || colonIdx === key.length - 1) return null;
  const colStr = key.slice(0, colonIdx);
  const minStr = key.slice(colonIdx + 1);
  // Number()는 빈 문자열을 0으로 변환하므로 명시적 검사
  if (!/^-?\d+$/.test(colStr) || !/^-?\d+$/.test(minStr)) return null;
  const col = Number(colStr);
  const startMinute = Number(minStr);
  if (!Number.isInteger(col) || col < 0) return null;
  if (!Number.isInteger(startMinute)) return null;
  if (startMinute % SLOT_MINUTES !== 0) return null;
  if (startMinute < GRID_START_MINUTE || startMinute >= GRID_END_MINUTE) return null;
  return { col, startMinute };
}

export function selectionToConfirmRange(
  selection: Readonly<Record<string, boolean>>,
): ConfirmRangeResult {
  const parsed: ParsedSlot[] = [];
  for (const key of Object.keys(selection)) {
    if (!selection[key]) continue;
    const slot = parseSlotKey(key);
    if (!slot) {
      return { ok: false, error: '시간 선택이 올바르지 않아요. 다시 선택해주세요.' };
    }
    parsed.push(slot);
  }

  if (parsed.length === 0) {
    return { ok: false, error: '시간을 먼저 선택해주세요.' };
  }

  const dayIndex = parsed[0]!.col;
  for (const slot of parsed) {
    if (slot.col !== dayIndex) {
      return { ok: false, error: '한 날짜의 시간만 선택해주세요.' };
    }
  }

  const sorted = parsed.map((s) => s.startMinute).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! - sorted[i - 1]! !== SLOT_MINUTES) {
      return { ok: false, error: '연속된 시간을 선택해주세요.' };
    }
  }

  const startMinute = sorted[0]!;
  const endMinute = sorted[sorted.length - 1]! + SLOT_MINUTES;
  return { ok: true, dayIndex, startMinute, endMinute };
}
