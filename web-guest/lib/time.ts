// time — D13 KST 강제 (Asia/Seoul). `new Date(dateStr)` 직접 사용 금지.
//
// 모든 날짜 입력은 YYYY-MM-DD ISO 8601 문자열. luxon으로 Asia/Seoul 기준 해석 후 출력.
// 컴퓨터 timezone에 무관하게 동일 결과 보장 (서버 SSR / 클라 jsdom / 사용자 device).
//
// rules/ko-kr.md 참조 — RN 영역과 동일 원칙.

import { DateTime } from 'luxon';

export const KST_ZONE = 'Asia/Seoul' as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const KO_WEEKDAY: readonly string[] = ['월', '화', '수', '목', '금', '토', '일'];

export function isValidDateString(input: string): boolean {
  if (typeof input !== 'string' || !DATE_RE.test(input)) return false;
  const dt = DateTime.fromISO(input, { zone: KST_ZONE });
  return dt.isValid;
}

function parseKstDate(input: string): DateTime {
  if (!isValidDateString(input)) {
    throw new Error(`날짜 형식이 올바르지 않아요 (YYYY-MM-DD): "${input}"`);
  }
  return DateTime.fromISO(input, { zone: KST_ZONE });
}

// dayOfWeekKst — KST 기준 한국어 요일 한 글자 (월/화/수/목/금/토/일).
// luxon weekday: 1=월요일 ~ 7=일요일.
export function dayOfWeekKst(dateStr: string): string {
  const dt = parseKstDate(dateStr);
  const label = KO_WEEKDAY[dt.weekday - 1];
  if (label === undefined) {
    throw new Error(`날짜 형식이 올바르지 않아요: "${dateStr}"`);
  }
  return label;
}

// formatHeaderDate — 시간 그리드 헤더용 "M/D" (앞 0 제거).
export function formatHeaderDate(dateStr: string): string {
  const dt = parseKstDate(dateStr);
  return `${dt.month}/${dt.day}`;
}
