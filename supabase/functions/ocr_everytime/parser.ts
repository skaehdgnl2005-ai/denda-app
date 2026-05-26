// S03 — Gemini Vision 응답 파싱 + 검증.
// 모델은 보통 ```json 펜스로 감싸 응답하므로 둘 다 처리.
// 검증 실패는 throw — 호출자가 Edge Function 4xx로 변환.

import type { Day } from './rrule.ts';

export interface OcrCourse {
  name: string;
  day: Day;
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
  room?: string;
}

export interface OcrResult {
  courses: OcrCourse[];
}

const VALID_DAYS: ReadonlySet<Day> = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch && fenceMatch[1] !== undefined) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function parseGeminiResponse(raw: string): OcrResult {
  const unwrapped = stripMarkdownFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapped);
  } catch (e) {
    throw new Error(`invalid JSON: ${(e as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('expected object with courses array');
  }
  const root = parsed as { courses?: unknown };
  if (!Array.isArray(root.courses)) {
    throw new Error('courses must be array');
  }

  const courses: OcrCourse[] = root.courses.map((c, i) => {
    if (!c || typeof c !== 'object') {
      throw new Error(`courses[${i}]: not an object`);
    }
    const row = c as Record<string, unknown>;
    const name = row.name;
    const day = row.day;
    const start = row.start;
    const end = row.end;
    const room = row.room;

    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`courses[${i}].name: missing or empty`);
    }
    if (typeof day !== 'string' || !VALID_DAYS.has(day as Day)) {
      throw new Error(`courses[${i}].day: invalid (got ${JSON.stringify(day)})`);
    }
    if (typeof start !== 'string' || !TIME_RE.test(start)) {
      throw new Error(`courses[${i}].start: invalid HH:MM (got ${JSON.stringify(start)})`);
    }
    if (typeof end !== 'string' || !TIME_RE.test(end)) {
      throw new Error(`courses[${i}].end: invalid HH:MM (got ${JSON.stringify(end)})`);
    }
    if (toMinutes(end) <= toMinutes(start)) {
      throw new Error(`courses[${i}].end must be > start (${start} → ${end})`);
    }
    if (room !== undefined && typeof room !== 'string') {
      throw new Error(`courses[${i}].room: must be string if present`);
    }

    const out: OcrCourse = { name, day: day as Day, start, end };
    if (typeof room === 'string' && room.length > 0) {
      out.room = room;
    }
    return out;
  });

  return { courses };
}
