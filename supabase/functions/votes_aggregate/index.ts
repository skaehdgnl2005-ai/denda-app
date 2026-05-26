// votes_aggregate — D11 Realtime 히트맵 (옵션 B)
//
// votes INSERT/UPDATE/DELETE → DB trigger (0006) → 이 Edge Function 호출 →
// group_id로 votes 합산 → group:${groupId} channel에 heatmap_update broadcast.
//
// 클라이언트는 channel('group:${groupId}').on('broadcast', { event: 'heatmap_update' })
// 만 listen하여 useSharedValue 업데이트 (D12). raw votes 합산 금지 (rules/supabase.md).
//
// heat-0~4 분류는 클라이언트 책임 (S05b worklet 영역). 이 Edge는 raw count만 발송.
//
// **Payload spec (Q-B21 close, D11 본문 갱신)**:
//   { slots: [{day_index, start_minute, count}], updated_at }
//   day_index = groups.dates DATE[]의 0-based offset (가변 길이 day 범위 지원).
//   groups.dates에 없는 votes.day는 무시 (graceful — 호스트가 dates 줄였을 때).
//
// Request: POST { group_id: string }
// Response: { ok: true, slot_count: number }
//
// 환경변수:
//   SUPABASE_URL                — 자동
//   SUPABASE_SERVICE_ROLE_KEY   — 자동
//
// 보안: service_role client (RLS bypass). DB trigger에서 호출되는 내부 함수.
//       외부 client에서 호출 시 service_role 또는 anon JWT 인증 필요 (현재 anon 허용).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getServiceRoleClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import { nowKst } from '../_lib/kst.ts';
import {
  clearHandlers,
  dispatch,
  register,
  type DispatchEvent,
} from '../_lib/dispatcher.ts';
import { handler as notifyF4Handler } from '../notify_f4/index.ts';

// ---------------------------------------------------------------------------
// 순수 함수: 합산 + payload 빌드 (test 가능)
// ---------------------------------------------------------------------------

export interface VoteRow {
  day_index: number; // groups.dates의 0-based offset (Q-B21 close)
  start_minute: number;
}

export interface HeatmapSlot {
  day_index: number;
  start_minute: number;
  count: number;
}

export interface HeatmapPayload {
  slots: HeatmapSlot[];
  updated_at: string; // KST ISO 8601
}

/**
 * votes 행 array → (day_index, start_minute)별 count로 합산.
 *
 * **D11 payload spec (Q-B21 close)**: `groups.dates DATE[]`가 가변 길이라 7일 고정 가정
 * 불가. day_index는 groups.dates의 0-based offset. 예: dates=['2026-06-15','2026-06-16']
 * → day_index 0=월, 1=화. 클라이언트는 dates와 함께 grid 렌더.
 *
 * 정렬: day_index 오름차순 → start_minute 오름차순.
 *
 * D14: 15분 단위 슬롯은 DB CHECK constraint가 보장하므로 여기서 재검증 X.
 */
export function aggregateVotes(rows: VoteRow[]): HeatmapSlot[] {
  const counts = new Map<string, HeatmapSlot>();
  for (const row of rows) {
    const key = `${row.day_index}:${row.start_minute}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, {
        day_index: row.day_index,
        start_minute: row.start_minute,
        count: 1,
      });
    }
  }
  return Array.from(counts.values()).sort(
    (a, b) => a.day_index - b.day_index || a.start_minute - b.start_minute,
  );
}

/**
 * votes raw rows ({day, start_minute}) → VoteRow[] ({day_index, start_minute}).
 * groups.dates에 없는 day는 graceful skip (호스트가 dates 줄였을 때).
 */
export function mapDayToIndex(
  rawRows: Array<{ day: string; start_minute: number }>,
  dates: string[],
): VoteRow[] {
  const dayIndex = new Map<string, number>();
  for (let i = 0; i < dates.length; i++) {
    dayIndex.set(dates[i], i);
  }
  const result: VoteRow[] = [];
  for (const row of rawRows) {
    const idx = dayIndex.get(row.day);
    if (idx === undefined) continue;
    result.push({ day_index: idx, start_minute: row.start_minute });
  }
  return result;
}

// ---------------------------------------------------------------------------
// S12-publishers-f4 — 전원 vote detect 순수 함수
// ---------------------------------------------------------------------------

/**
 * votes raw rows 중 NON-NULL user_id의 unique 개수.
 * - 게스트 (user_id=null)는 group_members 카운트 대상이 아니므로 제외
 * - 동일 user_id 다중 vote는 1로 카운트
 */
export function countUniqueVoters(rows: Array<{ user_id: string | null }>): number {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.user_id) set.add(row.user_id);
  }
  return set.size;
}

export interface IsAllMembersVotedArgs {
  memberCount: number;
  voterCount: number;
}

/**
 * 전원 vote 완료 판정.
 * - memberCount > 0 (빈 그룹 entry race 회피)
 * - voterCount == memberCount (엄격 equal — 멤버 추가/탈퇴 race 안전망)
 */
export function isAllMembersVoted(args: IsAllMembersVotedArgs): boolean {
  return args.memberCount > 0 && args.voterCount === args.memberCount;
}

// ---------------------------------------------------------------------------

/**
 * heatmap broadcast payload 빌드. updated_at = KST ISO (D13).
 */
export function buildHeatmapPayload(slots: HeatmapSlot[]): HeatmapPayload {
  return {
    slots,
    updated_at: nowKst().toISO() ?? '',
  };
}

/**
 * Supabase Realtime broadcast — group:${groupId} channel.
 * D11 spec: type='broadcast', event='heatmap_update'.
 *
 * 주의: supabase-js channel().send()는 channel.subscribe() 호출 없이도
 *       broadcast send가 가능 (ephemeral). server 환경에서는 connect/disconnect
 *       overhead를 피하기 위해 client 한 번 만들고 재사용하는 게 이상적이나,
 *       Edge Function의 짧은 lifecycle 상 매 호출 새 client OK (D11 본문).
 */
export async function broadcastHeatmap(
  client: SupabaseClient,
  groupId: string,
  slots: HeatmapSlot[],
): Promise<void> {
  const channel = client.channel(`group:${groupId}`);
  await channel.send({
    type: 'broadcast',
    event: 'heatmap_update',
    payload: buildHeatmapPayload(slots),
  });
}

// ---------------------------------------------------------------------------
// Dispatcher handler 등록 — 모듈 import 시 1회 (group_confirm pattern mirror)
// ---------------------------------------------------------------------------
// notify_f4 handler를 dispatcher에 register. votes_all_in event가 dispatch되면
// notify_f4가 group_id로 호스트에게 push 발송 (in-process, D33).
// notify_f4는 f4_sent_at IS NULL idempotent하므로 중복 dispatch 안전.

let f4HandlerRegistered = false;

function registerF4Handler(): void {
  if (f4HandlerRegistered) return;
  register('votes_all_in', async (event: DispatchEvent) => {
    if (event.type !== 'votes_all_in') return;
    const fakeReq = new Request('http://internal/notify_f4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: event.groupId }),
    });
    await notifyF4Handler(fakeReq);
  });
  f4HandlerRegistered = true;
}

// 테스트가 dispatcher state를 reset할 때 다시 register할 수 있도록 export
export function _resetDispatcherRegistration(): void {
  clearHandlers();
  f4HandlerRegistered = false;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

interface AggregateRequest {
  group_id?: string;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  let body: AggregateRequest;
  try {
    body = (await req.json()) as AggregateRequest;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  const groupId = body.group_id;
  if (!groupId || !isUuid(groupId)) {
    return errorResponse('group_id (UUID)가 필요합니다.', 400);
  }

  registerF4Handler();

  const supabase = getServiceRoleClient();

  // 1) groups.dates SELECT — day_index 매핑용 (Q-B21 close)
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('dates')
    .eq('id', groupId)
    .single();

  if (groupError) {
    return errorResponse(`groups 조회 실패: ${groupError.message}`, 500);
  }
  if (!group) {
    return errorResponse(`group_id=${groupId} not found`, 404);
  }
  const dates = ((group as { dates: string[] | null }).dates ?? []) as string[];

  // 2) votes (day·start_minute·user_id) + group_members 병렬 fetch
  const [votesResult, membersResult] = await Promise.all([
    supabase
      .from('votes')
      .select('day, start_minute, user_id')
      .eq('group_id', groupId),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
  ]);

  if (votesResult.error) {
    return errorResponse(`votes 조회 실패: ${votesResult.error.message}`, 500);
  }
  if (membersResult.error) {
    return errorResponse(
      `group_members 조회 실패: ${membersResult.error.message}`,
      500,
    );
  }

  const rawVotes = (votesResult.data ?? []) as Array<{
    day: string;
    start_minute: number;
    user_id: string | null;
  }>;
  const members = (membersResult.data ?? []) as Array<{ user_id: string }>;

  // 3) day → day_index 매핑 + 합산
  const voteRows = mapDayToIndex(rawVotes, dates);
  const slots = aggregateVotes(voteRows);

  try {
    await broadcastHeatmap(supabase, groupId, slots);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`broadcast 실패: ${message}`, 500);
  }

  // 4) 전원 vote 완료 detect → dispatcher publish (S12 F4)
  //    notify_f4가 f4_sent_at IS NULL idempotent하므로 매 votes change에 dispatch해도 안전.
  //    dispatch 실패는 broadcast 결과(slots)에는 영향 없음 — 격리.
  const voterCount = countUniqueVoters(rawVotes);
  const memberCount = members.length;
  let f4Dispatched = false;
  if (isAllMembersVoted({ memberCount, voterCount })) {
    try {
      await dispatch({ type: 'votes_all_in', groupId });
      f4Dispatched = true;
    } catch {
      // 격리 — broadcast는 이미 성공
      f4Dispatched = false;
    }
  }

  return jsonResponse({
    ok: true,
    slot_count: slots.length,
    all_voted: isAllMembersVoted({ memberCount, voterCount }),
    f4_dispatched: f4Dispatched,
  });
}

// Deno test에서 import 시 serve() 부수효과 회피
if (import.meta.main) {
  serve(handler);
}

// 외부에서 직접 호출 (e.g. dispatcher) 가능하도록 export
export { handler };
