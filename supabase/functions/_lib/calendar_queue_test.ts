// calendar_queue_test.ts — S06 calendar push background queue 순수 함수 unit tests
// 실행: deno test --allow-env supabase/functions/_lib/calendar_queue_test.ts
//
// 검증 대상:
//   - isCalendarPushPending(group): queue selection 조건 (D20)
//   - nextRetryState(currentCount): retry policy (max 3, idempotent at max)
//   - buildCalendarEventPayload(group): UTC ISO + 모임명 → 외부 캘린더 event spec (D13 KST 표기 + D19 단방향)

import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildCalendarEventPayload,
  CALENDAR_PUSH_MAX_RETRY,
  isCalendarPushPending,
  nextRetryState,
  type CalendarQueueGroup,
} from './calendar_queue.ts';

// ---------------------------------------------------------------------------
// isCalendarPushPending — queue selection (D20)
// ---------------------------------------------------------------------------

const baseGroup: CalendarQueueGroup = {
  id: '11111111-1111-1111-1111-111111111111',
  name: '안암 저녁 모임',
  confirmed_at: '2026-05-26T11:00:00+00:00',
  confirmed_start_at: '2026-05-30T11:00:00+00:00',
  confirmed_end_at: '2026-05-30T13:00:00+00:00',
  calendar_pushed_at: null,
  calendar_retry_count: 0,
};

Deno.test('isCalendarPushPending: confirmed_at IS NULL → false (모임 미확정)', () => {
  const group: CalendarQueueGroup = { ...baseGroup, confirmed_at: null };
  assertEquals(isCalendarPushPending(group), false);
});

Deno.test('isCalendarPushPending: confirmed_at set + calendar_pushed_at NULL + retry=0 → true', () => {
  assertEquals(isCalendarPushPending(baseGroup), true);
});

Deno.test('isCalendarPushPending: retry=2 (max 미달) → true', () => {
  const group: CalendarQueueGroup = { ...baseGroup, calendar_retry_count: 2 };
  assertEquals(isCalendarPushPending(group), true);
});

Deno.test('isCalendarPushPending: retry=3 (max 도달) → false (영구 fail, 호스트 알림 대상)', () => {
  const group: CalendarQueueGroup = { ...baseGroup, calendar_retry_count: 3 };
  assertEquals(isCalendarPushPending(group), false);
});

Deno.test('isCalendarPushPending: calendar_pushed_at set → false (이미 push 완료, retry 무관)', () => {
  const group: CalendarQueueGroup = {
    ...baseGroup,
    calendar_pushed_at: '2026-05-26T11:05:00+00:00',
    calendar_retry_count: 0,
  };
  assertEquals(isCalendarPushPending(group), false);
});

// ---------------------------------------------------------------------------
// nextRetryState — retry policy (D20 retry max 3)
// ---------------------------------------------------------------------------

Deno.test('nextRetryState: 0 → {nextCount: 1, shouldStop: false}', () => {
  assertEquals(nextRetryState(0), { nextCount: 1, shouldStop: false });
});

Deno.test('nextRetryState: 1 → {nextCount: 2, shouldStop: false}', () => {
  assertEquals(nextRetryState(1), { nextCount: 2, shouldStop: false });
});

Deno.test('nextRetryState: 2 → {nextCount: 3, shouldStop: true} (3회 도달 = max)', () => {
  assertEquals(nextRetryState(2), { nextCount: 3, shouldStop: true });
});

Deno.test('nextRetryState: 3 → {nextCount: 3, shouldStop: true} (이미 max, idempotent)', () => {
  assertEquals(nextRetryState(3), { nextCount: 3, shouldStop: true });
});

Deno.test('nextRetryState: 음수 throw', () => {
  assertThrows(
    () => nextRetryState(-1),
    Error,
    'calendar_retry_count는 0 이상 정수여야 합니다',
  );
});

Deno.test('nextRetryState: 비정수 throw', () => {
  assertThrows(
    () => nextRetryState(1.5),
    Error,
    'calendar_retry_count는 0 이상 정수여야 합니다',
  );
});

Deno.test('nextRetryState: CALENDAR_PUSH_MAX_RETRY === 3 (D20 spec)', () => {
  assertEquals(CALENDAR_PUSH_MAX_RETRY, 3);
});

// ---------------------------------------------------------------------------
// buildCalendarEventPayload — group → 외부 캘린더 event spec (D13 KST 표기)
// ---------------------------------------------------------------------------

Deno.test('buildCalendarEventPayload: 기본 — title=group.name + descriptionKo 한국어 KST', () => {
  const result = buildCalendarEventPayload({
    id: baseGroup.id,
    name: '안암 저녁 모임',
    confirmed_start_at: '2026-05-30T11:00:00+00:00', // KST 20:00 (토요일)
    confirmed_end_at: '2026-05-30T13:00:00+00:00', // KST 22:00
  });
  assertEquals(result.title, '안암 저녁 모임');
  assertEquals(result.startUtcIso, '2026-05-30T11:00:00+00:00');
  assertEquals(result.endUtcIso, '2026-05-30T13:00:00+00:00');
  assertEquals(result.locationName, null);
  // 한국어 KST 표기 검증: 2026-05-30 (토요일) 20:00 ~ 22:00
  assertEquals(
    result.descriptionKo,
    '[된다] 2026년 5월 30일 (토) 20:00 ~ 22:00 KST',
  );
});

Deno.test('buildCalendarEventPayload: placeName 있음 → locationName 포함', () => {
  const result = buildCalendarEventPayload({
    id: baseGroup.id,
    name: '안암 저녁 모임',
    confirmed_start_at: '2026-05-30T11:00:00+00:00',
    confirmed_end_at: '2026-05-30T13:00:00+00:00',
    placeName: '안암 본가집',
  });
  assertEquals(result.locationName, '안암 본가집');
});

Deno.test('buildCalendarEventPayload: placeName=null → locationName=null', () => {
  const result = buildCalendarEventPayload({
    id: baseGroup.id,
    name: '모임',
    confirmed_start_at: '2026-05-30T11:00:00+00:00',
    confirmed_end_at: '2026-05-30T13:00:00+00:00',
    placeName: null,
  });
  assertEquals(result.locationName, null);
});

Deno.test('buildCalendarEventPayload: placeName=undefined → locationName=null', () => {
  const result = buildCalendarEventPayload({
    id: baseGroup.id,
    name: '모임',
    confirmed_start_at: '2026-05-30T11:00:00+00:00',
    confirmed_end_at: '2026-05-30T13:00:00+00:00',
  });
  assertEquals(result.locationName, null);
});

Deno.test('buildCalendarEventPayload: KST 자정 직전 → 날짜 넘김 검증', () => {
  // KST 23:00 (2026-05-26 KST) = UTC 14:00 (2026-05-26)
  // KST 24:00 = 다음날 00:00 KST (2026-05-27 KST) = UTC 15:00 (2026-05-26)
  const result = buildCalendarEventPayload({
    id: baseGroup.id,
    name: '늦은 술자리',
    confirmed_start_at: '2026-05-26T14:00:00+00:00',
    confirmed_end_at: '2026-05-26T15:00:00+00:00',
  });
  assertEquals(
    result.descriptionKo,
    '[된다] 2026년 5월 26일 (화) 23:00 ~ 24:00 KST',
  );
});

Deno.test('buildCalendarEventPayload: name 빈 문자열 → throw', () => {
  assertThrows(
    () =>
      buildCalendarEventPayload({
        id: baseGroup.id,
        name: '',
        confirmed_start_at: '2026-05-30T11:00:00+00:00',
        confirmed_end_at: '2026-05-30T13:00:00+00:00',
      }),
    Error,
    'group.name이 필요합니다',
  );
});

Deno.test('buildCalendarEventPayload: name whitespace → throw', () => {
  assertThrows(
    () =>
      buildCalendarEventPayload({
        id: baseGroup.id,
        name: '   ',
        confirmed_start_at: '2026-05-30T11:00:00+00:00',
        confirmed_end_at: '2026-05-30T13:00:00+00:00',
      }),
    Error,
    'group.name이 필요합니다',
  );
});

Deno.test('buildCalendarEventPayload: end ≤ start → throw', () => {
  assertThrows(
    () =>
      buildCalendarEventPayload({
        id: baseGroup.id,
        name: '모임',
        confirmed_start_at: '2026-05-30T13:00:00+00:00',
        confirmed_end_at: '2026-05-30T11:00:00+00:00',
      }),
    Error,
    'confirmed_end_at은 confirmed_start_at보다 늦어야 합니다',
  );
});

Deno.test('buildCalendarEventPayload: invalid start ISO → throw', () => {
  assertThrows(
    () =>
      buildCalendarEventPayload({
        id: baseGroup.id,
        name: '모임',
        confirmed_start_at: 'not-an-iso',
        confirmed_end_at: '2026-05-30T13:00:00+00:00',
      }),
    Error,
    'confirmed_start_at parse 실패',
  );
});

Deno.test('buildCalendarEventPayload: invalid end ISO → throw', () => {
  assertThrows(
    () =>
      buildCalendarEventPayload({
        id: baseGroup.id,
        name: '모임',
        confirmed_start_at: '2026-05-30T11:00:00+00:00',
        confirmed_end_at: '2026-99-99',
      }),
    Error,
    'confirmed_end_at parse 실패',
  );
});
