// applyHeatmapPayload — Realtime broadcast payload → CellState[][] 변환.
//
// **S05b spec extension (S05a alignment 권고)**: D11 본문 payload는 `start_minute`만
// 가지나 votes 테이블에 `day DATE` 컬럼이 있어 7일 grid에 필요. 본 헬퍼는 확장된
// payload `{slots: [{day_index, start_minute, count}]}`를 가정. Edge Function 측 동기화는
// 별도 Q (OPEN_QUESTIONS Q-S05b-1로 등록).
//
// **격자 spec**: 60slot × 7day = 420 cell. row = (start_minute - 540) / 15 (0~59).
// col = day_index (0~6). 09:00 = 540, 23:45 = 1425.

import { applyHeatmapPayload, type HeatmapPayload } from './applyPayload';
import type { CellState, SlotKey } from './types';

const makeEmpty = (): CellState[][] =>
  Array.from({ length: 60 }, () =>
    Array.from({ length: 7 }, () => ({ state: 'heat-0' as const, count: 0 })),
  );

describe('applyHeatmapPayload — payload → 60×7 CellState[][]', () => {
  test('빈 payload → 모두 heat-0 (변동 없음)', () => {
    const payload: HeatmapPayload = { slots: [], updated_at: '2026-05-26T12:00:00+09:00' };
    const next = applyHeatmapPayload(makeEmpty(), payload, new Set(), 7);

    expect(next).toHaveLength(60);
    expect(next[0]).toHaveLength(7);
    expect(next[0]?.[0]).toEqual({ state: 'heat-0', count: 0 });
    expect(next[59]?.[6]).toEqual({ state: 'heat-0', count: 0 });
  });

  test('단일 슬롯 count=1, maxCount=7 → 해당 cell만 heat-1', () => {
    const payload: HeatmapPayload = {
      slots: [{ day_index: 0, start_minute: 540, count: 1 }],
      updated_at: '2026-05-26T12:00:00+09:00',
    };
    const next = applyHeatmapPayload(makeEmpty(), payload, new Set(), 7);

    expect(next[0]?.[0]).toEqual({ state: 'heat-1', count: 1 });
    expect(next[0]?.[1]).toEqual({ state: 'heat-0', count: 0 });
    expect(next[1]?.[0]).toEqual({ state: 'heat-0', count: 0 });
  });

  test('row 계산: start_minute=555 (09:15) → row=1', () => {
    const payload: HeatmapPayload = {
      slots: [{ day_index: 0, start_minute: 555, count: 4 }],
      updated_at: '2026-05-26T12:00:00+09:00',
    };
    const next = applyHeatmapPayload(makeEmpty(), payload, new Set(), 7);

    expect(next[0]?.[0]).toEqual({ state: 'heat-0', count: 0 });
    expect(next[1]?.[0]).toEqual({ state: 'heat-3', count: 4 }); // 4/7 → heat-3
  });

  test('row 계산: start_minute=1425 (23:45) → row=59 (마지막 슬롯)', () => {
    const payload: HeatmapPayload = {
      slots: [{ day_index: 6, start_minute: 1425, count: 7 }],
      updated_at: '2026-05-26T12:00:00+09:00',
    };
    const next = applyHeatmapPayload(makeEmpty(), payload, new Set(), 7);

    expect(next[59]?.[6]).toEqual({ state: 'heat-4', count: 7 });
  });

  test('selfMarks set이 있으면 해당 cell은 state=self로 override (count는 raw 유지)', () => {
    const payload: HeatmapPayload = {
      slots: [{ day_index: 2, start_minute: 600, count: 3 }],
      updated_at: '2026-05-26T12:00:00+09:00',
    };
    // 본인이 600분(10:00) day 2를 골랐다고 mark
    const selfMarks = new Set<SlotKey>(['2:600']);
    const next = applyHeatmapPayload(makeEmpty(), payload, selfMarks, 7);

    // row = (600-540)/15 = 4
    expect(next[4]?.[2]).toEqual({ state: 'self', count: 3 });
  });

  test('selfMarks가 있고 payload에 그 slot이 없으면도 self로 표시 (count=1: 본인 1명)', () => {
    const payload: HeatmapPayload = {
      slots: [],
      updated_at: '2026-05-26T12:00:00+09:00',
    };
    const selfMarks = new Set<SlotKey>(['0:540']);
    const next = applyHeatmapPayload(makeEmpty(), payload, selfMarks, 7);

    // row = 0, col = 0
    expect(next[0]?.[0]).toEqual({ state: 'self', count: 1 });
  });

  test('day_index 범위 밖 (>=dayCount) → 무시 (graceful)', () => {
    const payload: HeatmapPayload = {
      slots: [
        { day_index: 0, start_minute: 540, count: 2 },
        { day_index: 9, start_minute: 540, count: 99 }, // 범위 밖
      ],
      updated_at: '2026-05-26T12:00:00+09:00',
    };
    const next = applyHeatmapPayload(makeEmpty(), payload, new Set(), 7);

    expect(next[0]?.[0]).toEqual({ state: 'heat-2', count: 2 });
    // 9는 무시 — 다른 cell 영향 없음
  });

  test('start_minute 범위 밖 (<540 or >=1440) → 무시', () => {
    const payload: HeatmapPayload = {
      slots: [
        { day_index: 0, start_minute: 0, count: 5 }, // 09:00 이전 → 무시
        { day_index: 0, start_minute: 1440, count: 5 }, // 24:00 → 무시
        { day_index: 0, start_minute: 600, count: 2 }, // valid
      ],
      updated_at: '2026-05-26T12:00:00+09:00',
    };
    const next = applyHeatmapPayload(makeEmpty(), payload, new Set(), 7);

    // 무시된 슬롯은 cell 상태 변경 없음
    expect(next[0]?.[0]).toEqual({ state: 'heat-0', count: 0 });
    expect(next[4]?.[0]).toEqual({ state: 'heat-2', count: 2 }); // row=(600-540)/15=4
  });

  test('15분 비정렬 start_minute (D14 violation) → 무시 (graceful, server CHECK가 막아야 정상)', () => {
    const payload: HeatmapPayload = {
      slots: [{ day_index: 0, start_minute: 547, count: 3 }], // not % 15
      updated_at: '2026-05-26T12:00:00+09:00',
    };
    const next = applyHeatmapPayload(makeEmpty(), payload, new Set(), 7);

    // 모두 heat-0 유지
    expect(next[0]?.[0]).toEqual({ state: 'heat-0', count: 0 });
  });
});
