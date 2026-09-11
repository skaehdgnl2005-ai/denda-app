// S15-mapmode-logic — confirmed groups + places JOIN fetcher.
//
// RLS groups_select_member_or_host(0002:209)가 host·member 모임만 자연 반환 → userId 인자 불필요.
// 좌표는 places JOIN으로 lat/lng 동반 (places SELECT은 public — 0002 places_select_all).
// confirmed_at·confirmed_start_at·confirmed_place_id 모두 NOT NULL인 행만 schedule mode에 표시.

import { supabase } from '@/lib/supabase/client';

import type { ConfirmedGroupScheduleInput } from './scheduleMapPoint';

interface JoinRow {
  id: string;
  name: string;
  confirmed_start_at: string | null;
  confirmed_place_id: string | null;
  // PostgREST FK JOIN은 단일 객체 or 배열. places.id FK이므로 단일 객체 형태.
  places: { id: string; name: string; lat: number; lng: number } | null;
}

export async function fetchConfirmedGroupSchedules(): Promise<ConfirmedGroupScheduleInput[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, confirmed_start_at, confirmed_place_id, places(id, name, lat, lng)')
    .not('confirmed_at', 'is', null)
    .not('confirmed_start_at', 'is', null)
    .not('confirmed_place_id', 'is', null)
    .order('confirmed_start_at', { ascending: true });

  if (error) {
    throw new Error('모임 일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  // PostgREST 자동 추론은 FK 관계를 배열로 잡지만 places FK는 단일 객체 — runtime 검증 후 unwrap.
  const rows = (data ?? []) as unknown as JoinRow[];

  const out: ConfirmedGroupScheduleInput[] = [];
  for (const r of rows) {
    if (r.places === null || r.confirmed_start_at === null) continue;
    out.push({
      groupId: r.id,
      groupName: r.name,
      placeId: r.places.id,
      placeName: r.places.name,
      lat: r.places.lat,
      lng: r.places.lng,
      confirmedStartAt: r.confirmed_start_at,
    });
  }
  return out;
}
