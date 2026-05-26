// S03 — OCR course → schedules row 변환.
// D13: KST 입력, DB 저장은 UTC TIMESTAMPTZ.
// D15: source = 'everytime' (다른 source enum과 격리. 외부 캘린더 push 안 함 — D2)

import { DateTime } from 'npm:luxon@3.4.4';
import type { OcrCourse } from './parser.ts';
import { generateRRule, type Day } from './rrule.ts';

const KST_ZONE = 'Asia/Seoul';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// luxon weekday: MON=1 ... SUN=7
const DAY_TO_WEEKDAY: Record<Day, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 7,
};

export interface BuildScheduleContext {
  course: OcrCourse;
  semesterStart: string; // 'YYYY-MM-DD' (KST)
  semesterEnd: string;   // 'YYYY-MM-DD' (KST)
  userId: string;
}

export interface ScheduleRow {
  user_id: string;
  source: 'everytime';
  title: string;
  start_at: string;        // ISO UTC
  end_at: string;          // ISO UTC
  recurrence_rule: string; // RFC 5545
  expires_at: string;      // ISO UTC (semesterEnd 23:59:59 KST → UTC)
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

export function buildScheduleRow(ctx: BuildScheduleContext): ScheduleRow {
  const { course, semesterStart, semesterEnd, userId } = ctx;

  if (!ISO_DATE_RE.test(semesterStart)) {
    throw new Error(`invalid semesterStart: ${semesterStart} (expected YYYY-MM-DD)`);
  }
  if (!ISO_DATE_RE.test(semesterEnd)) {
    throw new Error(`invalid semesterEnd: ${semesterEnd} (expected YYYY-MM-DD)`);
  }

  const startDate = DateTime.fromISO(semesterStart, { zone: KST_ZONE });
  const endDate = DateTime.fromISO(semesterEnd, { zone: KST_ZONE });
  if (!startDate.isValid || !endDate.isValid) {
    throw new Error(`invalid semester dates: ${semesterStart} ~ ${semesterEnd}`);
  }
  if (endDate <= startDate) {
    throw new Error(`semesterEnd must be after semesterStart (${semesterStart} ~ ${semesterEnd})`);
  }

  const targetWeekday = DAY_TO_WEEKDAY[course.day];
  // 첫 occurrence: 학기 시작일과 같은 요일이면 학기 시작일, 아니면 가장 가까운 다음 해당 요일
  const delta = (targetWeekday - startDate.weekday + 7) % 7;
  const firstOccurrenceDate = startDate.plus({ days: delta });

  const { hour: sH, minute: sM } = parseTime(course.start);
  const { hour: eH, minute: eM } = parseTime(course.end);

  const startKst = firstOccurrenceDate.set({ hour: sH, minute: sM, second: 0, millisecond: 0 });
  const endKst = firstOccurrenceDate.set({ hour: eH, minute: eM, second: 0, millisecond: 0 });

  // 학기 종료일 23:59:59 KST 보다 첫 occurrence가 늦으면 의미 없음
  const endOfSemesterKst = endDate.set({ hour: 23, minute: 59, second: 59, millisecond: 0 });
  if (startKst > endOfSemesterKst) {
    throw new Error(`first occurrence (${startKst.toISO()}) is after semesterEnd — no recurrence possible`);
  }

  const start_at = startKst.toUTC().toISO({ suppressMilliseconds: false });
  const end_at = endKst.toUTC().toISO({ suppressMilliseconds: false });
  const expires_at = endOfSemesterKst.toUTC().toISO({ suppressMilliseconds: false });
  if (!start_at || !end_at || !expires_at) {
    throw new Error('failed to compute UTC ISO timestamps');
  }

  return {
    user_id: userId,
    source: 'everytime',
    title: course.name,
    start_at,
    end_at,
    recurrence_rule: generateRRule(course.day, semesterEnd),
    expires_at,
  };
}
