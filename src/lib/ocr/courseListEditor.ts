// S03b — OCR 결과 course list 편집 (immutable 순수 함수).
// 미리보기 화면에서 강의 추가·수정·삭제 + 시간 정규화 + 검증.

import type { Day, OcrCourse } from './everytime';

const VALID_DAYS: ReadonlySet<Day> = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type CourseValidationError = 'name' | 'day' | 'time_format' | 'time_order' | null;

export function addCourse(list: OcrCourse[]): OcrCourse[] {
  const empty: OcrCourse = { name: '', day: 'MON', start: '09:00', end: '10:30' };
  return [...list, empty];
}

export function updateCourse(
  list: OcrCourse[],
  index: number,
  patch: Partial<OcrCourse>,
): OcrCourse[] {
  if (index < 0 || index >= list.length) return list;
  const current = list[index];
  if (!current) return list;
  const merged: OcrCourse = { ...current, ...patch };
  return [...list.slice(0, index), merged, ...list.slice(index + 1)];
}

export function removeCourse(list: OcrCourse[], index: number): OcrCourse[] {
  if (index < 0 || index >= list.length) return list;
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

// "10" → "10:00", "1030" → "10:30", "9" → "09:00", "10:5" → "10:05"
export function normalizeTimeInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return '';
  // 이미 HH:MM 형식
  if (TIME_RE.test(trimmed)) return trimmed;
  // 콜론 포함 — 분 자리 보정 ("10:5" → "10:05")
  if (trimmed.includes(':')) {
    const [hPart, mPart] = trimmed.split(':');
    if (hPart === undefined || mPart === undefined) return trimmed;
    if (!/^\d{1,2}$/.test(hPart) || !/^\d{1,2}$/.test(mPart)) return trimmed;
    const hh = hPart.padStart(2, '0');
    const mm = mPart.padStart(2, '0');
    const candidate = `${hh}:${mm}`;
    return TIME_RE.test(candidate) ? candidate : trimmed;
  }
  // 숫자만 — 길이별 해석
  if (!/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed.length === 1 || trimmed.length === 2) {
    const candidate = `${trimmed.padStart(2, '0')}:00`;
    return TIME_RE.test(candidate) ? candidate : trimmed;
  }
  if (trimmed.length === 3 || trimmed.length === 4) {
    const padded = trimmed.padStart(4, '0');
    const candidate = `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
    return TIME_RE.test(candidate) ? candidate : trimmed;
  }
  return trimmed;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function validateCourse(course: OcrCourse): CourseValidationError {
  if (course.name.trim().length === 0) return 'name';
  if (!VALID_DAYS.has(course.day)) return 'day';
  if (!TIME_RE.test(course.start) || !TIME_RE.test(course.end)) return 'time_format';
  if (timeToMinutes(course.end) <= timeToMinutes(course.start)) return 'time_order';
  return null;
}

export function hasAnyValidationError(list: OcrCourse[]): boolean {
  return list.some((c) => validateCourse(c) !== null);
}
