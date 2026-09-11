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
    // Defense-in-depth: 실제 원인을 console에 남겨 adb logcat / Sentry에서 진단 가능하게.
    // 사용자 facing 한국어 메시지는 그대로 유지 (UX 일관성). 과거 원격 Supabase에 migration
    // 0016·0018 미배포로 PGRST202가 떴을 때 "잠시 후 다시 시도" 메시지만 봐서 진단이 늦었던
    // 회귀 방지.
    // eslint-disable-next-line no-console
    console.error('[createGroup] supabase.rpc 실패', {
      code: (error as { code?: string }).code,
      message: error.message,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
    });
    if (/authenticat/i.test(error.message ?? '')) {
      throw new Error('로그인이 필요해요.');
    }
    throw new Error('모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (!data || typeof data !== 'string') {
    // eslint-disable-next-line no-console
    console.error('[createGroup] RPC 응답이 예상치 못한 형식', { data });
    throw new Error('모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  return { id: data };
}
