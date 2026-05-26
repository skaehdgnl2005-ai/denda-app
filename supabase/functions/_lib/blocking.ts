// blocking.ts — D16 is_blocked RPC wrapper for Edge Functions
//
// 사용처: service_role client는 RLS를 bypass하므로, Edge Function이
// is_blocked helper(0001:94)를 명시적으로 호출해야 할 때 사용.
// 예: friend_request 발송 전 양방향 차단 사전 체크, F1~F5 push fan-out 전 차단 필터.
//
// 결정 본문: docs/DECISIONS.md#d16
//
// SQL helper: public.is_blocked(viewer_id UUID, target_id UUID) RETURNS BOOLEAN
// 양방향 차단을 모두 체크 (A→B 차단 OR B→A 차단 → A는 B에게 invisible).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function isBlocked(
  client: SupabaseClient,
  viewerId: string,
  targetId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('is_blocked', {
    viewer_id: viewerId,
    target_id: targetId,
  });
  if (error) throw error;
  return data === true;
}
