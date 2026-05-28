// S20 — 모임 장소 확정. groups.confirmed_place_id UPDATE = Gate #1 신호.
//
// RLS groups_update_host (0002:145) — host_id=auth.uid() 인 행만 UPDATE 가능.
//   비호스트가 호출하면 RLS 가 *조용히* 0 rows 반환 (에러 X). D17 idempotency 패턴
//   미러로 .select() 결과 길이를 확인해 0 rows → "호스트만" 한국어 throw 로 surface.
//
// 시점 결정 (spec 진입 closure, 2026-05-28): "확인 단계 거쳐 확정" — UI(place-search.tsx)
// 가 Alert 로 확인을 받은 후에만 호출. 본 lib 은 atomic UPDATE 만 담당 (확인 책임 X).

import { supabase } from '@/lib/supabase/client';

const NON_HOST_MESSAGE = '호스트만 장소를 정할 수 있어요.';
const GENERIC_FAIL_MESSAGE = '장소를 확정하지 못했어요. 잠시 후 다시 시도해주세요.';

export async function setConfirmedPlace(groupId: string, placeId: string): Promise<void> {
  if (!groupId) {
    throw new Error('모임 ID가 없어요.');
  }
  if (!placeId) {
    throw new Error('장소 ID가 없어요.');
  }

  const { data, error } = await supabase
    .from('groups')
    .update({ confirmed_place_id: placeId })
    .eq('id', groupId)
    .select('id');

  if (error) {
    throw new Error(GENERIC_FAIL_MESSAGE);
  }

  // RLS deny = 0 rows (silent). 명시적으로 surface.
  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) {
    throw new Error(NON_HOST_MESSAGE);
  }
}
