import { buildDateOptions, formatDateChip, todayKstIso } from './dateOptions';

describe('buildDateOptions', () => {
  test('base부터 count일간의 ISO 날짜를 반환', () => {
    expect(buildDateOptions('2026-05-30', 3)).toEqual(['2026-05-30', '2026-05-31', '2026-06-01']);
  });

  test('count <= 0 이면 빈 배열', () => {
    expect(buildDateOptions('2026-05-30', 0)).toEqual([]);
  });

  test('잘못된 base ISO면 빈 배열', () => {
    expect(buildDateOptions('not-a-date', 5)).toEqual([]);
  });
});

describe('formatDateChip', () => {
  test('M/d (요일) 형식 — 5/30로 시작', () => {
    const label = formatDateChip('2026-05-30');
    expect(label.startsWith('5/30')).toBe(true);
    expect(label).toMatch(/^\d+\/\d+ \(.+\)$/);
  });

  test('잘못된 ISO면 원본 반환', () => {
    expect(formatDateChip('not-a-date')).toBe('not-a-date');
  });
});

describe('todayKstIso', () => {
  test('yyyy-MM-dd 형식 문자열', () => {
    expect(todayKstIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
