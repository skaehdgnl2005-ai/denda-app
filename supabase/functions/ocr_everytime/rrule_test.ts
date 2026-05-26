// S03 — generateRRule 단위 테스트 (TDD-first)
// 매주 반복 일정의 RRULE (RFC 5545) 생성.
// UNTIL = semesterEnd 마지막 시점 (KST 23:59:59 → UTC). D13.

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateRRule } from './rrule.ts';

Deno.test('generateRRule: MON → BYDAY=MO + FREQ=WEEKLY', () => {
  const rule = generateRRule('MON', '2026-08-22');
  assertEquals(rule.startsWith('FREQ=WEEKLY;'), true, rule);
  assertEquals(rule.includes('BYDAY=MO'), true, rule);
});

Deno.test('generateRRule: 모든 요일 BYDAY 매핑', () => {
  const cases: Array<[string, string]> = [
    ['MON', 'MO'],
    ['TUE', 'TU'],
    ['WED', 'WE'],
    ['THU', 'TH'],
    ['FRI', 'FR'],
    ['SAT', 'SA'],
    ['SUN', 'SU'],
  ];
  for (const [input, expected] of cases) {
    const rule = generateRRule(input as 'MON', '2026-08-22');
    assertEquals(rule.includes(`BYDAY=${expected}`), true, `${input} → ${expected} not in ${rule}`);
  }
});

Deno.test('generateRRule: UNTIL = semesterEnd 23:59:59 KST → UTC (YYYYMMDDTHHMMSSZ)', () => {
  // 2026-08-22 23:59:59 Asia/Seoul = 2026-08-22 14:59:59 UTC
  const rule = generateRRule('MON', '2026-08-22');
  assertEquals(rule.includes('UNTIL=20260822T145959Z'), true, rule);
});

Deno.test('generateRRule: 자정 경계 (semesterEnd 23:59:59 KST → 같은 날짜 UTC 14:59:59)', () => {
  // KST는 UTC+9 (DST 없음). KST 23:59:59 = UTC 14:59:59 (같은 날짜 유지)
  const rule = generateRRule('FRI', '2026-12-19');
  assertEquals(rule.includes('UNTIL=20261219T145959Z'), true, rule);
});

Deno.test('generateRRule: invalid day throws', () => {
  assertThrows(() => generateRRule('MONDAY' as 'MON', '2026-08-22'), Error, 'day');
});

Deno.test('generateRRule: invalid semesterEnd format throws', () => {
  assertThrows(() => generateRRule('MON', '2026/08/22'), Error, 'semesterEnd');
});
