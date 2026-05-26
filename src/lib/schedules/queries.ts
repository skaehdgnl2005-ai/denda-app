// S03b — schedules 조회 helper. 학기 종료 만료 자동 필터.
// D13 KST 강제 — luxon으로 현재 시각 → UTC ISO 산출.

import { DateTime } from 'luxon';
import { supabase } from '@/lib/supabase/client';
import { buildActiveScheduleFilter } from './activeFilter';

const KST_ZONE = 'Asia/Seoul';

export interface ScheduleRow {
  id: string;
  user_id: string;
  source: 'manual' | 'google' | 'apple_ios' | 'everytime';
  title: string;
  start_at: string;
  end_at: string;
  recurrence_rule: string | null;
  expires_at: string | null;
  external_id: string | null;
}

function nowUtcIso(): string {
  const iso = DateTime.now().setZone(KST_ZONE).toUTC().toISO({ suppressMilliseconds: false });
  return iso ?? '';
}

export async function fetchActiveSchedules(userId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .or(buildActiveScheduleFilter(nowUtcIso()))
    .order('start_at', { ascending: true });
  if (error) throw new Error(`schedules 조회 실패: ${error.message}`);
  return (data ?? []) as ScheduleRow[];
}

export async function fetchEverytimeSchedules(userId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('source', 'everytime')
    .or(buildActiveScheduleFilter(nowUtcIso()))
    .order('start_at', { ascending: true });
  if (error) throw new Error(`schedules 조회 실패: ${error.message}`);
  return (data ?? []) as ScheduleRow[];
}
