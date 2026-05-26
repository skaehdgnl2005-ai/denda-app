// S03b — 학기 시작·종료 입력 검증 단위 테스트
// D13 KST. 학기 범위 sanity check.

import {
  validateSemesterDate,
  validateSemesterRange,
  formatSemesterError,
  isSemesterValid,
} from './semesterValidation';

describe('validateSemesterDate', () => {
  it('정상 YYYY-MM-DD 통과', () => {
    expect(validateSemesterDate('2026-03-02')).toBeNull();
  });

  it('빈 문자열 → 에러', () => {
    expect(validateSemesterDate('')).toBe('empty');
  });

  it('잘못된 포맷 (슬래시) → 에러', () => {
    expect(validateSemesterDate('2026/03/02')).toBe('format');
  });

  it('잘못된 포맷 (월일 한자리) → 에러', () => {
    expect(validateSemesterDate('2026-3-2')).toBe('format');
  });

  it('존재하지 않는 날짜 (2월 30일) → 에러', () => {
    expect(validateSemesterDate('2026-02-30')).toBe('invalid');
  });

  it('월 범위 초과 (13월) → invalid', () => {
    // 포맷은 YYYY-MM-DD 패턴 일치하나 luxon이 존재하지 않는 월로 인식
    expect(validateSemesterDate('2026-13-01')).toBe('invalid');
  });
});

describe('validateSemesterRange', () => {
  it('정상 학기 (15주) 통과', () => {
    expect(validateSemesterRange('2026-03-02', '2026-06-19')).toBeNull();
  });

  it('end <= start → 에러', () => {
    expect(validateSemesterRange('2026-06-19', '2026-03-02')).toBe('order');
    expect(validateSemesterRange('2026-03-02', '2026-03-02')).toBe('order');
  });

  it('학기 14일 미만 → 짧음 에러', () => {
    expect(validateSemesterRange('2026-03-02', '2026-03-10')).toBe('too_short');
  });

  it('학기 200일 초과 → 김 에러', () => {
    expect(validateSemesterRange('2026-03-02', '2026-12-31')).toBe('too_long');
  });

  it('어느 한쪽 포맷 에러 → 입력 포맷 에러', () => {
    expect(validateSemesterRange('2026/03/02', '2026-06-19')).toBe('start_format');
    expect(validateSemesterRange('2026-03-02', '2026/06/19')).toBe('end_format');
  });
});

describe('isSemesterValid', () => {
  it('두 입력 모두 통과 시 true', () => {
    expect(isSemesterValid('2026-03-02', '2026-06-19')).toBe(true);
  });

  it('어느 쪽이라도 에러면 false', () => {
    expect(isSemesterValid('', '2026-06-19')).toBe(false);
    expect(isSemesterValid('2026-03-02', '2026-03-02')).toBe(false);
  });
});

describe('formatSemesterError (한국어 메시지)', () => {
  it('format 에러 메시지', () => {
    expect(formatSemesterError('format')).toBe('YYYY-MM-DD 형식으로 입력해주세요.');
  });
  it('order 에러 메시지', () => {
    expect(formatSemesterError('order')).toBe('학기 종료일은 시작일보다 뒤여야 해요.');
  });
  it('too_short 에러 메시지', () => {
    expect(formatSemesterError('too_short')).toContain('짧');
  });
  it('too_long 에러 메시지', () => {
    expect(formatSemesterError('too_long')).toContain('길');
  });
  it('null → 빈 문자열', () => {
    expect(formatSemesterError(null)).toBe('');
  });
});
