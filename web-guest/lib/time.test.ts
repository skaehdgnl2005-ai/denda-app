import { dayOfWeekKst, formatHeaderDate, isValidDateString, KST_ZONE } from './time';

describe('isValidDateString — YYYY-MM-DD 검증', () => {
  it('유효한 날짜', () => {
    expect(isValidDateString('2026-05-26')).toBe(true);
  });

  it('윤년 2/29', () => {
    expect(isValidDateString('2024-02-29')).toBe(true);
  });

  it('비윤년 2/29 reject', () => {
    expect(isValidDateString('2025-02-29')).toBe(false);
  });

  it('잘못된 포맷', () => {
    expect(isValidDateString('2026/05/26')).toBe(false);
    expect(isValidDateString('26-05-26')).toBe(false);
    expect(isValidDateString('2026-5-26')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });

  it('월/일 범위 밖', () => {
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-05-32')).toBe(false);
    expect(isValidDateString('2026-00-15')).toBe(false);
    expect(isValidDateString('2026-05-00')).toBe(false);
  });
});

describe('dayOfWeekKst — D13 KST 기준 한국어 요일 (월/화/수/목/금/토/일)', () => {
  it('2026-05-26 화요일 → "화"', () => {
    expect(dayOfWeekKst('2026-05-26')).toBe('화');
  });

  it('2026-05-25 월요일 → "월"', () => {
    expect(dayOfWeekKst('2026-05-25')).toBe('월');
  });

  it('2026-05-24 일요일 → "일"', () => {
    expect(dayOfWeekKst('2026-05-24')).toBe('일');
  });

  it('2026-05-23 토요일 → "토"', () => {
    expect(dayOfWeekKst('2026-05-23')).toBe('토');
  });

  it('2026-05-30 토요일 → "토"', () => {
    expect(dayOfWeekKst('2026-05-30')).toBe('토');
  });

  it('잘못된 입력 → throw 한국어 에러', () => {
    expect(() => dayOfWeekKst('2026/05/26')).toThrow(/날짜 형식/);
    expect(() => dayOfWeekKst('')).toThrow(/날짜 형식/);
    expect(() => dayOfWeekKst('2025-02-29')).toThrow(/날짜 형식/);
  });

  // KST timezone 강제 검증: UTC 자정 직후라도 KST는 다음 날 09시
  // → dayOfWeekKst는 입력된 ISO date 자체의 요일을 반환 (KST 해석)
  it('UTC 컴퓨터에서도 동일 KST 요일 (timezone-independent)', () => {
    // 2026-01-01은 목요일 — UTC/KST 둘 다 같은 day. timezone bug 없음 확인용
    expect(dayOfWeekKst('2026-01-01')).toBe('목');
  });
});

describe('formatHeaderDate — "M/D" 포맷 (앞 0 제거, KST 해석)', () => {
  it('2026-05-26 → "5/26"', () => {
    expect(formatHeaderDate('2026-05-26')).toBe('5/26');
  });

  it('2026-12-31 → "12/31"', () => {
    expect(formatHeaderDate('2026-12-31')).toBe('12/31');
  });

  it('2026-01-01 → "1/1"', () => {
    expect(formatHeaderDate('2026-01-01')).toBe('1/1');
  });

  it('2026-10-09 → "10/9"', () => {
    expect(formatHeaderDate('2026-10-09')).toBe('10/9');
  });

  it('잘못된 입력 → throw', () => {
    expect(() => formatHeaderDate('2026/05/26')).toThrow(/날짜 형식/);
    expect(() => formatHeaderDate('bad')).toThrow(/날짜 형식/);
  });
});

describe('KST_ZONE 상수', () => {
  it('Asia/Seoul', () => {
    expect(KST_ZONE).toBe('Asia/Seoul');
  });
});
