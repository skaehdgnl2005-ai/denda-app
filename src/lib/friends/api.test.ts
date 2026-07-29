// S21 — friends/api.ts supabase 전면 교체 검증
// 시그너처 호환: list/search/sendRequest/listIncomingRequests/listOutgoingRequests/
//   acceptRequest/rejectRequest/cancelRequest/removeFriend/blockUser
// auth.uid()는 supabase.auth.getUser() 호출로 추출.

import { friendsApi } from './api';
import { supabase } from '@/lib/supabase/client';
import { blockUser as supabaseBlockUser } from '@/lib/blocks/api';
import { dispatch as pushDispatch } from '@/lib/push/dispatch';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));
jest.mock('@/lib/blocks/api', () => ({
  blockUser: jest.fn(),
}));
jest.mock('@/lib/push/dispatch', () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockSupabaseBlockUser = supabaseBlockUser as jest.Mock;
const mockPushDispatch = pushDispatch as jest.Mock;

const ME = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockGetUser.mockReset();
  mockSupabaseBlockUser.mockReset();
  mockPushDispatch.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });
  mockPushDispatch.mockResolvedValue(undefined);
});

describe('friendsApi.list', () => {
  test('자기 user_id의 friendships row만 받아 friend 정보 매핑', async () => {
    const eq = jest.fn().mockResolvedValue({
      data: [
        {
          friend_id: 'u2',
          friend: { id: 'u2', nickname: '홍길동', avatar_url: 'a2' },
        },
        {
          friend_id: 'u3',
          friend: { id: 'u3', nickname: '김영희', avatar_url: null },
        },
      ],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const list = await friendsApi.list();

    expect(mockFrom).toHaveBeenCalledWith('friendships');
    expect(select).toHaveBeenCalledWith(
      'friend_id, friend:friend_id(id, nickname, avatar_url:profile_image_url)',
    );
    expect(eq).toHaveBeenCalledWith('user_id', ME);
    expect(list).toEqual([
      { id: 'u2', nickname: '홍길동', avatar_url: 'a2' },
      { id: 'u3', nickname: '김영희', avatar_url: undefined },
    ]);
  });

  test('빈 결과 → 빈 배열', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    expect(await friendsApi.list()).toEqual([]);
  });

  test('에러 → 한국어 throw', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'rls' } }),
      }),
    });
    await expect(friendsApi.list()).rejects.toThrow(
      '친구 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('비인증 → 한국어 throw, from 미호출', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(friendsApi.list()).rejects.toThrow(/로그인/);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('friendsApi.search', () => {
  test('빈 쿼리는 RPC/from 호출 없이 빈 배열', async () => {
    expect(await friendsApi.search('')).toEqual([]);
    expect(await friendsApi.search('   ')).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('닉네임 ILIKE + self 제외 + 결과 매핑', async () => {
    const limit = jest.fn().mockResolvedValue({
      data: [
        { id: 'u10', nickname: '김하늘', avatar_url: null },
        { id: 'u11', nickname: '이태양김', avatar_url: 'a11' },
      ],
      error: null,
    });
    const neq = jest.fn().mockReturnValue({ limit });
    const ilike = jest.fn().mockReturnValue({ neq });
    const select = jest.fn().mockReturnValue({ ilike });
    mockFrom.mockReturnValue({ select });

    const res = await friendsApi.search('김');

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(select).toHaveBeenCalledWith('id, nickname, avatar_url:profile_image_url');
    expect(ilike).toHaveBeenCalledWith('nickname', '%김%');
    expect(neq).toHaveBeenCalledWith('id', ME);
    expect(limit).toHaveBeenCalledWith(20);
    expect(res).toEqual([
      { id: 'u10', nickname: '김하늘', avatar_url: undefined },
      { id: 'u11', nickname: '이태양김', avatar_url: 'a11' },
    ]);
  });

  test('에러 → 한국어 throw', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          neq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } }),
          }),
        }),
      }),
    });
    await expect(friendsApi.search('김')).rejects.toThrow(/검색하지 못했어요/);
  });
});

describe('friendsApi.sendRequest', () => {
  test('빈 userId 사전 throw', async () => {
    await expect(friendsApi.sendRequest('')).rejects.toThrow(/대상/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('정상 INSERT — from_user_id=me, to_user_id=target', async () => {
    const insert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ insert });

    await friendsApi.sendRequest('u10');

    expect(mockFrom).toHaveBeenCalledWith('friend_requests');
    expect(insert).toHaveBeenCalledWith({ from_user_id: ME, to_user_id: 'u10' });
  });

  test('UNIQUE pending index 충돌 → "이미 요청" 한국어 throw', async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      }),
    });
    await expect(friendsApi.sendRequest('u10')).rejects.toThrow(/이미 요청/);
  });

  test('일반 에러 → 한국어 throw', async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: null, error: { message: 'rls' } }),
    });
    await expect(friendsApi.sendRequest('u10')).rejects.toThrow(/요청을 보내지 못했어요/);
  });

  // S23 — F1 publish wire-up
  test('S23: INSERT 성공 → dispatch(friend_requested) silent best-effort', async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    await friendsApi.sendRequest('u10');
    expect(mockPushDispatch).toHaveBeenCalledTimes(1);
    expect(mockPushDispatch).toHaveBeenCalledWith({
      type: 'friend_requested',
      fromUserId: ME,
      toUserId: 'u10',
    });
  });

  test('S23: INSERT 에러 → dispatch 호출 안 됨', async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: null, error: { message: 'rls' } }),
    });
    await expect(friendsApi.sendRequest('u10')).rejects.toThrow();
    expect(mockPushDispatch).not.toHaveBeenCalled();
  });
});

describe('friendsApi.listIncomingRequests', () => {
  test('to_user_id=me + status=pending + 매핑', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'req-a',
          from_user_id: 'u5',
          to_user_id: ME,
          created_at: '2026-05-23T10:00:00Z',
          sender: { id: 'u5', nickname: '박민수', avatar_url: null },
        },
      ],
      error: null,
    });
    const eqStatus = jest.fn().mockReturnValue({ order });
    const eqTo = jest.fn().mockReturnValue({ eq: eqStatus });
    const select = jest.fn().mockReturnValue({ eq: eqTo });
    mockFrom.mockReturnValue({ select });

    const res = await friendsApi.listIncomingRequests();

    expect(mockFrom).toHaveBeenCalledWith('friend_requests');
    expect(select).toHaveBeenCalledWith(
      'id, from_user_id, to_user_id, created_at, sender:from_user_id(id, nickname, avatar_url:profile_image_url)',
    );
    expect(eqTo).toHaveBeenCalledWith('to_user_id', ME);
    expect(eqStatus).toHaveBeenCalledWith('status', 'pending');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(res).toEqual([
      {
        id: 'req-a',
        sender_id: 'u5',
        receiver_id: ME,
        sender: { id: 'u5', nickname: '박민수', avatar_url: undefined },
        created_at: '2026-05-23T10:00:00Z',
      },
    ]);
  });

  test('에러 → 한국어 throw', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } }),
          }),
        }),
      }),
    });
    await expect(friendsApi.listIncomingRequests()).rejects.toThrow(/불러오지 못했어요/);
  });
});

describe('friendsApi.listOutgoingRequests', () => {
  test('from_user_id=me + status=pending + receiver 매핑', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'req-out',
          from_user_id: ME,
          to_user_id: 'u7',
          created_at: '2026-05-23T09:15:00Z',
          receiver: { id: 'u7', nickname: '정다은', avatar_url: null },
        },
      ],
      error: null,
    });
    const eqStatus = jest.fn().mockReturnValue({ order });
    const eqFrom = jest.fn().mockReturnValue({ eq: eqStatus });
    const select = jest.fn().mockReturnValue({ eq: eqFrom });
    mockFrom.mockReturnValue({ select });

    const res = await friendsApi.listOutgoingRequests();

    expect(select).toHaveBeenCalledWith(
      'id, from_user_id, to_user_id, created_at, receiver:to_user_id(id, nickname, avatar_url:profile_image_url)',
    );
    expect(eqFrom).toHaveBeenCalledWith('from_user_id', ME);
    expect(eqStatus).toHaveBeenCalledWith('status', 'pending');
    expect(res).toEqual([
      {
        id: 'req-out',
        sender_id: ME,
        receiver_id: 'u7',
        receiver: { id: 'u7', nickname: '정다은', avatar_url: undefined },
        created_at: '2026-05-23T09:15:00Z',
      },
    ]);
  });
});

describe('friendsApi.acceptRequest', () => {
  test('RPC accept_friend_request 호출', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await friendsApi.acceptRequest('req-1');

    expect(mockRpc).toHaveBeenCalledWith('accept_friend_request', { p_request_id: 'req-1' });
  });

  test('빈 requestId 사전 throw', async () => {
    await expect(friendsApi.acceptRequest('')).rejects.toThrow(/요청/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('RPC error friend_request_not_found → 한국어', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'friend_request_not_found' } });
    await expect(friendsApi.acceptRequest('req-x')).rejects.toThrow(/없는 요청/);
  });

  test('RPC error request_not_pending → 한국어', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'request_not_pending' } });
    await expect(friendsApi.acceptRequest('req-x')).rejects.toThrow(/이미 처리/);
  });

  test('RPC 일반 error → 한국어', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rls' } });
    await expect(friendsApi.acceptRequest('req-x')).rejects.toThrow(/수락하지 못했어요/);
  });

  // S23 — F2 publish wire-up (fromUserId 전달 시)
  test('S23: RPC 성공 + fromUserId 전달 → dispatch(friend_accepted)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await friendsApi.acceptRequest('req-1', 'u-from');

    expect(mockPushDispatch).toHaveBeenCalledTimes(1);
    expect(mockPushDispatch).toHaveBeenCalledWith({
      type: 'friend_accepted',
      fromUserId: 'u-from',
      toUserId: ME,
    });
  });

  test('S23: fromUserId 없으면 dispatch skip (legacy 호출자 호환)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await friendsApi.acceptRequest('req-1');
    expect(mockPushDispatch).not.toHaveBeenCalled();
  });

  test('S23: 빈 fromUserId(공백) → dispatch skip', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await friendsApi.acceptRequest('req-1', '   ');
    expect(mockPushDispatch).not.toHaveBeenCalled();
  });

  test('S23: RPC 에러 → dispatch 호출 안 됨', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'request_not_pending' } });
    await expect(friendsApi.acceptRequest('req-1', 'u-from')).rejects.toThrow();
    expect(mockPushDispatch).not.toHaveBeenCalled();
  });
});

describe('friendsApi.rejectRequest', () => {
  test('to_user_id=me + pending → status=rejected UPDATE', async () => {
    const eqStatus = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqTo = jest.fn().mockReturnValue({ eq: eqStatus });
    const eqId = jest.fn().mockReturnValue({ eq: eqTo });
    const update = jest.fn().mockReturnValue({ eq: eqId });
    mockFrom.mockReturnValue({ update });

    await friendsApi.rejectRequest('req-1');

    expect(mockFrom).toHaveBeenCalledWith('friend_requests');
    expect(update).toHaveBeenCalledWith({ status: 'rejected' });
    expect(eqId).toHaveBeenCalledWith('id', 'req-1');
    expect(eqTo).toHaveBeenCalledWith('to_user_id', ME);
    expect(eqStatus).toHaveBeenCalledWith('status', 'pending');
  });

  test('빈 id 사전 throw', async () => {
    await expect(friendsApi.rejectRequest('')).rejects.toThrow(/요청/);
  });

  test('에러 → 한국어 throw', async () => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } }),
          }),
        }),
      }),
    });
    await expect(friendsApi.rejectRequest('req-1')).rejects.toThrow(/거절하지 못했어요/);
  });
});

describe('friendsApi.cancelRequest', () => {
  test('from_user_id=me + pending → status=cancelled UPDATE', async () => {
    const eqStatus = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqFrom = jest.fn().mockReturnValue({ eq: eqStatus });
    const eqId = jest.fn().mockReturnValue({ eq: eqFrom });
    const update = jest.fn().mockReturnValue({ eq: eqId });
    mockFrom.mockReturnValue({ update });

    await friendsApi.cancelRequest('req-3');

    expect(update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(eqId).toHaveBeenCalledWith('id', 'req-3');
    expect(eqFrom).toHaveBeenCalledWith('from_user_id', ME);
    expect(eqStatus).toHaveBeenCalledWith('status', 'pending');
  });

  test('에러 → 한국어 throw', async () => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } }),
          }),
        }),
      }),
    });
    await expect(friendsApi.cancelRequest('req-3')).rejects.toThrow(/취소하지 못했어요/);
  });
});

describe('friendsApi.removeFriend', () => {
  test('양방향 두 row DELETE (대칭)', async () => {
    // First call: user_id=me AND friend_id=target
    const eqFriend1 = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqUser1 = jest.fn().mockReturnValue({ eq: eqFriend1 });
    const delete1 = jest.fn().mockReturnValue({ eq: eqUser1 });
    // Second call: user_id=target AND friend_id=me
    const eqFriend2 = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqUser2 = jest.fn().mockReturnValue({ eq: eqFriend2 });
    const delete2 = jest.fn().mockReturnValue({ eq: eqUser2 });

    mockFrom.mockReturnValueOnce({ delete: delete1 }).mockReturnValueOnce({ delete: delete2 });

    await friendsApi.removeFriend('u2');

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'friendships');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'friendships');
    expect(delete1).toHaveBeenCalled();
    expect(eqUser1).toHaveBeenCalledWith('user_id', ME);
    expect(eqFriend1).toHaveBeenCalledWith('friend_id', 'u2');
    expect(delete2).toHaveBeenCalled();
    expect(eqUser2).toHaveBeenCalledWith('user_id', 'u2');
    expect(eqFriend2).toHaveBeenCalledWith('friend_id', ME);
  });

  test('첫 DELETE 에러 → 두 번째 미호출 + 한국어 throw', async () => {
    mockFrom.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } }),
        }),
      }),
    });

    await expect(friendsApi.removeFriend('u2')).rejects.toThrow(/삭제하지 못했어요/);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe('friendsApi.blockUser', () => {
  test('blocks/api::blockUser로 위임', async () => {
    mockSupabaseBlockUser.mockResolvedValue(undefined);
    await friendsApi.blockUser('u2');
    expect(mockSupabaseBlockUser).toHaveBeenCalledWith('u2');
  });

  test('RPC error는 그대로 전파', async () => {
    mockSupabaseBlockUser.mockRejectedValue(
      new Error('차단하지 못했어요. 잠시 후 다시 시도해주세요.'),
    );
    await expect(friendsApi.blockUser('u2')).rejects.toThrow(/차단하지 못했어요/);
  });
});

describe('friendsApi.__resetMocks', () => {
  test('시그너처 호환 no-op (호출 가능)', () => {
    expect(() => friendsApi.__resetMocks()).not.toThrow();
  });
});
