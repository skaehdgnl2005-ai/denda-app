// S19 — 내 모임 목록. RLS groups_select_member_or_host(0002)가
// host 또는 멤버인 모임만 자연 반환 → userId 인자 불필요. 미확정(confirmed_at NULL) 먼저.
//
// S25 — 홈 캘린더가 확정 시각·장소명까지 필요로 해 select를 확장했다.
// places는 confirmed_place_id FK JOIN (places SELECT은 public — 0002 places_select_all).
import { supabase } from '@/lib/supabase/client';

export interface MyGroupSummary {
  id: string;
  name: string;
  dates: string[]; // ISO yyyy-MM-dd
  confirmedAt: string | null; // UTC ISO
  /** 호스트가 확정한 시작 시각 (UTC ISO). 미확정이면 null */
  confirmedStartAt: string | null;
  /** 확정한 종료 시각 (UTC ISO). 0001 CHECK상 start와 항상 함께 존재 */
  confirmedEndAt: string | null;
  /** 확정된 장소명. 장소 미확정이면 null */
  placeName: string | null;
}

interface MyGroupRow {
  id: string;
  name: string;
  dates: string[] | null;
  confirmed_at: string | null;
  confirmed_start_at: string | null;
  confirmed_end_at: string | null;
  // PostgREST 관계 추론에 따라 단일 객체 또는 배열로 온다 — 양쪽 방어.
  places: { name: string } | { name: string }[] | null;
}

function unwrapPlaceName(places: MyGroupRow['places']): string | null {
  if (places === null || places === undefined) return null;
  const place = Array.isArray(places) ? places[0] : places;
  return typeof place?.name === 'string' ? place.name : null;
}

export async function fetchMyGroups(): Promise<MyGroupSummary[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, dates, confirmed_at, confirmed_start_at, confirmed_end_at, places(name)')
    .order('confirmed_at', { ascending: true, nullsFirst: true });

  if (error) {
    throw new Error('모임 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  const rows = (data ?? []) as unknown as MyGroupRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dates: r.dates ?? [],
    confirmedAt: r.confirmed_at,
    confirmedStartAt: r.confirmed_start_at,
    confirmedEndAt: r.confirmed_end_at,
    placeName: unwrapPlaceName(r.places),
  }));
}
