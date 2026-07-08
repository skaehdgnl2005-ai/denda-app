import { buildMonthMatrix, monthTitle, shiftMonth, WEEKDAY_LABELS } from './monthMatrix';

describe('WEEKDAY_LABELS', () => {
  test('일요일 시작 7개', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe('일');
    expect(WEEKDAY_LABELS[6]).toBe('토');
  });
});

describe('buildMonthMatrix — 2026년 6월 (6/1 = 월)', () => {
  const weeks = buildMonthMatrix('2026-06-15');

  test('5주 × 7열', () => {
    expect(weeks).toHaveLength(5);
    weeks.forEach((w) => expect(w).toHaveLength(7));
  });

  test('첫 셀은 직전 달 일요일(5/31), inMonth=false', () => {
    expect(weeks[0]?.[0]).toEqual({ iso: '2026-05-31', day: 31, inMonth: false, weekday: 0 });
  });

  test('6/1(월)은 첫 주 두 번째 칸, inMonth=true', () => {
    expect(weeks[0]?.[1]).toEqual({ iso: '2026-06-01', day: 1, inMonth: true, weekday: 1 });
  });

  test('6/15는 셋째 주 월요일 칸', () => {
    expect(weeks[2]?.[1]).toEqual({ iso: '2026-06-15', day: 15, inMonth: true, weekday: 1 });
  });

  test('마지막 셀은 다음 달(7/4), inMonth=false', () => {
    expect(weeks[4]?.[6]).toEqual({ iso: '2026-07-04', day: 4, inMonth: false, weekday: 6 });
  });
});

describe('buildMonthMatrix — 경계', () => {
  test('잘못된 ISO면 빈 배열', () => {
    expect(buildMonthMatrix('not-a-date')).toEqual([]);
  });

  test('2026년 2월(비윤년) 28일까지만 inMonth', () => {
    const weeks = buildMonthMatrix('2026-02-10');
    const inMonthDays = weeks
      .flat()
      .filter((c) => c.inMonth)
      .map((c) => c.day);
    expect(Math.max(...inMonthDays)).toBe(28);
    expect(inMonthDays).toHaveLength(28);
  });
});

describe('monthTitle', () => {
  test('"2026년 6월"', () => {
    expect(monthTitle('2026-06-01')).toBe('2026년 6월');
    expect(monthTitle('2026-06-30')).toBe('2026년 6월');
  });
  test('잘못된 ISO면 원본', () => {
    expect(monthTitle('bad')).toBe('bad');
  });
});

describe('shiftMonth', () => {
  test('+1 → 다음 달 1일', () => {
    expect(shiftMonth('2026-06-10', 1)).toBe('2026-07-01');
  });
  test('-1 → 이전 달 1일', () => {
    expect(shiftMonth('2026-06-10', -1)).toBe('2026-05-01');
  });
  test('0 → 같은 달 1일 (경계 비교용)', () => {
    expect(shiftMonth('2026-06-10', 0)).toBe('2026-06-01');
  });
  test('연도 경계 (12월 +1 → 다음 해 1월)', () => {
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-01');
  });
  test('잘못된 ISO면 원본', () => {
    expect(shiftMonth('bad', 1)).toBe('bad');
  });
});
