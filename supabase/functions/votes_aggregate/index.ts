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

// ---------------------------------------------------------------------------
// 순수 함수: 합산 + payload 빌드 (test 가능)
// ---------------------------------------------------------------------------

export interface VoteRow {
  start_minute: number;
}

export interface HeatmapSlot {
  start_minute: number;
  count: number;
}

export interface HeatmapPayload {
  slots: HeatmapSlot[];
  updated_at: string; // KST ISO 8601
}

/**
 * votes 행 array → start_minute별 count로 합산 (오름차순 정렬).
 *
 * D14: 15분 단위 슬롯은 DB CHECK constraint가 보장하므로 여기서 재검증 X.
 */
export function aggregateVotes(rows: VoteRow[]): HeatmapSlot[] {
  const counts = new Map<number, number>();
  for (const row of rows) {
    counts.set(row.start_minute, (counts.get(row.start_minute) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([start_minute, count]) => ({ start_minute, count }))
    .sort((a, b) => a.start_minute - b.start_minute);
}

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

  const supabase = getServiceRoleClient();

  // RLS는 service_role bypass. votes 전체를 group_id로 read.
  // is_blocked 필터는 votes 합산에서 의미 모호 → 적용 안 함 (OPEN_QUESTIONS 별도 task).
  const { data, error } = await supabase
    .from('votes')
    .select('start_minute')
    .eq('group_id', groupId);

  if (error) {
    return errorResponse(`votes 조회 실패: ${error.message}`, 500);
  }

  const slots = aggregateVotes((data ?? []) as VoteRow[]);

  try {
    await broadcastHeatmap(supabase, groupId, slots);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`broadcast 실패: ${message}`, 500);
  }

  return jsonResponse({ ok: true, slot_count: slots.length });
}

// Deno test에서 import 시 serve() 부수효과 회피
if (import.meta.main) {
  serve(handler);
}

// 외부에서 직접 호출 (e.g. dispatcher) 가능하도록 export
export { handler };
