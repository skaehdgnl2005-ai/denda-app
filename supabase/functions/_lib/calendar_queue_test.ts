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
  appendPartialFailEntries,
  buildCalendarEventPayload,
  buildCalendarPartialFailEntries,
  CALENDAR_PUSH_MAX_RETRY,
  CALENDAR_PUSH_CHANNEL,
  decideGroupPushOutcome,
  isCalendarPushPending,
  type MemberPushOutcome,
  nextRetryState,
  selectPendingFromRows,
  type CalendarQueueGroup,
  type PartialFailEntry,
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

// ---------------------------------------------------------------------------
// buildCalendarPartialFailEntries — D19 partial fail 누적 (channel='calendar_push')
// ---------------------------------------------------------------------------

Deno.test('CALENDAR_PUSH_CHANNEL === "calendar_push" (notify_f5 channel과 schema 정합)', () => {
  assertEquals(CALENDAR_PUSH_CHANNEL, 'calendar_push');
});

Deno.test('buildCalendarPartialFailEntries: 빈 failures → 빈 array', () => {
  const result = buildCalendarPartialFailEntries({
    failures: [],
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result, []);
});

Deno.test('buildCalendarPartialFailEntries: 1 failure → 1 entry + channel=calendar_push', () => {
  const result = buildCalendarPartialFailEntries({
    failures: [{ userId: '11111111-1111-1111-1111-111111111111', reason: 'token_expired' }],
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result.length, 1);
  assertEquals(result[0], {
    user_id: '11111111-1111-1111-1111-111111111111',
    reason: 'token_expired',
    channel: 'calendar_push',
    occurred_at: '2026-05-26T20:00:00+09:00',
  });
});

Deno.test('buildCalendarPartialFailEntries: 다중 failures → entries 순서 보존', () => {
  const result = buildCalendarPartialFailEntries({
    failures: [
      { userId: 'u1', reason: 'r1' },
      { userId: 'u2', reason: 'r2' },
      { userId: 'u3', reason: 'r3' },
    ],
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result.length, 3);
  assertEquals(result.map((e) => e.user_id), ['u1', 'u2', 'u3']);
  assertEquals(result.every((e) => e.channel === 'calendar_push'), true);
});

Deno.test('buildCalendarPartialFailEntries: channel override 가능 (확장성)', () => {
  const result = buildCalendarPartialFailEntries({
    failures: [{ userId: 'u1', reason: 'r1' }],
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
    channel: 'calendar_push_google_only',
  });
  assertEquals(result[0].channel, 'calendar_push_google_only');
});

// ---------------------------------------------------------------------------
// appendPartialFailEntries — JSONB array immutable 누적
// ---------------------------------------------------------------------------

const SAMPLE_ENTRY: PartialFailEntry = {
  user_id: 'u1',
  reason: 'r1',
  channel: 'calendar_push',
  occurred_at: '2026-05-26T20:00:00+09:00',
};

Deno.test('appendPartialFailEntries: empty + entry → [entry]', () => {
  const result = appendPartialFailEntries([], [SAMPLE_ENTRY]);
  assertEquals(result, [SAMPLE_ENTRY]);
});

Deno.test('appendPartialFailEntries: existing + new → 누적 (순서 보존)', () => {
  const existing: PartialFailEntry[] = [SAMPLE_ENTRY];
  const newEntries: PartialFailEntry[] = [
    { ...SAMPLE_ENTRY, user_id: 'u2', reason: 'r2' },
  ];
  const result = appendPartialFailEntries(existing, newEntries);
  assertEquals(result.length, 2);
  assertEquals(result[0].user_id, 'u1');
  assertEquals(result[1].user_id, 'u2');
});

Deno.test('appendPartialFailEntries: immutable (원본 existing 변경 X)', () => {
  const existing: PartialFailEntry[] = [SAMPLE_ENTRY];
  appendPartialFailEntries(existing, [{ ...SAMPLE_ENTRY, user_id: 'u2' }]);
  assertEquals(existing.length, 1); // 원본 그대로
});

Deno.test('appendPartialFailEntries: 둘 다 빈 → 빈', () => {
  assertEquals(appendPartialFailEntries([], []), []);
});

// ---------------------------------------------------------------------------
// selectPendingFromRows — DB rows 안전망 필터
// ---------------------------------------------------------------------------

Deno.test('selectPendingFromRows: 모두 pending → 모두 반환', () => {
  const rows: CalendarQueueGroup[] = [
    { ...baseGroup, id: 'g1' },
    { ...baseGroup, id: 'g2', calendar_retry_count: 2 },
  ];
  const result = selectPendingFromRows(rows);
  assertEquals(result.length, 2);
  assertEquals(result.map((g) => g.id), ['g1', 'g2']);
});

Deno.test('selectPendingFromRows: mix → pending만 반환 (순서 보존)', () => {
  const rows: CalendarQueueGroup[] = [
    { ...baseGroup, id: 'g1' }, // pending
    { ...baseGroup, id: 'g2', confirmed_at: null }, // confirm 안 됨
    { ...baseGroup, id: 'g3', calendar_pushed_at: '2026-05-26T20:00:00+09:00' }, // 이미 push 완료
    { ...baseGroup, id: 'g4', calendar_retry_count: 3 }, // max 도달
    { ...baseGroup, id: 'g5', calendar_retry_count: 2 }, // pending
  ];
  const result = selectPendingFromRows(rows);
  assertEquals(result.map((g) => g.id), ['g1', 'g5']);
});

Deno.test('selectPendingFromRows: 빈 입력 → 빈', () => {
  assertEquals(selectPendingFromRows([]), []);
});

// ---------------------------------------------------------------------------
// decideGroupPushOutcome — worker DB UPDATE 의사결정 (100% 순수)
// ---------------------------------------------------------------------------

Deno.test('decideGroupPushOutcome: 모든 멤버 성공 → shouldSetPushedAt=true, retry 변경 X', () => {
  const outcomes: MemberPushOutcome[] = [
    { userId: 'u1', result: 'ok' },
    { userId: 'u2', result: 'ok' },
  ];
  const result = decideGroupPushOutcome({
    group: { ...baseGroup, calendar_retry_count: 1 },
    memberOutcomes: outcomes,
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result.shouldSetPushedAt, true);
  assertEquals(result.newRetryCount, 1); // 변경 X
  assertEquals(result.newPartialFailEntries, []);
  assertEquals(result.shouldStop, false);
});

Deno.test('decideGroupPushOutcome: 일부 실패 + retry=0 → retry_count=1, partial_fail append, shouldStop=false', () => {
  const outcomes: MemberPushOutcome[] = [
    { userId: 'u1', result: 'ok' },
    { userId: 'u2', result: { reason: 'token_expired' } },
  ];
  const result = decideGroupPushOutcome({
    group: { ...baseGroup, calendar_retry_count: 0 },
    memberOutcomes: outcomes,
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result.shouldSetPushedAt, false);
  assertEquals(result.newRetryCount, 1);
  assertEquals(result.newPartialFailEntries.length, 1);
  assertEquals(result.newPartialFailEntries[0], {
    user_id: 'u2',
    reason: 'token_expired',
    channel: 'calendar_push',
    occurred_at: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result.shouldStop, false);
});

Deno.test('decideGroupPushOutcome: 일부 실패 + retry=2 → retry_count=3, shouldStop=true', () => {
  const outcomes: MemberPushOutcome[] = [
    { userId: 'u1', result: { reason: 'api_error' } },
  ];
  const result = decideGroupPushOutcome({
    group: { ...baseGroup, calendar_retry_count: 2 },
    memberOutcomes: outcomes,
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result.shouldSetPushedAt, false);
  assertEquals(result.newRetryCount, 3);
  assertEquals(result.shouldStop, true);
  assertEquals(result.newPartialFailEntries.length, 1);
});

Deno.test('decideGroupPushOutcome: 멤버 0명 → shouldSetPushedAt=true (큐 무한 누적 회피)', () => {
  const result = decideGroupPushOutcome({
    group: { ...baseGroup, calendar_retry_count: 0 },
    memberOutcomes: [],
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result.shouldSetPushedAt, true);
  assertEquals(result.newRetryCount, 0);
});

Deno.test('decideGroupPushOutcome: 모든 멤버 실패 → 전부 partial_fail에 기록 + retry++', () => {
  const outcomes: MemberPushOutcome[] = [
    { userId: 'u1', result: { reason: 'r1' } },
    { userId: 'u2', result: { reason: 'r2' } },
    { userId: 'u3', result: { reason: 'r3' } },
  ];
  const result = decideGroupPushOutcome({
    group: { ...baseGroup, calendar_retry_count: 1 },
    memberOutcomes: outcomes,
    occurredAtKstIso: '2026-05-26T20:00:00+09:00',
  });
  assertEquals(result.shouldSetPushedAt, false);
  assertEquals(result.newRetryCount, 2);
  assertEquals(result.shouldStop, false);
  assertEquals(result.newPartialFailEntries.length, 3);
  assertEquals(
    result.newPartialFailEntries.map((e) => e.user_id),
    ['u1', 'u2', 'u3'],
  );
});
