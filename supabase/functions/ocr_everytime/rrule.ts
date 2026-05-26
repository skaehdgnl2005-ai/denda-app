// S03 — RRULE (RFC 5545) 생성. 매주 반복 일정의 종료 시점은 학기 종료.
// D13: UNTIL은 UTC.
//
// 출력 예: FREQ=WEEKLY;BYDAY=MO;UNTIL=20260822T145959Z

import { DateTime } from 'npm:luxon@3.4.4';

export type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const DAY_TO_RFC5545: Record<Day, string> = {
  MON: 'MO',
  TUE: 'TU',
  WED: 'WE',
  THU: 'TH',
  FRI: 'FR',
  SAT: 'SA',
  SUN: 'SU',
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function generateRRule(day: Day, semesterEnd: string): string {
  const byday = DAY_TO_RFC5545[day];
  if (!byday) {
    throw new Error(`invalid day: ${day}`);
  }
  if (!ISO_DATE_RE.test(semesterEnd)) {
    throw new Error(`invalid semesterEnd: ${semesterEnd} (expected YYYY-MM-DD)`);
  }
  // semesterEnd 23:59:59 KST → UTC. KST는 UTC+9 (DST 없음, D13).
  const endOfDayUtc = DateTime.fromISO(`${semesterEnd}T23:59:59`, { zone: 'Asia/Seoul' }).toUTC();
  if (!endOfDayUtc.isValid) {
    throw new Error(`invalid semesterEnd: ${semesterEnd}`);
  }
  // RFC 5545 UNTIL: YYYYMMDDTHHMMSSZ
  const until = endOfDayUtc.toFormat("yyyyLLdd'T'HHmmss'Z'");
  return `FREQ=WEEKLY;BYDAY=${byday};UNTIL=${until}`;
}
