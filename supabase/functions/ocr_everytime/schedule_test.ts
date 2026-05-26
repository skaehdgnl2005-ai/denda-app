// S03 — buildScheduleRow 단위 테스트 (TDD-first)
// 학기 첫 occurrence 시각 + KST→UTC 변환 + recurrence_rule + expires_at.
// D13 KST 강제. D15 source='everytime'.

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildScheduleRow } from './schedule.ts';

const USER_ID = '00000000-0000-0000-0000-000000000001';

Deno.test('buildScheduleRow: semesterStart가 MON이면 MON 수업 첫 시작 = semesterStart 10:00 KST → 01:00 UTC', () => {
  // 2026-03-02 = Monday
  const row = buildScheduleRow({
    course: { name: '선형대수', day: 'MON', start: '10:00', end: '11:30' },
    semesterStart: '2026-03-02',
    semesterEnd: '2026-06-19',
    userId: USER_ID,
  });
  assertEquals(row.start_at, '2026-03-02T01:00:00.000Z');
  assertEquals(row.end_at, '2026-03-02T02:30:00.000Z');
});

Deno.test('buildScheduleRow: semesterStart가 TUE면 MON 수업 첫 시작 = 다음 주 MON', () => {
  // 2026-03-03 = Tuesday. 다음 MON = 2026-03-09
  const row = buildScheduleRow({
    course: { name: '경제학', day: 'MON', start: '13:00', end: '14:30' },
    semesterStart: '2026-03-03',
    semesterEnd: '2026-06-19',
    userId: USER_ID,
  });
  assertEquals(row.start_at, '2026-03-09T04:00:00.000Z'); // 13:00 KST = 04:00 UTC
  assertEquals(row.end_at, '2026-03-09T05:30:00.000Z');
});

Deno.test('buildScheduleRow: source = everytime', () => {
  const row = buildScheduleRow({
    course: { name: '수학', day: 'WED', start: '09:00', end: '10:30' },
    semesterStart: '2026-03-02',
    semesterEnd: '2026-06-19',
    userId: USER_ID,
  });
  assertEquals(row.source, 'everytime');
});

Deno.test('buildScheduleRow: title = course.name', () => {
  const row = buildScheduleRow({
    course: { name: '데이터구조', day: 'THU', start: '14:00', end: '15:30', room: '공학관 401' },
    semesterStart: '2026-03-02',
    semesterEnd: '2026-06-19',
    userId: USER_ID,
  });
  assertEquals(row.title, '데이터구조');
});

Deno.test('buildScheduleRow: user_id 전달', () => {
  const row = buildScheduleRow({
    course: { name: '수학', day: 'WED', start: '09:00', end: '10:30' },
    semesterStart: '2026-03-02',
    semesterEnd: '2026-06-19',
    userId: USER_ID,
  });
  assertEquals(row.user_id, USER_ID);
});

Deno.test('buildScheduleRow: recurrence_rule = WEEKLY+BYDAY+UNTIL', () => {
  const row = buildScheduleRow({
    course: { name: '영어', day: 'FRI', start: '11:00', end: '12:30' },
    semesterStart: '2026-03-02',
    semesterEnd: '2026-06-19',
    userId: USER_ID,
  });
  assertEquals(row.recurrence_rule.includes('FREQ=WEEKLY'), true, row.recurrence_rule);
  assertEquals(row.recurrence_rule.includes('BYDAY=FR'), true, row.recurrence_rule);
  assertEquals(row.recurrence_rule.includes('UNTIL=20260619T145959Z'), true, row.recurrence_rule);
});

Deno.test('buildScheduleRow: expires_at = semesterEnd 23:59:59 KST → 14:59:59 UTC', () => {
  const row = buildScheduleRow({
    course: { name: '수학', day: 'WED', start: '09:00', end: '10:30' },
    semesterStart: '2026-03-02',
    semesterEnd: '2026-06-19',
    userId: USER_ID,
  });
  assertEquals(row.expires_at, '2026-06-19T14:59:59.000Z');
});

Deno.test('buildScheduleRow: semesterEnd <= semesterStart throws', () => {
  assertThrows(
    () => buildScheduleRow({
      course: { name: '수학', day: 'MON', start: '10:00', end: '11:30' },
      semesterStart: '2026-06-19',
      semesterEnd: '2026-03-02',
      userId: USER_ID,
    }),
    Error,
    'semester',
  );
});

Deno.test('buildScheduleRow: semesterStart 잘못된 포맷 throws', () => {
  assertThrows(
    () => buildScheduleRow({
      course: { name: '수학', day: 'MON', start: '10:00', end: '11:30' },
      semesterStart: '2026/03/02',
      semesterEnd: '2026-06-19',
      userId: USER_ID,
    }),
    Error,
    'semesterStart',
  );
});

Deno.test('buildScheduleRow: 첫 occurrence가 학기 종료 이후면 throws (전체 학기 빈 일정 방지)', () => {
  // semesterStart=Friday 2026-03-06, course day=MON, 다음 MON=2026-03-09 < 2026-03-08(가짜 짧은 학기)
  // 학기 종료를 학기 시작 다음날로 두면 첫 MON은 학기 종료 이후
  assertThrows(
    () => buildScheduleRow({
      course: { name: '수학', day: 'MON', start: '10:00', end: '11:30' },
      semesterStart: '2026-03-06', // Friday
      semesterEnd: '2026-03-07',   // Saturday — MON 안 옴
      userId: USER_ID,
    }),
    Error,
    'occurrence',
  );
});

Deno.test('buildScheduleRow: SUN 수업 mapping (Asia/Seoul weekday 7)', () => {
  // 2026-03-02 = MON. 첫 SUN = 2026-03-08
  const row = buildScheduleRow({
    course: { name: '동아리', day: 'SUN', start: '15:00', end: '17:00' },
    semesterStart: '2026-03-02',
    semesterEnd: '2026-06-19',
    userId: USER_ID,
  });
  assertEquals(row.start_at, '2026-03-08T06:00:00.000Z'); // 15:00 KST = 06:00 UTC
});
