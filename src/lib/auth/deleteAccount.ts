// deleteAccount — 회원 탈퇴 클라이언트 wrapper (Edge Function `delete_account`, W1-14).
//
// 서버가 service_role로 auth.admin.deleteUser 실행 → public.users FK ON DELETE CASCADE로
// 전 연관 데이터를 삭제한다. user_id는 서버가 JWT에서 도출하므로 본문을 보내지 않는다(IDOR 차단).
// 실패는 항상 큐레이션된 한국어 메시지로 throw — raw 서버 메시지를 사용자에게 노출하지 않는다.

import { supabase } from '@/lib/supabase/client';

interface DeleteAccountResponse {
  ok: true;
}

const FAIL_MESSAGE = '회원 탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.';

export async function deleteAccount(): Promise<void> {
  let data: DeleteAccountResponse | null = null;
  let error: unknown = null;

  try {
    const res = await supabase.functions.invoke<DeleteAccountResponse>('delete_account');
    data = res.data;
    error = res.error;
  } catch {
    // 네트워크 등 invoke 자체 reject — raw 노출 없이 일반 실패로.
    throw new Error(FAIL_MESSAGE);
  }

  // supabase-js는 non-2xx를 error로 반환하되 error.message가 고정 문자열("Edge Function returned
  // a non-2xx status code")이고 서버 본문은 error.context에 들어간다 → 본문을 신뢰하지 않는다.
  // 실패 사유와 무관하게 큐레이션된 한국어 하나로 표출(raw 비노출·재시도 유도).
  if (error || !data?.ok) {
    throw new Error(FAIL_MESSAGE);
  }
}
