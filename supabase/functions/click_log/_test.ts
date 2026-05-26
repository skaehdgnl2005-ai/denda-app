// click_log Edge Function — Deno tests (S08, Gate #2 single source of truth)
//
// 순수 함수 단위 검증 — parseClickLogRequest + validateSegmentLabel.
// HTTP handler + Supabase INSERT는 운영 환경 검증.
//
// 실행:
//   deno test functions/click_log/_test.ts --no-check

import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildClickEventRow,
  parseClickLogRequest,
  type ClickLogRequestRaw,
} from './index.ts';

const VALID_UUID_1 = '11111111-2222-3333-4444-555555555555';
const VALID_UUID_2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_UUID_3 = '99999999-8888-7777-6666-555555555555';
const VALID_UUID_4 = '12345678-1234-1234-1234-123456789abc';

// ---------------------------------------------------------------------------
// parseClickLogRequest — JSON body 파싱 + UUID 검증
// ---------------------------------------------------------------------------

Deno.test('parseClickLogRequest — 최소 필수 4개 UUID 통과', () => {
  const body: ClickLogRequestRaw = {
    event_id: VALID_UUID_1,
    group_id: VALID_UUID_2,
    place_id: VALID_UUID_3,
  };
  const parsed = parseClickLogRequest(body);
  assertEquals(parsed.eventId, VALID_UUID_1);
  assertEquals(parsed.groupId, VALID_UUID_2);
  assertEquals(parsed.placeId, VALID_UUID_3);
  assertEquals(parsed.partnershipId, null);
  assertEquals(parsed.segmentLabel, null);
});

Deno.test('parseClickLogRequest — partnership_id + segment_label 포함', () => {
  const body: ClickLogRequestRaw = {
    event_id: VALID_UUID_1,
    group_id: VALID_UUID_2,
    place_id: VALID_UUID_3,
    partnership_id: VALID_UUID_4,
    segment_label: 'P1',
  };
  const parsed = parseClickLogRequest(body);
  assertEquals(parsed.partnershipId, VALID_UUID_4);
  assertEquals(parsed.segmentLabel, 'P1');
});

Deno.test('parseClickLogRequest — partnership_id null 명시 OK', () => {
  const body: ClickLogRequestRaw = {
    event_id: VALID_UUID_1,
    group_id: VALID_UUID_2,
    place_id: VALID_UUID_3,
    partnership_id: null,
    segment_label: null,
  };
  const parsed = parseClickLogRequest(body);
  assertEquals(parsed.partnershipId, null);
  assertEquals(parsed.segmentLabel, null);
});

Deno.test('parseClickLogRequest — segment_label P2 통과', () => {
  const body: ClickLogRequestRaw = {
    event_id: VALID_UUID_1,
    group_id: VALID_UUID_2,
    place_id: VALID_UUID_3,
    segment_label: 'P2',
  };
  const parsed = parseClickLogRequest(body);
  assertEquals(parsed.segmentLabel, 'P2');
});

Deno.test('parseClickLogRequest — event_id UUID 아님 throw', () => {
  assertThrows(() =>
    parseClickLogRequest({
      event_id: 'not-a-uuid',
      group_id: VALID_UUID_2,
      place_id: VALID_UUID_3,
    }),
  );
});

Deno.test('parseClickLogRequest — group_id 누락 throw', () => {
  assertThrows(() =>
    parseClickLogRequest({
      event_id: VALID_UUID_1,
      place_id: VALID_UUID_3,
    } as ClickLogRequestRaw),
  );
});

Deno.test('parseClickLogRequest — place_id 누락 throw', () => {
  assertThrows(() =>
    parseClickLogRequest({
      event_id: VALID_UUID_1,
      group_id: VALID_UUID_2,
    } as ClickLogRequestRaw),
  );
});

Deno.test('parseClickLogRequest — partnership_id UUID 아님 throw', () => {
  assertThrows(() =>
    parseClickLogRequest({
      event_id: VALID_UUID_1,
      group_id: VALID_UUID_2,
      place_id: VALID_UUID_3,
      partnership_id: 'not-uuid',
    }),
  );
});

Deno.test('parseClickLogRequest — segment_label 알 수 없는 값 throw', () => {
  assertThrows(() =>
    parseClickLogRequest({
      event_id: VALID_UUID_1,
      group_id: VALID_UUID_2,
      place_id: VALID_UUID_3,
      segment_label: 'P3',
    }),
  );
});

Deno.test('parseClickLogRequest — segment_label 빈 문자열 throw', () => {
  assertThrows(() =>
    parseClickLogRequest({
      event_id: VALID_UUID_1,
      group_id: VALID_UUID_2,
      place_id: VALID_UUID_3,
      segment_label: '',
    }),
  );
});

Deno.test('parseClickLogRequest — body가 null throw', () => {
  assertThrows(() => parseClickLogRequest(null as unknown as ClickLogRequestRaw));
});

Deno.test('parseClickLogRequest — event_id 누락 throw', () => {
  assertThrows(() =>
    parseClickLogRequest({
      group_id: VALID_UUID_2,
      place_id: VALID_UUID_3,
    } as ClickLogRequestRaw),
  );
});

// ---------------------------------------------------------------------------
// buildClickEventRow — INSERT row shape
// ---------------------------------------------------------------------------

Deno.test('buildClickEventRow — 모든 필드 포함', () => {
  const row = buildClickEventRow({
    eventId: VALID_UUID_1,
    userId: VALID_UUID_2,
    groupId: VALID_UUID_3,
    placeId: VALID_UUID_4,
    partnershipId: VALID_UUID_1,
    segmentLabel: 'P1',
    clickedAtIso: '2026-05-26T12:34:56.000Z',
  });
  assertEquals(row.event_id, VALID_UUID_1);
  assertEquals(row.user_id, VALID_UUID_2);
  assertEquals(row.group_id, VALID_UUID_3);
  assertEquals(row.place_id, VALID_UUID_4);
  assertEquals(row.partnership_id, VALID_UUID_1);
  assertEquals(row.segment_label, 'P1');
  assertEquals(row.clicked_at, '2026-05-26T12:34:56.000Z');
});

Deno.test('buildClickEventRow — partnership_id null + segment_label null', () => {
  const row = buildClickEventRow({
    eventId: VALID_UUID_1,
    userId: VALID_UUID_2,
    groupId: VALID_UUID_3,
    placeId: VALID_UUID_4,
    partnershipId: null,
    segmentLabel: null,
    clickedAtIso: '2026-05-26T12:34:56.000Z',
  });
  assertEquals(row.partnership_id, null);
  assertEquals(row.segment_label, null);
});

Deno.test('buildClickEventRow — clicked_at은 ISO 그대로 전달 (D13 TIMESTAMPTZ)', () => {
  const iso = '2026-05-26T03:45:00.123Z';
  const row = buildClickEventRow({
    eventId: VALID_UUID_1,
    userId: VALID_UUID_2,
    groupId: VALID_UUID_3,
    placeId: VALID_UUID_4,
    partnershipId: null,
    segmentLabel: null,
    clickedAtIso: iso,
  });
  assertEquals(row.clicked_at, iso);
});
