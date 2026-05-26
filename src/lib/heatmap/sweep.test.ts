// mergeSweep — drag sweep 결과(시작/끝 cell) → 선택 slot key set 산출.
//
// Gesture.Pan 시작 cell (r1,c1) ↔ 종료 cell (r2,c2) 사이의 사각형 영역을 선택.
// 단일 tap (r1=r2, c1=c2) = 단일 슬롯 toggle.
// (worklet에서 직접 호출 가능하도록 pure 함수로 분리.)

import { computeSweepKeys, toggleSlot, slotKey, applySweepToRecord } from './sweep';
import type { SlotKey } from './types';

describe('slotKey — `${col}:${start_minute}` 문자열 표현', () => {
  test('day_index 0, start_minute 540 → "0:540"', () => {
    expect(slotKey(0, 540)).toBe('0:540');
  });
});

describe('computeSweepKeys — drag 시작/종료 cell → slot key Set', () => {
  test('단일 tap (시작=종료) → 1개 slot', () => {
    const keys = computeSweepKeys({ row: 0, col: 0 }, { row: 0, col: 0 });
    expect(keys.size).toBe(1);
    expect(keys.has('0:540')).toBe(true);
  });

  test('세로 sweep (같은 day, row 0~3) → 4개 slot', () => {
    const keys = computeSweepKeys({ row: 0, col: 2 }, { row: 3, col: 2 });
    expect(keys.size).toBe(4);
    expect(keys.has('2:540')).toBe(true); // row 0
    expect(keys.has('2:555')).toBe(true); // row 1
    expect(keys.has('2:570')).toBe(true); // row 2
    expect(keys.has('2:585')).toBe(true); // row 3
  });

  test('역방향 sweep (row 3 → 0) 정규화', () => {
    const keys = computeSweepKeys({ row: 3, col: 0 }, { row: 0, col: 0 });
    expect(keys.size).toBe(4);
    expect(keys.has('0:540')).toBe(true);
    expect(keys.has('0:585')).toBe(true);
  });

  test('대각선 sweep (rect 영역) → row 0~1 × col 0~1 = 4개', () => {
    const keys = computeSweepKeys({ row: 0, col: 0 }, { row: 1, col: 1 });
    expect(keys.size).toBe(4);
    expect(keys.has('0:540')).toBe(true);
    expect(keys.has('0:555')).toBe(true);
    expect(keys.has('1:540')).toBe(true);
    expect(keys.has('1:555')).toBe(true);
  });
});

describe('toggleSlot — 기존 set에 추가/제거 toggle', () => {
  test('없으면 추가', () => {
    const set = new Set<SlotKey>();
    const next = toggleSlot(set, '0:540');
    expect(next.has('0:540')).toBe(true);
  });

  test('있으면 제거', () => {
    const set = new Set<SlotKey>(['0:540']);
    const next = toggleSlot(set, '0:540');
    expect(next.has('0:540')).toBe(false);
  });

  test('원본 set 불변 (immutable)', () => {
    const set = new Set<SlotKey>(['0:540']);
    toggleSlot(set, '0:540');
    expect(set.has('0:540')).toBe(true); // 원본 그대로
  });
});

describe('applySweepToRecord — worklet-safe sweep (Set 미지원 환경)', () => {
  test('mark=true: baseline + 새 영역 = 합집합', () => {
    const baseline: Record<SlotKey, boolean> = { '6:540': true };
    const result = applySweepToRecord(baseline, { row: 0, col: 0 }, { row: 1, col: 1 }, true);
    expect(result['0:540']).toBe(true);
    expect(result['0:555']).toBe(true);
    expect(result['1:540']).toBe(true);
    expect(result['1:555']).toBe(true);
    expect(result['6:540']).toBe(true); // baseline 보존
  });

  test('mark=false: baseline에서 영역 제거 (false로 마크)', () => {
    const baseline: Record<SlotKey, boolean> = {
      '0:540': true,
      '0:555': true,
      '6:540': true,
    };
    const result = applySweepToRecord(baseline, { row: 0, col: 0 }, { row: 1, col: 0 }, false);
    expect(result['0:540']).toBe(false);
    expect(result['0:555']).toBe(false);
    expect(result['6:540']).toBe(true);
  });

  test('원본 baseline 불변', () => {
    const baseline: Record<SlotKey, boolean> = { '0:540': true };
    applySweepToRecord(baseline, { row: 0, col: 0 }, { row: 0, col: 0 }, false);
    expect(baseline['0:540']).toBe(true);
  });

  test('역방향 sweep도 정규화', () => {
    const result = applySweepToRecord({}, { row: 3, col: 2 }, { row: 1, col: 0 }, true);
    expect(result['0:555']).toBe(true);
    expect(result['2:585']).toBe(true);
  });
});
