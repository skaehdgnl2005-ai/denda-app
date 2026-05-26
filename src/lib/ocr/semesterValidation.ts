// S03b — 학기 시작·종료일 입력 검증.
// D13: KST 기준. luxon으로 유효성 + 범위 sanity.

import { DateTime } from 'luxon';

const KST_ZONE = 'Asia/Seoul';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MIN_SEMESTER_DAYS = 14;
const MAX_SEMESTER_DAYS = 200;

export type SemesterDateError = 'empty' | 'format' | 'invalid' | null;
export type SemesterRangeError =
  | 'order'
  | 'too_short'
  | 'too_long'
  | 'start_format'
  | 'end_format'
  | null;

export function validateSemesterDate(input: string): SemesterDateError {
  if (input.length === 0) return 'empty';
  if (!ISO_DATE_RE.test(input)) return 'format';
  const dt = DateTime.fromISO(input, { zone: KST_ZONE });
  if (!dt.isValid) return 'invalid';
  if (dt.toISODate() !== input) return 'invalid';
  return null;
}

export function validateSemesterRange(start: string, end: string): SemesterRangeError {
  if (validateSemesterDate(start) !== null) return 'start_format';
  if (validateSemesterDate(end) !== null) return 'end_format';
  const s = DateTime.fromISO(start, { zone: KST_ZONE });
  const e = DateTime.fromISO(end, { zone: KST_ZONE });
  if (e <= s) return 'order';
  const days = e.diff(s, 'days').days;
  if (days < MIN_SEMESTER_DAYS) return 'too_short';
  if (days > MAX_SEMESTER_DAYS) return 'too_long';
  return null;
}

export function isSemesterValid(start: string, end: string): boolean {
  return validateSemesterRange(start, end) === null;
}

export function formatSemesterError(err: SemesterRangeError | SemesterDateError): string {
  switch (err) {
    case 'empty':
      return '학기 시작·종료일을 입력해주세요.';
    case 'format':
    case 'start_format':
    case 'end_format':
      return 'YYYY-MM-DD 형식으로 입력해주세요.';
    case 'invalid':
      return '존재하지 않는 날짜에요.';
    case 'order':
      return '학기 종료일은 시작일보다 뒤여야 해요.';
    case 'too_short':
      return '학기가 너무 짧아요. 최소 2주는 필요해요.';
    case 'too_long':
      return '학기가 너무 길어요. 200일 이내로 입력해주세요.';
    case null:
    default:
      return '';
  }
}
