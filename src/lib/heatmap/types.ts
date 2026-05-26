// 시간 그리드 + 히트맵 공유 타입.
//
// 격자 spec (DESIGN §10.1, S00 votes table):
//   - rows: 60 (09:00 ~ 23:45, 15분 단위)
//   - cols: 7 (월~일 또는 group 시작일 기준 0~6 offset)
//   - start_minute: 540 ~ 1425 (분, 15분 단위 CHECK — D14)
//
// CellState.state는 DESIGN §10.1 + D10 5-stop ramp + D10 self 별도 시각 (보라 보더 + brand-50 fill)에 매칭.

export type CellStateKind =
  | 'heat-0' // 빈 슬롯 (중립 그레이, surface-3)
  | 'heat-1'
  | 'heat-2'
  | 'heat-3'
  | 'heat-4'
  | 'self'; // 본인 선택 (보라 보더 2pt + brand-50 fill, ramp와 별도 — D10)

export interface CellState {
  state: CellStateKind;
  count: number; // 해당 슬롯 투표 수 (raw)
}

// `${col}:${start_minute}` — 본인 마크 + sweep selection 키.
export type SlotKey = `${number}:${number}`;
