// S15-mapmode-logic — 시간 범위 필터 (acceptance: "시간 범위 선택").
//
// D13 KST 강제: KST date(yyyy-MM-dd) → Asia/Seoul 그날 00:00 ~ 23:59:59.999 → UTC ISO 변환.
// 경계 inclusive (사용자가 "5월 30일 ~ 5월 31일" 선택 시 5월 31일 마지막 1ms까지 포함).
// confirmedStartAt 비교는 UTC ISO lexicographic — luxon으로 변환 후 string 비교.

import { DateTime } from 'luxon';

import type { ScheduleMapPoint } from './scheduleMapPoint';

const KST_ZONE = 'Asia/Seoul';
const KST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface UtcWindow {
  fromUtcIso: string;
  toUtcIso: string;
}

/**
 * KST 날짜 범위(yyyy-MM-dd, inclusive) → UTC ISO 윈도우.
 * fromKstDate 00:00:00.000 KST → fromUtcIso.
 * toKstDate 23:59:59.999 KST → toUtcIso.
 */
export function kstDateRangeToUtcWindow(fromKstDate: string, toKstDate: string): UtcWindow {
  if (!KST_DATE_RE.test(fromKstDate) || !KST_DATE_RE.test(toKstDate)) {
    throw new Error('날짜 형식이 올바르지 않아요 (yyyy-MM-dd).');
  }

  const fromKst = DateTime.fromISO(fromKstDate, { zone: KST_ZONE }).startOf('day');
  const toKst = DateTime.fromISO(toKstDate, { zone: KST_ZONE }).endOf('day');

  if (!fromKst.isValid || !toKst.isValid) {
    throw new Error('날짜 형식이 올바르지 않아요 (yyyy-MM-dd).');
  }
  if (fromKst > toKst) {
    throw new Error('시간 범위가 올바르지 않아요 (시작이 끝보다 늦어요).');
  }

  const fromUtcIso = fromKst.toUTC().toISO({ suppressMilliseconds: false });
  const toUtcIso = toKst.toUTC().toISO({ suppressMilliseconds: false });

  if (fromUtcIso === null || toUtcIso === null) {
    throw new Error('날짜 형식이 올바르지 않아요 (yyyy-MM-dd).');
  }
  return { fromUtcIso, toUtcIso };
}

/** KST 날짜 범위에 confirmedStartAt이 포함된 점만 반환 (경계 inclusive). */
export function filterByKstDateRange(
  points: ScheduleMapPoint[],
  fromKstDate: string,
  toKstDate: string,
): ScheduleMapPoint[] {
  if (points.length === 0) return [];
  const { fromUtcIso, toUtcIso } = kstDateRangeToUtcWindow(fromKstDate, toKstDate);
  return points.filter((p) => p.confirmedStartAt >= fromUtcIso && p.confirmedStartAt <= toUtcIso);
}
