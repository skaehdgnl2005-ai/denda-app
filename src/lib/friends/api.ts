// S21 — friends/api.ts supabase 전면 교체 (mock array → 실 DB)
// RLS: friendships/friend_requests/users 모두 is_blocked(D16) 통과 (0001/0002/0007)
// acceptRequest는 RPC accept_friend_request (0019) — 양방향 friendships INSERT를 SECURITY DEFINER로 위임
// blockUser는 blocks/api::blockUser (0008 block_user RPC) 그대로 위임
//
// S23 — sendRequest/acceptRequest 성공 후 dispatch(F1/F2) 호출 (D33 단일 dispatcher)
//   acceptRequest는 fromUserId optional — UI(requests.tsx)가 listIncoming 데이터의 sender_id 전달.

import { supabase } from '@/lib/supabase/client';
import { blockUser as supabaseBlockUser } from '@/lib/blocks/api';
import { dispatch } from '@/lib/push/dispatch';

export interface FriendUser {
  id: string;
  nickname: string;
  avatar_url?: string;
  recent_meetings_count?: number; // schema 미설치 — Phase 3 deferred, 항상 undefined
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender?: FriendUser;
  receiver?: FriendUser;
  created_at: string; // UTC ISO
}

interface UserRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

interface FriendshipJoinRow {
  friend_id: string;
  friend: UserRow | UserRow[] | null;
}

interface FriendRequestRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
  sender?: UserRow | UserRow[] | null;
  receiver?: UserRow | UserRow[] | null;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('로그인이 필요해요.');
  }
  return data.user.id;
}

function pickJoinRow<T>(row: T | T[] | null | undefined): T | null {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

function mapUserRow(row: UserRow | null): FriendUser | null {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    avatar_url: row.avatar_url ?? undefined,
  };
}

export const friendsApi = {
  list: async (): Promise<FriendUser[]> => {
    const me = await requireUserId();
    const { data, error } = await supabase
      .from('friendships')
      .select('friend_id, friend:friend_id(id, nickname, avatar_url)')
      .eq('user_id', me);

    if (error) {
      throw new Error('친구 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    const rows = (data ?? []) as FriendshipJoinRow[];
    const friends: FriendUser[] = [];
    for (const row of rows) {
      const friend = mapUserRow(pickJoinRow(row.friend));
      if (friend) friends.push(friend);
    }
    return friends;
  },

  search: async (query: string): Promise<FriendUser[]> => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const me = await requireUserId();
    const { data, error } = await supabase
      .from('users')
      .select('id, nickname, avatar_url')
      .ilike('nickname', `%${trimmed}%`)
      .neq('id', me)
      .limit(20);

    if (error) {
      throw new Error('검색하지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    const rows = (data ?? []) as UserRow[];
    return rows.map((r) => ({
      id: r.id,
      nickname: r.nickname,
      avatar_url: r.avatar_url ?? undefined,
    }));
  },

  sendRequest: async (userId: string): Promise<void> => {
    const target = userId.trim();
    if (!target) {
      throw new Error('요청 대상이 필요해요.');
    }
    const me = await requireUserId();

    const { error } = await supabase
      .from('friend_requests')
      .insert({ from_user_id: me, to_user_id: target });

    if (error) {
      if (error.code === '23505' || /duplicate key/i.test(error.message ?? '')) {
        throw new Error('이미 요청을 보냈어요.');
      }
      throw new Error('요청을 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    // S23 — F1 publish (silent best-effort; push 실패가 요청 UX 차단 X)
    await dispatch({ type: 'friend_requested', fromUserId: me, toUserId: target });
  },

  listIncomingRequests: async (): Promise<FriendRequest[]> => {
    const me = await requireUserId();
    const { data, error } = await supabase
      .from('friend_requests')
      .select(
        'id, from_user_id, to_user_id, created_at, sender:from_user_id(id, nickname, avatar_url)',
      )
      .eq('to_user_id', me)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('요청을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    const rows = (data ?? []) as FriendRequestRow[];
    return rows.map((r) => ({
      id: r.id,
      sender_id: r.from_user_id,
      receiver_id: r.to_user_id,
      sender: mapUserRow(pickJoinRow(r.sender)) ?? undefined,
      created_at: r.created_at,
    }));
  },

  listOutgoingRequests: async (): Promise<FriendRequest[]> => {
    const me = await requireUserId();
    const { data, error } = await supabase
      .from('friend_requests')
      .select(
        'id, from_user_id, to_user_id, created_at, receiver:to_user_id(id, nickname, avatar_url)',
      )
      .eq('from_user_id', me)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('요청을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    const rows = (data ?? []) as FriendRequestRow[];
    return rows.map((r) => ({
      id: r.id,
      sender_id: r.from_user_id,
      receiver_id: r.to_user_id,
      receiver: mapUserRow(pickJoinRow(r.receiver)) ?? undefined,
      created_at: r.created_at,
    }));
  },

  acceptRequest: async (requestId: string, fromUserId?: string): Promise<void> => {
    const id = requestId.trim();
    if (!id) {
      throw new Error('요청을 선택해주세요.');
    }

    const { error } = await supabase.rpc('accept_friend_request', { p_request_id: id });

    if (error) {
      const msg = error.message ?? '';
      if (/friend_request_not_found/i.test(msg)) {
        throw new Error('없는 요청이에요.');
      }
      if (/request_not_pending/i.test(msg)) {
        throw new Error('이미 처리된 요청이에요.');
      }
      if (/not_recipient/i.test(msg) || /blocked/i.test(msg)) {
        throw new Error('수락하지 못했어요. 잠시 후 다시 시도해주세요.');
      }
      throw new Error('수락하지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    // S23 — F2 publish: recipient=fromUserId(원래 요청 보낸 사람), accepter=me.
    //   fromUserId가 없으면 dispatch skip (legacy 호출자 호환).
    if (fromUserId && fromUserId.trim()) {
      const me = await requireUserId();
      await dispatch({
        type: 'friend_accepted',
        fromUserId: fromUserId.trim(),
        toUserId: me,
      });
    }
  },

  rejectRequest: async (requestId: string): Promise<void> => {
    const id = requestId.trim();
    if (!id) {
      throw new Error('요청을 선택해주세요.');
    }
    const me = await requireUserId();

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', id)
      .eq('to_user_id', me)
      .eq('status', 'pending');

    if (error) {
      throw new Error('거절하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  },

  cancelRequest: async (requestId: string): Promise<void> => {
    const id = requestId.trim();
    if (!id) {
      throw new Error('요청을 선택해주세요.');
    }
    const me = await requireUserId();

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('from_user_id', me)
      .eq('status', 'pending');

    if (error) {
      throw new Error('취소하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  },

  removeFriend: async (friendId: string): Promise<void> => {
    const target = friendId.trim();
    if (!target) {
      throw new Error('대상이 필요해요.');
    }
    const me = await requireUserId();

    // 양방향 두 row DELETE (대칭). RLS friendships_delete_self가 양측 본인 row 통과 허용.
    // atomic 보장은 RPC가 더 깨끗하나 — 한쪽만 남아도 list query는 self side로만 fetch라 UX 일관성 유지.
    const r1 = await supabase
      .from('friendships')
      .delete()
      .eq('user_id', me)
      .eq('friend_id', target);

    if (r1.error) {
      throw new Error('삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    const r2 = await supabase
      .from('friendships')
      .delete()
      .eq('user_id', target)
      .eq('friend_id', me);

    if (r2.error) {
      throw new Error('삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  },

  blockUser: async (userId: string): Promise<void> => {
    await supabaseBlockUser(userId);
  },

  // 시그너처 호환 no-op — supabase 시대엔 의미 없음. screen test 호출 안전.
  __resetMocks: (): void => {
    // intentional no-op
  },
};
