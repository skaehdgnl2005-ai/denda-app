// S18 — 모임 생성 클라이언트 wrapper. 서버 create_group RPC(0018)가
// groups + 호스트 group_members INSERT를 원자적 처리. host_id는 서버 auth.uid().
import { supabase } from '@/lib/supabase/client';

export interface CreateGroupInput {
  name: string;
  dates: string[]; // ISO yyyy-MM-dd (KST)
}

export async function createGroup(input: CreateGroupInput): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('모임 이름을 입력해주세요.');
  }
  if (!input.dates || input.dates.length === 0) {
    throw new Error('후보 날짜를 한 개 이상 선택해주세요.');
  }

  const { data, error } = await supabase.rpc('create_group', {
    p_name: name,
    p_dates: input.dates,
  });

  if (error) {
    if (/authenticat/i.test(error.message ?? '')) {
      throw new Error('로그인이 필요해요.');
    }
    throw new Error('모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (!data || typeof data !== 'string') {
    throw new Error('모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  return { id: data };
}
