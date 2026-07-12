// S-MAP M5 (D41) — 모임 출발지 서버 CRUD. RLS(0023)가 모임 멤버 조회·본인 쓰기를 강제하므로
// 클라는 자연 안전. nickname은 users FK join — 정책상 못 읽으면 '멤버' 폴백.
//
// D13: updated_at은 luxon UTC ISO (new Date() 금지). D18: 좌표는 normalizeWgs84 통과 후 저장.

import { DateTime } from 'luxon';

import { normalizeWgs84, type Wgs84Coord } from '@/lib/coords/normalize';
import { supabase } from '@/lib/supabase/client';

import type { OriginPoint } from './midpoint';

const FETCH_FAILED = '출발지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
const SAVE_FAILED = '출발지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.';
const DELETE_FAILED = '출발지를 삭제하지 못했어요. 잠시 후 다시 시도해주세요.';

export interface GroupOrigin {
  userId: string;
  nickname: string;
  label: string;
  coord: Wgs84Coord;
}

interface OriginRow {
  user_id: string;
  label: string;
  lat: number;
  lng: number;
  users: { nickname: string } | null;
}

/** 모임의 등록된 출발지 전부 (RLS: 같은 모임 멤버만). created_at 오름차순. */
export async function fetchGroupOrigins(groupId: string): Promise<GroupOrigin[]> {
  const { data, error } = await supabase
    .from('group_origins')
    .select('user_id, label, lat, lng, users(nickname)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(FETCH_FAILED);
  }
  const rows = (data ?? []) as unknown as OriginRow[];
  return rows.map((r) => ({
    userId: r.user_id,
    nickname: r.users?.nickname ?? '멤버',
    label: r.label,
    coord: normalizeWgs84(r.lat, r.lng),
  }));
}

/** 내 출발지 등록/수정 (1인 1출발지 upsert). RLS가 본인 행만 허용. */
export async function upsertMyOrigin(
  groupId: string,
  userId: string,
  origin: OriginPoint,
): Promise<void> {
  const coord = normalizeWgs84(origin.coord.lat, origin.coord.lng);
  const { error } = await supabase.from('group_origins').upsert(
    {
      group_id: groupId,
      user_id: userId,
      label: origin.label,
      lat: coord.lat,
      lng: coord.lng,
      updated_at: DateTime.utc().toISO(),
    },
    { onConflict: 'group_id,user_id' },
  );
  if (error) {
    throw new Error(SAVE_FAILED);
  }
}

/** 내 출발지 삭제. */
export async function deleteMyOrigin(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_origins')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) {
    throw new Error(DELETE_FAILED);
  }
}
