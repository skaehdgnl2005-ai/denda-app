// S03 — parseGeminiResponse 단위 테스트 (TDD-first)
// Gemini Vision 응답을 OcrResult로 정규화. 형식 검증 책임.

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseGeminiResponse } from './parser.ts';

Deno.test('parseGeminiResponse: plain JSON object', () => {
  const raw = JSON.stringify({
    courses: [{ name: '선형대수', day: 'MON', start: '10:00', end: '11:30' }],
  });
  const result = parseGeminiResponse(raw);
  assertEquals(result.courses.length, 1);
  assertEquals(result.courses[0].name, '선형대수');
  assertEquals(result.courses[0].day, 'MON');
});

Deno.test('parseGeminiResponse: markdown fenced ```json', () => {
  const raw = '```json\n' + JSON.stringify({
    courses: [{ name: '프로그래밍', day: 'WED', start: '13:00', end: '14:30', room: '정보관 205' }],
  }) + '\n```';
  const result = parseGeminiResponse(raw);
  assertEquals(result.courses[0].room, '정보관 205');
});

Deno.test('parseGeminiResponse: markdown fenced ``` (no language)', () => {
  const raw = '```\n' + JSON.stringify({
    courses: [{ name: '경제학원론', day: 'FRI', start: '09:00', end: '10:30' }],
  }) + '\n```';
  const result = parseGeminiResponse(raw);
  assertEquals(result.courses[0].day, 'FRI');
});

Deno.test('parseGeminiResponse: invalid JSON throws', () => {
  assertThrows(() => parseGeminiResponse('not json'), Error, 'JSON');
});

Deno.test('parseGeminiResponse: courses must be array', () => {
  const raw = JSON.stringify({ courses: 'not array' });
  assertThrows(() => parseGeminiResponse(raw), Error, 'courses');
});

Deno.test('parseGeminiResponse: missing day throws', () => {
  const raw = JSON.stringify({
    courses: [{ name: '수학', start: '10:00', end: '11:00' }],
  });
  assertThrows(() => parseGeminiResponse(raw), Error, 'day');
});

Deno.test('parseGeminiResponse: invalid day enum throws', () => {
  const raw = JSON.stringify({
    courses: [{ name: '수학', day: 'MONDAY', start: '10:00', end: '11:00' }],
  });
  assertThrows(() => parseGeminiResponse(raw), Error, 'day');
});

Deno.test('parseGeminiResponse: invalid time format throws', () => {
  const raw = JSON.stringify({
    courses: [{ name: '수학', day: 'MON', start: '10시', end: '11:00' }],
  });
  assertThrows(() => parseGeminiResponse(raw), Error, 'start');
});

Deno.test('parseGeminiResponse: end <= start throws', () => {
  const raw = JSON.stringify({
    courses: [{ name: '수학', day: 'MON', start: '11:00', end: '10:00' }],
  });
  assertThrows(() => parseGeminiResponse(raw), Error, 'end');
});

Deno.test('parseGeminiResponse: empty courses array allowed', () => {
  const raw = JSON.stringify({ courses: [] });
  const result = parseGeminiResponse(raw);
  assertEquals(result.courses.length, 0);
});
