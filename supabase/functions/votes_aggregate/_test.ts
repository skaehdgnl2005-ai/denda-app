// votes_aggregate Edge Function — Deno tests (S05a, D11)
//
// 실행:
//   cd supabase && deno test functions/votes_aggregate/_test.ts \
//     --allow-env --allow-net --no-check
//
//   또는 supabase CLI:
//     supabase functions serve   # 별도 터미널
//     deno test ... (위와 동일)
//
// 이 테스트는 SDK 호출을 mock 하여 순수 합산/broadcast 로직만 검증한다.
// 실제 DB·Realtime broadcast 통합은 supabase start + integration test 영역.

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DateTime } from 'npm:luxon@3.4.4';

import { aggregateVotes, buildHeatmapPayload, mapDayToIndex } from './index.ts';

// ---------------------------------------------------------------------------
// Test 1: 합산 로직 — (day_index, start_minute)별 count로 그룹화 (Q-B21 close)
// ---------------------------------------------------------------------------
Deno.test('aggregateVotes — 동일 (day_index, start_minute) 합산', () => {
  const rows = [
    { day_index: 0, start_minute: 540 }, // 월 09:00
    { day_index: 0, start_minute: 540 }, // 월 09:00 dup
    { day_index: 0, start_minute: 555 }, // 월 09:15
    { day_index: 0, start_minute: 540 }, // 월 09:00 dup
  ];

  const slots = aggregateVotes(rows);

  assertEquals(slots.length, 2);
  assertEquals(slots[0], { day_index: 0, start_minute: 540, count: 3 });
  assertEquals(slots[1], { day_index: 0, start_minute: 555, count: 1 });
});

// ---------------------------------------------------------------------------
// Test 2: 빈 votes 처리
// ---------------------------------------------------------------------------
Deno.test('aggregateVotes — 빈 array → 빈 slots', () => {
  const slots = aggregateVotes([]);
  assertEquals(slots, []);
});

// ---------------------------------------------------------------------------
// Test 3: 정렬 — day_index 오름차순 → start_minute 오름차순
// ---------------------------------------------------------------------------
Deno.test('aggregateVotes — day_index → start_minute 오름차순 정렬', () => {
  const rows = [
    { day_index: 2, start_minute: 1080 }, // 수 18:00
    { day_index: 0, start_minute: 540 }, // 월 09:00
    { day_index: 1, start_minute: 720 }, // 화 12:00
    { day_index: 0, start_minute: 540 }, // 월 09:00 dup
    { day_index: 2, start_minute: 540 }, // 수 09:00
    { day_index: 2, start_minute: 1080 }, // 수 18:00 dup
  ];

  const slots = aggregateVotes(rows);

  assertEquals(slots.length, 4);
  assertEquals(slots[0], { day_index: 0, start_minute: 540, count: 2 });
  assertEquals(slots[1], { day_index: 1, start_minute: 720, count: 1 });
  assertEquals(slots[2], { day_index: 2, start_minute: 540, count: 1 });
  assertEquals(slots[3], { day_index: 2, start_minute: 1080, count: 2 });
});

// ---------------------------------------------------------------------------
// Test 3b: 다른 day_index, 같은 start_minute → 별개 slot 유지 (회귀 방지)
// ---------------------------------------------------------------------------
Deno.test('aggregateVotes — 다른 day_index의 같은 start_minute은 별개 slot', () => {
  const rows = [
    { day_index: 0, start_minute: 540 },
    { day_index: 1, start_minute: 540 },
    { day_index: 2, start_minute: 540 },
  ];

  const slots = aggregateVotes(rows);

  assertEquals(slots.length, 3);
  assertEquals(slots[0], { day_index: 0, start_minute: 540, count: 1 });
  assertEquals(slots[1], { day_index: 1, start_minute: 540, count: 1 });
  assertEquals(slots[2], { day_index: 2, start_minute: 540, count: 1 });
});

// ---------------------------------------------------------------------------
// Test 3c: mapDayToIndex — DB raw rows ({day, start_minute}) → VoteRow[]
// ---------------------------------------------------------------------------
Deno.test('mapDayToIndex — groups.dates 기준 0-based offset 매핑', () => {
  const dates = ['2026-06-15', '2026-06-16', '2026-06-17'];
  const rawRows = [
    { day: '2026-06-15', start_minute: 540 },
    { day: '2026-06-17', start_minute: 600 },
    { day: '2026-06-16', start_minute: 555 },
  ];

  const result = mapDayToIndex(rawRows, dates);

  assertEquals(result.length, 3);
  assertEquals(result[0], { day_index: 0, start_minute: 540 });
  assertEquals(result[1], { day_index: 2, start_minute: 600 });
  assertEquals(result[2], { day_index: 1, start_minute: 555 });
});

Deno.test('mapDayToIndex — groups.dates에 없는 day는 graceful skip', () => {
  const dates = ['2026-06-15', '2026-06-16'];
  const rawRows = [
    { day: '2026-06-15', start_minute: 540 }, // 매핑됨
    { day: '2026-06-20', start_minute: 600 }, // 호스트가 dates에서 뺐음 → skip
    { day: '2026-06-16', start_minute: 555 }, // 매핑됨
  ];

  const result = mapDayToIndex(rawRows, dates);

  assertEquals(result.length, 2);
  assertEquals(result[0], { day_index: 0, start_minute: 540 });
  assertEquals(result[1], { day_index: 1, start_minute: 555 });
});

Deno.test('mapDayToIndex — 빈 dates → 모든 row skip', () => {
  const result = mapDayToIndex([{ day: '2026-06-15', start_minute: 540 }], []);
  assertEquals(result, []);
});

// ---------------------------------------------------------------------------
// Test 4: buildHeatmapPayload — KST timestamp 포함
// ---------------------------------------------------------------------------
Deno.test('buildHeatmapPayload — updated_at은 KST (+09:00) ISO', () => {
  const slots = [{ day_index: 0, start_minute: 540, count: 3 }];
  const payload = buildHeatmapPayload(slots);

  assertExists(payload.updated_at);
  assertEquals(payload.slots, slots);

  // ISO 문자열에 +09:00 offset이 포함되어야 함 (D13 KST)
  // luxon toISO()는 offset만 직렬화하므로 zoneName 대신 offset으로 검증.
  const parsed = DateTime.fromISO(payload.updated_at, { setZone: true });
  // KST = UTC+9 → 540 minutes
  assertEquals(parsed.offset, 9 * 60);
  // 문자열에도 +09:00이 포함됨 (정확한 직렬화 검증)
  assertEquals(payload.updated_at.includes('+09:00'), true);
});

// ---------------------------------------------------------------------------
// Test 5: broadcast 호출 검증 — channel name·event name·payload 모두
// ---------------------------------------------------------------------------
Deno.test('broadcast 호출 — channel name·event name·payload 검증', async () => {
  const sendCalls: Array<{
    channelName: string;
    args: { type: string; event: string; payload: unknown };
  }> = [];

  // mock supabase client (channel().send() 호출만 캡처)
  const mockClient = {
    channel(name: string) {
      return {
        send(args: { type: string; event: string; payload: unknown }) {
          sendCalls.push({ channelName: name, args });
          return Promise.resolve('ok');
        },
      };
    },
  };

  const { broadcastHeatmap } = await import('./index.ts');

  const slots = [
    { day_index: 0, start_minute: 540, count: 2 },
    { day_index: 0, start_minute: 555, count: 1 },
    { day_index: 1, start_minute: 540, count: 1 },
  ];
  const groupId = '11111111-2222-3333-4444-555555555555';

  // deno-lint-ignore no-explicit-any
  await broadcastHeatmap(mockClient as any, groupId, slots);

  assertEquals(sendCalls.length, 1);
  assertEquals(sendCalls[0].channelName, `group:${groupId}`);
  assertEquals(sendCalls[0].args.type, 'broadcast');
  assertEquals(sendCalls[0].args.event, 'heatmap_update');

  const payload = sendCalls[0].args.payload as {
    slots: Array<{ day_index: number; start_minute: number; count: number }>;
    updated_at: string;
  };
  assertEquals(payload.slots, slots);
  assertExists(payload.updated_at);

  // KST 확인 (offset 검증)
  const parsed = DateTime.fromISO(payload.updated_at, { setZone: true });
  assertEquals(parsed.offset, 9 * 60);
  assertEquals(payload.updated_at.includes('+09:00'), true);
});

// ---------------------------------------------------------------------------
// Test 6: 빈 votes broadcast — slots: [] 로 발송 (group 존재 시)
// ---------------------------------------------------------------------------
Deno.test('broadcast — 빈 votes도 slots: []로 발송', async () => {
  const sendCalls: Array<{ channelName: string; args: unknown }> = [];

  const mockClient = {
    channel(name: string) {
      return {
        send(args: unknown) {
          sendCalls.push({ channelName: name, args });
          return Promise.resolve('ok');
        },
      };
    },
  };

  const { broadcastHeatmap } = await import('./index.ts');
  const groupId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  // deno-lint-ignore no-explicit-any
  await broadcastHeatmap(mockClient as any, groupId, []);

  assertEquals(sendCalls.length, 1);
  const args = sendCalls[0].args as {
    type: string;
    event: string;
    payload: { slots: unknown[] };
  };
  assertEquals(args.event, 'heatmap_update');
  assertEquals(args.payload.slots, []);
});
