import { selectionToConfirmRange } from './selectionToConfirmRange';

describe('selectionToConfirmRange', () => {
  test('빈 selection → error "시간을 먼저 선택해주세요"', () => {
    const result = selectionToConfirmRange({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('시간');
  });

  test('falsy value만 있는 selection → 빈 것으로 취급', () => {
    const result = selectionToConfirmRange({ '0:540': false, '0:555': false });
    expect(result.ok).toBe(false);
  });

  test('단일 슬롯 1개 → dayIndex=col, startMinute=slot, endMinute=slot+15', () => {
    const result = selectionToConfirmRange({ '2:600': true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dayIndex).toBe(2);
      expect(result.startMinute).toBe(600);
      expect(result.endMinute).toBe(615);
    }
  });

  test('연속 3슬롯 → 정확한 범위', () => {
    const result = selectionToConfirmRange({ '0:540': true, '0:555': true, '0:570': true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dayIndex).toBe(0);
      expect(result.startMinute).toBe(540);
      expect(result.endMinute).toBe(585);
    }
  });

  test('두 날짜 동시 선택 → error', () => {
    const result = selectionToConfirmRange({ '0:540': true, '1:540': true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/한 (날짜|날)/);
  });

  test('같은 날 비연속 슬롯 → error "연속"', () => {
    // 540, 555 빠짐, 570
    const result = selectionToConfirmRange({ '0:540': true, '0:570': true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('연속');
  });

  test('정렬되지 않은 입력 순서에도 결정적 결과', () => {
    const result = selectionToConfirmRange({ '3:600': true, '3:570': true, '3:585': true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dayIndex).toBe(3);
      expect(result.startMinute).toBe(570);
      expect(result.endMinute).toBe(615);
    }
  });

  test('malformed key (콜론 없음) → error', () => {
    const result = selectionToConfirmRange({ invalid: true });
    expect(result.ok).toBe(false);
  });

  test('malformed key (숫자 아님) → error', () => {
    const result = selectionToConfirmRange({ 'a:540': true });
    expect(result.ok).toBe(false);
  });

  test('범위 밖 startMinute (<540) → error', () => {
    const result = selectionToConfirmRange({ '0:300': true });
    expect(result.ok).toBe(false);
  });

  test('범위 밖 startMinute (>=1440) → error', () => {
    const result = selectionToConfirmRange({ '0:1440': true });
    expect(result.ok).toBe(false);
  });

  test('15분 단위 아님 → error', () => {
    const result = selectionToConfirmRange({ '0:541': true });
    expect(result.ok).toBe(false);
  });

  test('falsy 섞인 selection → true만 추출', () => {
    const result = selectionToConfirmRange({
      '0:540': true,
      '0:555': false,
      '0:570': true,
    });
    // 540, 570 — 555 빠짐 → 비연속
    expect(result.ok).toBe(false);
  });

  test('23:45 슬롯 (1425) → endMinute=1440 (24:00 boundary OK)', () => {
    const result = selectionToConfirmRange({ '0:1425': true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.startMinute).toBe(1425);
      expect(result.endMinute).toBe(1440);
    }
  });

  test('dayIndex 음수 → error', () => {
    const result = selectionToConfirmRange({ '-1:540': true });
    expect(result.ok).toBe(false);
  });
});
