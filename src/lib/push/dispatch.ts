// S23: client push dispatch wrapper — notify_publish Edge에 type-safe POST.
//
// D33 단일 dispatcher pattern. 호출자(friends/api.ts, invitations.ts)는 supabase
// INSERT/RPC 호출 직후 dispatch를 silent best-effort 호출. push 실패가 UX 차단 X.
// 서버 측 routing 책임은 notify_publish/index.ts(handler register + dispatch.dispatch).

import { supabase } from '@/lib/supabase/client';

export type PushDispatchEvent =
  | { type: 'friend_requested'; fromUserId: string; toUserId: string }
  | { type: 'friend_accepted'; fromUserId: string; toUserId: string }
  | {
      type: 'group_invited';
      groupId: string;
      inviterId: string;
      inviteeId: string;
    };

type PublishBody =
  | { type: 'friend_requested'; from_user_id: string; to_user_id: string }
  | { type: 'friend_accepted'; from_user_id: string; to_user_id: string }
  | {
      type: 'group_invited';
      group_id: string;
      inviter_id: string;
      invitee_id: string;
    };

export function eventToPublishBody(event: PushDispatchEvent): PublishBody {
  switch (event.type) {
    case 'friend_requested':
    case 'friend_accepted':
      return {
        type: event.type,
        from_user_id: event.fromUserId,
        to_user_id: event.toUserId,
      };
    case 'group_invited':
      return {
        type: event.type,
        group_id: event.groupId,
        inviter_id: event.inviterId,
        invitee_id: event.inviteeId,
      };
  }
}

/**
 * Push 알림 발송 — silent best-effort.
 * - network/Edge 에러는 모두 swallow (호출자 UX 차단 X)
 * - notify_publish Edge가 dispatcher.dispatch로 type별 notify_f{1,2,3} 호출
 */
export async function dispatch(event: PushDispatchEvent): Promise<void> {
  try {
    await supabase.functions.invoke('notify_publish', {
      body: eventToPublishBody(event),
    });
  } catch {
    // silent — best-effort
  }
}
