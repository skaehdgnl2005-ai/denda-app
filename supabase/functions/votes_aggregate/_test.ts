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

import { aggregateVotes, buildHeatmapPayload } from './index.ts';

// ---------------------------------------------------------------------------
// Test 1: 합산 로직 — start_minute별 count로 그룹화
// ---------------------------------------------------------------------------
Deno.test('aggregateVotes — 동일 start_minute 합산', () => {
  const rows = [
    { start_minute: 540 }, // 09:00
    { start_minute: 540 }, // 09:00 (중복)
    { start_minute: 555 }, // 09:15
    { start_minute: 540 }, // 09:00 (중복)
  ];

  const slots = aggregateVotes(rows);

  assertEquals(slots.length, 2);
  assertEquals(slots[0], { start_minute: 540, count: 3 });
  assertEquals(slots[1], { start_minute: 555, count: 1 });
});

// ---------------------------------------------------------------------------
// Test 2: 빈 votes 처리
// ---------------------------------------------------------------------------
Deno.test('aggregateVotes — 빈 array → 빈 slots', () => {
  const slots = aggregateVotes([]);
  assertEquals(slots, []);
});

// ---------------------------------------------------------------------------
// Test 3: 정렬 — 셔플된 입력도 start_minute 오름차순
// ---------------------------------------------------------------------------
Deno.test('aggregateVotes — 셔플된 입력도 start_minute 오름차순', () => {
  const rows = [
    { start_minute: 1080 }, // 18:00
    { start_minute: 540 }, // 09:00
    { start_minute: 720 }, // 12:00
    { start_minute: 540 }, // 09:00 dup
    { start_minute: 1080 }, // 18:00 dup
  ];

  const slots = aggregateVotes(rows);

  assertEquals(slots.length, 3);
  assertEquals(slots[0].start_minute, 540);
  assertEquals(slots[1].start_minute, 720);
  assertEquals(slots[2].start_minute, 1080);
  assertEquals(slots[0].count, 2);
  assertEquals(slots[1].count, 1);
  assertEquals(slots[2].count, 2);
});

// ---------------------------------------------------------------------------
// Test 4: buildHeatmapPayload — KST timestamp 포함
// ---------------------------------------------------------------------------
Deno.test('buildHeatmapPayload — updated_at은 KST (+09:00) ISO', () => {
  const slots = [{ start_minute: 540, count: 3 }];
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
    { start_minute: 540, count: 2 },
    { start_minute: 555, count: 1 },
  ];
  const groupId = '11111111-2222-3333-4444-555555555555';

  // deno-lint-ignore no-explicit-any
  await broadcastHeatmap(mockClient as any, groupId, slots);

  assertEquals(sendCalls.length, 1);
  assertEquals(sendCalls[0].channelName, `group:${groupId}`);
  assertEquals(sendCalls[0].args.type, 'broadcast');
  assertEquals(sendCalls[0].args.event, 'heatmap_update');

  const payload = sendCalls[0].args.payload as {
    slots: Array<{ start_minute: number; count: number }>;
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
