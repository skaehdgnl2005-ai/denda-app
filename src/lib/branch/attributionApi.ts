// D28 자체 deferred deep link — RN 측 attribution_resolve Edge Function wrapper.
//
// 앱 첫 실행/로그인 직후 호출:
//   - fingerprint: server 측 IP+UA hash로 최근 24시간 클릭 row 매칭
//   - invite_code: 사용자가 입력한 4자리 코드로 group 직접 매칭
// 매칭 성공 시 server가 group_members INSERT + group_guests UPDATE까지 처리.

import type { SupabaseClient } from '@supabase/supabase-js';

export type ResolveArgs = { mode: 'fingerprint' } | { mode: 'invite_code'; code: string };

export type ResolveResult =
  | { matched: false }
  | { matched: true; groupId: string; guestToken: string | null };

interface ResolveResponseRaw {
  matched?: boolean;
  group_id?: string;
  guest_token?: string | null;
}

export async function resolveAttribution(
  supabase: SupabaseClient,
  args: ResolveArgs,
): Promise<ResolveResult> {
  const body =
    args.mode === 'invite_code'
      ? { mode: 'invite_code', code: args.code }
      : { mode: 'fingerprint' };

  const { data, error } = await supabase.functions.invoke('attribution_resolve', {
    body,
  });

  if (error) {
    const msg = typeof error.message === 'string' ? error.message : '';
    if (/4자리 숫자/.test(msg) || /invite_code/i.test(msg)) {
      throw new Error('초대 코드는 4자리 숫자여야 해요.');
    }
    throw new Error('모임 합류에 실패했어요. 잠시 후 다시 시도해주세요.');
  }

  const res = (data ?? {}) as ResolveResponseRaw;
  if (!res.matched || !res.group_id) {
    return { matched: false };
  }
  return {
    matched: true,
    groupId: res.group_id,
    guestToken: res.guest_token ?? null,
  };
}
