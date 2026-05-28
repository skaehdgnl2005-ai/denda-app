// S19 — 내 모임 목록. RLS groups_select_member_or_host(0002)가
// host 또는 멤버인 모임만 자연 반환 → userId 인자 불필요. 미확정(confirmed_at NULL) 먼저.
import { supabase } from '@/lib/supabase/client';

export interface MyGroupSummary {
  id: string;
  name: string;
  dates: string[]; // ISO yyyy-MM-dd
  confirmedAt: string | null; // UTC ISO
}

interface MyGroupRow {
  id: string;
  name: string;
  dates: string[];
  confirmed_at: string | null;
}

export async function fetchMyGroups(): Promise<MyGroupSummary[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, dates, confirmed_at')
    .order('confirmed_at', { ascending: true, nullsFirst: true });

  if (error) {
    throw new Error('모임 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  const rows = (data ?? []) as MyGroupRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dates: r.dates,
    confirmedAt: r.confirmed_at,
  }));
}
