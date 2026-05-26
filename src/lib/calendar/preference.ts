// S06-ui-first-time-modal — users.calendar_preference 조회 helper.
//
// 호출 측(app/group/[id]/index.tsx) 패턴:
//   1. confirmGroup 성공 (not alreadyConfirmed) →
//   2. fetchCalendarPreference(supabase, userId)로 현재 선택값 조회 →
//   3. null 반환 시 FirstTimeModal 노출 (NULL = 아직 결정 안 됨, migration 0011)
//   4. 'google' | 'apple_ios' | 'both' | 'none'은 이미 선택됨 → 모달 skip
//
// 본 helper는 DI 친화 — supabase client를 인자로 받음 (lib/groups/queries.ts 패턴 mirror).

import type { SupabaseClient } from '@supabase/supabase-js';

export type CalendarPreference = 'google' | 'apple_ios' | 'both' | 'none';

interface UserPreferenceRow {
  calendar_preference: CalendarPreference | null;
}

export async function fetchCalendarPreference(
  supabase: SupabaseClient,
  userId: string,
): Promise<CalendarPreference | null> {
  const { data, error } = await supabase
    .from('users')
    .select('calendar_preference')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error('캘린더 설정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  if (!data) return null;

  const row = data as UserPreferenceRow;
  return row.calendar_preference ?? null;
}
