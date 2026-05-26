// S03b — OCR 결과 course list 편집 순수 함수 (TDD-first)
// 미리보기 화면에서 사용자가 강의를 수정·삭제·추가하는 흐름의 백엔드.

import {
  addCourse,
  updateCourse,
  removeCourse,
  validateCourse,
  normalizeTimeInput,
  hasAnyValidationError,
} from './courseListEditor';
import type { OcrCourse } from './everytime';

const sample: OcrCourse = {
  name: '선형대수',
  day: 'MON',
  start: '10:00',
  end: '11:30',
  room: '공학관 401',
};

describe('addCourse', () => {
  it('빈 강의를 끝에 추가', () => {
    const list: OcrCourse[] = [sample];
    const next = addCourse(list);
    expect(next.length).toBe(2);
    expect(next[1]!.name).toBe('');
    expect(next[1]!.day).toBe('MON');
    expect(next[0]).toBe(sample); // 원본 보존
  });

  it('immutable — 원본 배열 보존', () => {
    const list: OcrCourse[] = [sample];
    addCourse(list);
    expect(list.length).toBe(1);
  });
});

describe('updateCourse', () => {
  it('지정 index만 수정, 나머지 그대로', () => {
    const list: OcrCourse[] = [sample, { name: '수학', day: 'TUE', start: '09:00', end: '10:30' }];
    const next = updateCourse(list, 1, { name: '미적분학', start: '09:30' });
    expect(next[1]!.name).toBe('미적분학');
    expect(next[1]!.start).toBe('09:30');
    expect(next[1]!.day).toBe('TUE'); // unchanged
    expect(next[0]).toBe(sample);
  });

  it('범위 밖 index → 원본 그대로 반환', () => {
    const list: OcrCourse[] = [sample];
    expect(updateCourse(list, 5, { name: 'X' })).toEqual(list);
    expect(updateCourse(list, -1, { name: 'X' })).toEqual(list);
  });
});

describe('removeCourse', () => {
  it('지정 index 제거', () => {
    const list: OcrCourse[] = [
      sample,
      { name: '수학', day: 'TUE', start: '09:00', end: '10:30' },
      { name: '영어', day: 'FRI', start: '14:00', end: '15:30' },
    ];
    const next = removeCourse(list, 1);
    expect(next.length).toBe(2);
    expect(next[0]!.name).toBe('선형대수');
    expect(next[1]!.name).toBe('영어');
  });

  it('범위 밖 → 원본 그대로', () => {
    expect(removeCourse([sample], 5)).toEqual([sample]);
  });
});

describe('normalizeTimeInput', () => {
  it('"10" → "10:00"', () => {
    expect(normalizeTimeInput('10')).toBe('10:00');
  });

  it('"1030" → "10:30"', () => {
    expect(normalizeTimeInput('1030')).toBe('10:30');
  });

  it('"10:30" 그대로', () => {
    expect(normalizeTimeInput('10:30')).toBe('10:30');
  });

  it('한자리 시 "9" → "09:00"', () => {
    expect(normalizeTimeInput('9')).toBe('09:00');
  });

  it('빈 입력 그대로', () => {
    expect(normalizeTimeInput('')).toBe('');
  });

  it('알 수 없는 입력 그대로 (검증은 validateCourse가)', () => {
    expect(normalizeTimeInput('10시반')).toBe('10시반');
  });

  it('"10:5" → "10:05" (분 자리 보정)', () => {
    expect(normalizeTimeInput('10:5')).toBe('10:05');
  });
});

describe('validateCourse', () => {
  it('정상 강의 → null', () => {
    expect(validateCourse(sample)).toBeNull();
  });

  it('이름 빈 문자열 → error', () => {
    expect(validateCourse({ ...sample, name: '' })).toBe('name');
    expect(validateCourse({ ...sample, name: '   ' })).toBe('name');
  });

  it('시간 형식 오류 → error', () => {
    expect(validateCourse({ ...sample, start: '10시' })).toBe('time_format');
    expect(validateCourse({ ...sample, end: 'noon' })).toBe('time_format');
  });

  it('end <= start → error', () => {
    expect(validateCourse({ ...sample, start: '11:00', end: '10:00' })).toBe('time_order');
    expect(validateCourse({ ...sample, start: '10:00', end: '10:00' })).toBe('time_order');
  });

  it('day 잘못된 값 → error', () => {
    expect(validateCourse({ ...sample, day: 'MONDAY' as 'MON' })).toBe('day');
  });

  it('room undefined OK', () => {
    expect(validateCourse({ name: '경제', day: 'FRI', start: '09:00', end: '10:30' })).toBeNull();
  });
});

describe('hasAnyValidationError', () => {
  it('모두 정상 → false', () => {
    expect(
      hasAnyValidationError([sample, { name: '수학', day: 'TUE', start: '09:00', end: '10:30' }]),
    ).toBe(false);
  });

  it('한 개라도 invalid → true', () => {
    expect(hasAnyValidationError([sample, { ...sample, name: '' }])).toBe(true);
  });

  it('빈 배열 → false (저장 차단은 호출자 책임)', () => {
    expect(hasAnyValidationError([])).toBe(false);
  });
});
