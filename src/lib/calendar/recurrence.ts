// S25 — schedules 행을 "언제 일어나는가"(KST 날짜 + 분 구간)로 전개하는 순수 로직.
//
// 에브리타임 OCR이 만드는 규칙은 주간 반복뿐이므로(supabase/functions/ocr_everytime/rrule.ts)
// 좁은 RFC 5545 파서로 충분하다. 미지원 FREQ는 전량 드롭하지 않고 첫 occurrence만 남긴다
// (일정이 소리 없이 사라지는 편보다 한 건이라도 보이는 편이 안전 — D19 무음 실패 금지 정신).
//
// D13: 모든 날짜 산술은 luxon Asia/Seoul. bare Date 금지.
import { DateTime } from 'luxon';

import { isScheduleActive } from '@/lib/schedules/activeFilter';
import type { ScheduleRow } from '@/lib/schedules/queries';

const ZONE = 'Asia/Seoul';
const RFC5545_UTC = "yyyyLLdd'T'HHmmss'Z'";

/** BYDAY 코드 → luxon weekday (월=1 … 일=7) */
const BYDAY_TO_WEEKDAY: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

export interface ScheduleOccurrence {
  scheduleId: string;
  /** KST yyyy-MM-dd */
  dateIso: string;
  /** KST 자정 기준 분 (0~1439) */
  startMinute: number;
  /** KST 자정 기준 분. 자정을 넘기면 1440으로 clamp */
  endMinute: number;
}

export interface WeeklyRule {
  /** luxon weekday 오름차순 */
  weekdays: number[];
  /** UTC ISO. 없으면 null */
  untilUtcIso: string | null;
}

/**
 * `FREQ=WEEKLY;BYDAY=MO;UNTIL=20260822T145959Z` → WeeklyRule.
 * WEEKLY가 아니거나 BYDAY가 없으면 null (호출부가 단발로 degrade).
 */
export function parseWeeklyRule(rule: string): WeeklyRule | null {
  const parts = new Map<string, string>();
  for (const segment of rule.split(';')) {
    const eq = segment.indexOf('=');
    if (eq > 0) {
      parts.set(segment.slice(0, eq).trim().toUpperCase(), segment.slice(eq + 1).trim());
    }
  }
  if ((parts.get('FREQ') ?? '').toUpperCase() !== 'WEEKLY') return null;

  const byday = (parts.get('BYDAY') ?? '').toUpperCase();
  const weekdays: number[] = [];
  for (const code of byday.split(',')) {
    const weekday = BYDAY_TO_WEEKDAY[code.trim()];
    if (weekday !== undefined && !weekdays.includes(weekday)) weekdays.push(weekday);
  }
  if (weekdays.length === 0) return null;
  weekdays.sort((a, b) => a - b);

  const until = parts.get('UNTIL');
  let untilUtcIso: string | null = null;
  if (until !== undefined) {
    const parsed = DateTime.fromFormat(until, RFC5545_UTC, { zone: 'utc' });
    untilUtcIso = parsed.isValid ? parsed.toISO() : null;
  }
  return { weekdays, untilUtcIso };
}

/**
 * 한 행을 [fromIso, toIso] (KST, 양끝 포함) 창 안의 occurrence로 전개.
 * 반환 순서는 날짜 오름차순.
 */
export function expandSchedule(
  row: ScheduleRow,
  fromIso: string,
  toIso: string,
): ScheduleOccurrence[] {
  const startKst = DateTime.fromISO(row.start_at, { zone: 'utc' }).setZone(ZONE);
  const endKst = DateTime.fromISO(row.end_at, { zone: 'utc' }).setZone(ZONE);
  const from = DateTime.fromISO(fromIso, { zone: ZONE }).startOf('day');
  const to = DateTime.fromISO(toIso, { zone: ZONE }).startOf('day');
  if (!startKst.isValid || !endKst.isValid || !from.isValid || !to.isValid) return [];
  if (to < from) return [];

  const startMinute = startKst.hour * 60 + startKst.minute;
  const durationMinutes = Math.max(1, Math.round(endKst.diff(startKst, 'minutes').minutes));
  const endMinute = Math.min(1440, startMinute + durationMinutes);

  const firstDate = startKst.startOf('day');
  const rule = row.recurrence_rule === null ? null : parseWeeklyRule(row.recurrence_rule);

  /** 해당 날짜의 occurrence가 UNTIL·expires_at 안에 있으면 반환, 아니면 null */
  const occurrenceAt = (date: DateTime): ScheduleOccurrence | null => {
    const startUtcIso = date
      .set({ hour: startKst.hour, minute: startKst.minute, second: 0, millisecond: 0 })
      .toUTC()
      .toISO();
    const dateIso = date.toISODate();
    if (startUtcIso === null || dateIso === null) return null;
    if (rule?.untilUtcIso !== null && rule?.untilUtcIso !== undefined) {
      if (startUtcIso > rule.untilUtcIso) return null;
    }
    if (!isScheduleActive(row, startUtcIso)) return null;
    return { scheduleId: row.id, dateIso, startMinute, endMinute };
  };

  // 단발 (반복 규칙 없음 · 미지원 FREQ) — 첫 occurrence만
  if (rule === null) {
    if (firstDate < from || firstDate > to) return [];
    const single = occurrenceAt(firstDate);
    return single === null ? [] : [single];
  }

  // 주간 반복 — 첫 occurrence 이전으로는 거슬러 올라가지 않는다
  const windowStart = from > firstDate ? from : firstDate;
  const out: ScheduleOccurrence[] = [];
  for (const weekday of rule.weekdays) {
    const lead = (weekday - windowStart.weekday + 7) % 7;
    let cursor = windowStart.plus({ days: lead });
    while (cursor <= to) {
      const occurrence = occurrenceAt(cursor);
      // UNTIL·만료 컷오프는 단조 — 이후 주차도 모두 제외된다
      if (occurrence === null) break;
      out.push(occurrence);
      cursor = cursor.plus({ weeks: 1 });
    }
  }
  return sortOccurrences(out);
}

/** 여러 행을 한 창으로 전개 — 날짜 → 시작 시각 순 정렬. */
export function expandSchedules(
  rows: ScheduleRow[],
  fromIso: string,
  toIso: string,
): ScheduleOccurrence[] {
  const out: ScheduleOccurrence[] = [];
  for (const row of rows) {
    out.push(...expandSchedule(row, fromIso, toIso));
  }
  return sortOccurrences(out);
}

function sortOccurrences(items: ScheduleOccurrence[]): ScheduleOccurrence[] {
  return [...items].sort((a, b) => {
    if (a.dateIso !== b.dateIso) return a.dateIso < b.dateIso ? -1 : 1;
    return a.startMinute - b.startMinute;
  });
}
