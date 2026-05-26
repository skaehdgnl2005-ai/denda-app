// S05-screen-confirm — 모임 화면 데이터 fetch.
//
// groups + group_members를 한 묶음으로 조회한다. RLS:
//   - groups SELECT: 본인이 host_id이거나 group_members에 포함된 경우만 (0002:209)
//   - group_members SELECT: 본인이 같은 모임 멤버인 경우만 (0002:236)
// 멤버가 아닌 사용자는 자연 차단된다 (조회 시 0 rows).
//
// confirmed_* 컬럼은 TIMESTAMPTZ (D13) — KST 변환은 표시 시점에서 luxon으로.

import { supabase } from '@/lib/supabase/client';

export interface GroupForConfirm {
  id: string;
  hostId: string;
  name: string;
  dates: string[]; // ISO date strings, groups.dates DATE[]
  memberCount: number;
  confirmedAt: string | null;
  confirmedStartAt: string | null; // UTC ISO
  confirmedEndAt: string | null; // UTC ISO
  confirmedPlaceId: string | null;
}

interface GroupRow {
  id: string;
  host_id: string;
  name: string;
  dates: string[];
  confirmed_at: string | null;
  confirmed_start_at: string | null;
  confirmed_end_at: string | null;
  confirmed_place_id: string | null;
}

interface MemberRow {
  user_id: string;
}

export async function fetchGroupForConfirm(groupId: string): Promise<GroupForConfirm> {
  const { data: groupRow, error: groupErr } = await supabase
    .from('groups')
    .select(
      'id, host_id, name, dates, confirmed_at, confirmed_start_at, confirmed_end_at, confirmed_place_id',
    )
    .eq('id', groupId)
    .single();

  if (groupErr) {
    throw new Error('모임을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (!groupRow) {
    throw new Error('모임을 찾을 수 없어요.');
  }

  const row = groupRow as GroupRow;

  const { data: members, error: membersErr } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  if (membersErr) {
    throw new Error('모임 멤버를 불러오지 못했어요.');
  }

  const memberRows = (members ?? []) as MemberRow[];

  return {
    id: row.id,
    hostId: row.host_id,
    name: row.name,
    dates: row.dates,
    memberCount: memberRows.length,
    confirmedAt: row.confirmed_at,
    confirmedStartAt: row.confirmed_start_at,
    confirmedEndAt: row.confirmed_end_at,
    confirmedPlaceId: row.confirmed_place_id,
  };
}
