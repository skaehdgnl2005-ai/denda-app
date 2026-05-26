// sweep — drag sweep 시작/종료 cell → slot key Set 계산.
//
// Gesture.Pan worklet에서 호출 가능하도록 순수 함수로 분리 (D12 의무 패턴).
// 시작/종료 cell의 row·col을 정규화 (역방향 sweep 허용) → 사각형 영역의 모든 slot key.
//
// slotKey 포맷: `${col}:${start_minute}` — selfMarks Set과 동일 인코딩.

import type { SlotKey } from './types';

const SLOT_MINUTES = 15;
const GRID_START_MINUTE = 540; // 09:00

export interface CellCoord {
  row: number; // 0~59
  col: number; // 0~6
}

export function slotKey(col: number, startMinute: number): SlotKey {
  return `${col}:${startMinute}` as SlotKey;
}

export function rowToStartMinute(row: number): number {
  return GRID_START_MINUTE + row * SLOT_MINUTES;
}

export function computeSweepKeys(start: CellCoord, end: CellCoord): Set<SlotKey> {
  const rowMin = Math.min(start.row, end.row);
  const rowMax = Math.max(start.row, end.row);
  const colMin = Math.min(start.col, end.col);
  const colMax = Math.max(start.col, end.col);

  const keys = new Set<SlotKey>();
  for (let row = rowMin; row <= rowMax; row++) {
    const startMinute = rowToStartMinute(row);
    for (let col = colMin; col <= colMax; col++) {
      keys.add(slotKey(col, startMinute));
    }
  }
  return keys;
}

export function toggleSlot(set: Set<SlotKey>, key: SlotKey): Set<SlotKey> {
  const next = new Set(set);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

// applySweepToRecord — worklet-safe sweep (Set 미지원 reanimated UI thread).
//
// baseline (drag 시작 시점 selection snapshot)에 시작/종료 사각형 영역을 mark 값으로 덮어쓴다.
// add 모드(mark=true): 영역의 모든 슬롯을 true로.
// remove 모드(mark=false): 영역의 모든 슬롯을 false로 (key 자체는 남지만 false).
// 호출자는 commit 시 falsy 값을 제외한다 (selectionToVoteSlots 참조).
export function applySweepToRecord(
  baseline: Record<SlotKey, boolean>,
  start: CellCoord,
  end: CellCoord,
  mark: boolean,
): Record<SlotKey, boolean> {
  'worklet';
  const result: Record<SlotKey, boolean> = { ...baseline };
  const rowMin = Math.min(start.row, end.row);
  const rowMax = Math.max(start.row, end.row);
  const colMin = Math.min(start.col, end.col);
  const colMax = Math.max(start.col, end.col);
  for (let row = rowMin; row <= rowMax; row++) {
    const startMinute = GRID_START_MINUTE + row * SLOT_MINUTES;
    for (let col = colMin; col <= colMax; col++) {
      const key = `${col}:${startMinute}` as SlotKey;
      result[key] = mark;
    }
  }
  return result;
}
