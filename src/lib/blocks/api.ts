// S07-block-supabase — block_user RPC wrapper.
// RPC는 0008_block_user_rpc.sql: blocks INSERT (ON CONFLICT DO NOTHING) +
//   friendships/friend_requests 양방향 cascade DELETE를 atomic transaction으로 처리.
// SECURITY DEFINER + auth.uid()로 blocker_id 자동 설정 (클라이언트는 p_target_id만 전달).

import { supabase } from '@/lib/supabase/client';

export async function blockUser(targetUserId: string): Promise<void> {
  const targetId = targetUserId.trim();
  if (!targetId) {
    throw new Error('차단 대상이 필요해요.');
  }

  const { error } = await supabase.rpc('block_user', { p_target_id: targetId });

  if (error) {
    if (/cannot block self/i.test(error.message)) {
      throw new Error('자기 자신은 차단할 수 없어요.');
    }
    throw new Error('차단하지 못했어요. 잠시 후 다시 시도해주세요.');
  }
}
