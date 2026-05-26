// applyHeatmapPayload — Realtime broadcast payload → CellState[][] 변환.
//
// **S05b spec extension (Q-S05b-1 등록 권고)**: D11 본문 payload는 `start_minute`만 명시
// 하나, votes 테이블에 `day DATE` 컬럼이 있어 7일 grid를 그리려면 day 차원 필요.
// 본 헬퍼는 `{slots: [{day_index, start_minute, count}], updated_at}` 확장 payload를 가정.
// S05a Edge Function alignment 후 D11 본문 update 권고.
//
// 격자 매핑:
//   row = (start_minute - 540) / 15  → 0~59 (09:00 ~ 23:45)
//   col = day_index                  → 0~(dayCount-1) (보통 7)
//
// 범위 밖 슬롯 (start_minute < 540 또는 ≥ 1440, day_index ≥ dayCount, 15분 비정렬)은
// graceful 무시 — 서버 CHECK가 막아야 정상이지만 클라 측 안전망.
//
// selfMarks (Set<`${col}:${start_minute}`>)는 본인이 선택한 슬롯 표시.
// 본인 슬롯은 ramp 색이 아닌 'self' state (D10 — 보라 보더 + brand-50 fill).
// count는 raw 유지 (본인 1명만 → count=1).

import { classifyHeat } from './classify';
import type { CellState, SlotKey } from './types';

export interface HeatmapSlot {
  day_index: number;
  start_minute: number;
  count: number;
}

export interface HeatmapPayload {
  slots: HeatmapSlot[];
  updated_at: string; // KST ISO 8601 (D13)
}

const ROW_COUNT = 60;
const SLOT_MINUTES = 15;
const GRID_START_MINUTE = 540; // 09:00
const GRID_END_MINUTE = 1440; // 24:00 exclusive

export function applyHeatmapPayload(
  _current: CellState[][],
  payload: HeatmapPayload,
  selfMarks: Set<SlotKey>,
  maxCount: number,
  dayCount = 7,
): CellState[][] {
  // 시작: 모든 cell heat-0 reset (broadcast는 group 전체 합산이므로 partial diff 아님)
  const next: CellState[][] = Array.from({ length: ROW_COUNT }, () =>
    Array.from({ length: dayCount }, () => ({ state: 'heat-0' as const, count: 0 })),
  );

  // 1차: payload slots 적용 (ramp 분류)
  for (const slot of payload.slots) {
    if (slot.start_minute < GRID_START_MINUTE) continue;
    if (slot.start_minute >= GRID_END_MINUTE) continue;
    if (slot.start_minute % SLOT_MINUTES !== 0) continue;
    if (slot.day_index < 0 || slot.day_index >= dayCount) continue;

    const row = (slot.start_minute - GRID_START_MINUTE) / SLOT_MINUTES;
    if (row < 0 || row >= ROW_COUNT) continue;

    const cellRow = next[row];
    if (!cellRow) continue;

    cellRow[slot.day_index] = {
      state: classifyHeat(slot.count, maxCount),
      count: slot.count,
    };
  }

  // 2차: 본인 마크 override (ramp보다 우선 — D10)
  for (const key of selfMarks) {
    const [colStr, minStr] = key.split(':');
    if (!colStr || !minStr) continue;
    const col = Number(colStr);
    const minute = Number(minStr);
    if (!Number.isFinite(col) || !Number.isFinite(minute)) continue;
    if (col < 0 || col >= dayCount) continue;
    if (minute < GRID_START_MINUTE || minute >= GRID_END_MINUTE) continue;
    if (minute % SLOT_MINUTES !== 0) continue;

    const row = (minute - GRID_START_MINUTE) / SLOT_MINUTES;
    const cellRow = next[row];
    if (!cellRow) continue;

    const existing = cellRow[col];
    // payload에 해당 slot이 없으면 본인 1명만 카운트
    const rawCount = existing?.count ?? 0;
    cellRow[col] = {
      state: 'self',
      count: rawCount > 0 ? rawCount : 1,
    };
  }

  return next;
}
