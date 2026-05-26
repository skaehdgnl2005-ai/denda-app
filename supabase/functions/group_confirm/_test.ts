// group_confirm Edge Function — Deno tests (S04, D14, D17 mirror, D33)
//
// 실행:
//   cd supabase && deno test functions/group_confirm/_test.ts --no-check

import {
  assertEquals,
  assertExists,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DateTime } from 'npm:luxon@3.4.4';

import {
  buildConfirmedTimestamps,
  parseConfirmRequest,
  validateConfirmInput,
  type ConfirmRequestRaw,
} from './index.ts';

// ---------------------------------------------------------------------------
// parseConfirmRequest — JSON body 파싱 + 기본 schema 검증
// ---------------------------------------------------------------------------
Deno.test('parseConfirmRequest — 유효한 body', () => {
  const body: ConfirmRequestRaw = {
    group_id: '11111111-2222-3333-4444-555555555555',
    day_index: 0,
    start_minute: 540,
    end_minute: 600,
    confirmed_place_id: null,
  };
  const parsed = parseConfirmRequest(body);
  assertEquals(parsed.groupId, body.group_id);
  assertEquals(parsed.dayIndex, 0);
  assertEquals(parsed.startMinute, 540);
  assertEquals(parsed.endMinute, 600);
  assertEquals(parsed.confirmedPlaceId, null);
});

Deno.test('parseConfirmRequest — confirmed_place_id 있을 때', () => {
  const body: ConfirmRequestRaw = {
    group_id: '11111111-2222-3333-4444-555555555555',
    day_index: 2,
    start_minute: 720,
    end_minute: 780,
    confirmed_place_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  };
  const parsed = parseConfirmRequest(body);
  assertEquals(parsed.confirmedPlaceId, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
});

Deno.test('parseConfirmRequest — UUID 아닌 group_id throw', () => {
  assertThrows(() =>
    parseConfirmRequest({
      group_id: 'not-uuid',
      day_index: 0,
      start_minute: 540,
      end_minute: 600,
      confirmed_place_id: null,
    }),
  );
});

Deno.test('parseConfirmRequest — day_index 음수 throw', () => {
  assertThrows(() =>
    parseConfirmRequest({
      group_id: '11111111-2222-3333-4444-555555555555',
      day_index: -1,
      start_minute: 540,
      end_minute: 600,
      confirmed_place_id: null,
    }),
  );
});

// ---------------------------------------------------------------------------
// validateConfirmInput — D14 (15분 슬롯) + 09:00~24:00 범위 + start < end
// ---------------------------------------------------------------------------
Deno.test('validateConfirmInput — D14 15분 단위 강제', () => {
  assertThrows(() =>
    validateConfirmInput({
      dayIndex: 0,
      startMinute: 540,
      endMinute: 555, // OK 15분 단위
      datesCount: 3,
    }),
  // 540~555 OK라 throw 안 함 → 다른 테스트
  );
  // 13분 단위는 throw
  assertThrows(() =>
    validateConfirmInput({
      dayIndex: 0,
      startMinute: 543,
      endMinute: 555,
      datesCount: 3,
    }),
  );
});

Deno.test('validateConfirmInput — start_minute 09:00(540) 이전 throw', () => {
  assertThrows(() =>
    validateConfirmInput({
      dayIndex: 0,
      startMinute: 480, // 08:00 ← 09:00 이전
      endMinute: 540,
      datesCount: 3,
    }),
  );
});

Deno.test('validateConfirmInput — end_minute 24:00(1440) 초과 throw', () => {
  assertThrows(() =>
    validateConfirmInput({
      dayIndex: 0,
      startMinute: 1425, // 23:45
      endMinute: 1455, // 24:15 ← 1440 초과
      datesCount: 3,
    }),
  );
});

Deno.test('validateConfirmInput — start ≥ end throw', () => {
  assertThrows(() =>
    validateConfirmInput({
      dayIndex: 0,
      startMinute: 600,
      endMinute: 600,
      datesCount: 3,
    }),
  );
  assertThrows(() =>
    validateConfirmInput({
      dayIndex: 0,
      startMinute: 720,
      endMinute: 600,
      datesCount: 3,
    }),
  );
});

Deno.test('validateConfirmInput — day_index ≥ datesCount throw', () => {
  assertThrows(() =>
    validateConfirmInput({
      dayIndex: 3, // dates는 3개 (index 0~2)
      startMinute: 540,
      endMinute: 600,
      datesCount: 3,
    }),
  );
});

Deno.test('validateConfirmInput — datesCount 0 → day_index 0도 throw', () => {
  assertThrows(() =>
    validateConfirmInput({
      dayIndex: 0,
      startMinute: 540,
      endMinute: 600,
      datesCount: 0,
    }),
  );
});

Deno.test('validateConfirmInput — 유효 입력은 no-op', () => {
  // throw 안 함
  validateConfirmInput({
    dayIndex: 0,
    startMinute: 540,
    endMinute: 600,
    datesCount: 3,
  });
  validateConfirmInput({
    dayIndex: 2,
    startMinute: 1425, // 23:45
    endMinute: 1440, // 24:00 OK
    datesCount: 3,
  });
});

// ---------------------------------------------------------------------------
// buildConfirmedTimestamps — KST day + minute → UTC ISO (D13)
// ---------------------------------------------------------------------------
Deno.test('buildConfirmedTimestamps — KST 09:00 → UTC 00:00', () => {
  const result = buildConfirmedTimestamps({
    dayIsoDate: '2026-06-15',
    startMinute: 540, // KST 09:00
    endMinute: 600, // KST 10:00
  });
  // KST 2026-06-15 09:00 = UTC 2026-06-15 00:00
  const start = DateTime.fromISO(result.startUtcIso, { zone: 'utc' });
  assertEquals(start.year, 2026);
  assertEquals(start.month, 6);
  assertEquals(start.day, 15);
  assertEquals(start.hour, 0);
  assertEquals(start.minute, 0);

  const end = DateTime.fromISO(result.endUtcIso, { zone: 'utc' });
  assertEquals(end.hour, 1);
});

Deno.test('buildConfirmedTimestamps — KST 자정 직전(23:45)은 UTC 14:45', () => {
  const result = buildConfirmedTimestamps({
    dayIsoDate: '2026-06-15',
    startMinute: 1425, // KST 23:45
    endMinute: 1440, // KST 24:00
  });
  const start = DateTime.fromISO(result.startUtcIso, { zone: 'utc' });
  assertEquals(start.hour, 14);
  assertEquals(start.minute, 45);

  // end 24:00 = KST 다음날 00:00 = UTC 같은날 15:00
  const end = DateTime.fromISO(result.endUtcIso, { zone: 'utc' });
  assertEquals(end.hour, 15);
  assertEquals(end.minute, 0);
});

Deno.test('buildConfirmedTimestamps — UTC ISO에 Z 또는 +00:00 포함', () => {
  const result = buildConfirmedTimestamps({
    dayIsoDate: '2026-06-15',
    startMinute: 540,
    endMinute: 600,
  });
  assertExists(result.startUtcIso);
  // luxon UTC toISO는 'Z'로 끝남
  assertEquals(
    result.startUtcIso.endsWith('Z') || result.startUtcIso.endsWith('+00:00'),
    true,
  );
});
