// S22 — group_invitations 클라 API (supabase)
// 시그너처: createInvitation / listMyInvitations / acceptInvitation / rejectInvitation
// auth.uid()는 supabase.auth.getUser() 호출로 추출.

import { invitationsApi } from './invitations';
import { supabase } from '@/lib/supabase/client';
import { dispatch as pushDispatch } from '@/lib/push/dispatch';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));
jest.mock('@/lib/push/dispatch', () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockPushDispatch = pushDispatch as jest.Mock;

const ME = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockGetUser.mockReset();
  mockPushDispatch.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });
  mockPushDispatch.mockResolvedValue(undefined);
});

describe('invitationsApi.createInvitation', () => {
  test('group_invitations INSERT with inviter=me', async () => {
    const insert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ insert });

    await invitationsApi.createInvitation({ groupId: 'g1', inviteeId: 'u2' });

    expect(mockFrom).toHaveBeenCalledWith('group_invitations');
    expect(insert).toHaveBeenCalledWith({
      group_id: 'g1',
      inviter_id: ME,
      invitee_id: 'u2',
    });
  });

  test('빈 groupId/inviteeId → 한국어 throw + from 미호출', async () => {
    await expect(invitationsApi.createInvitation({ groupId: '', inviteeId: 'u2' })).rejects.toThrow(
      /필요해요/,
    );
    await expect(
      invitationsApi.createInvitation({ groupId: 'g1', inviteeId: '   ' }),
    ).rejects.toThrow(/필요해요/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('UNIQUE pending 충돌(23505) → "이미 초대" throw', async () => {
    const insert = jest
      .fn()
      .mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });
    mockFrom.mockReturnValue({ insert });
    await expect(
      invitationsApi.createInvitation({ groupId: 'g1', inviteeId: 'u2' }),
    ).rejects.toThrow('이미 초대했어요.');
  });

  test('일반 에러 → 한국어 throw', async () => {
    const insert = jest.fn().mockResolvedValue({ data: null, error: { message: 'rls' } });
    mockFrom.mockReturnValue({ insert });
    await expect(
      invitationsApi.createInvitation({ groupId: 'g1', inviteeId: 'u2' }),
    ).rejects.toThrow('초대를 보내지 못했어요. 잠시 후 다시 시도해주세요.');
  });

  test('비인증 → 한국어 throw + from 미호출', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(
      invitationsApi.createInvitation({ groupId: 'g1', inviteeId: 'u2' }),
    ).rejects.toThrow(/로그인/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // S23 — F3 publish wire-up
  test('S23: INSERT 성공 → dispatch(group_invited) silent best-effort', async () => {
    const insert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ insert });

    await invitationsApi.createInvitation({ groupId: 'g1', inviteeId: 'u2' });

    expect(mockPushDispatch).toHaveBeenCalledTimes(1);
    expect(mockPushDispatch).toHaveBeenCalledWith({
      type: 'group_invited',
      groupId: 'g1',
      inviterId: ME,
      inviteeId: 'u2',
    });
  });

  test('S23: INSERT 에러 → dispatch 호출 안 됨', async () => {
    const insert = jest.fn().mockResolvedValue({ data: null, error: { message: 'rls' } });
    mockFrom.mockReturnValue({ insert });

    await expect(
      invitationsApi.createInvitation({ groupId: 'g1', inviteeId: 'u2' }),
    ).rejects.toThrow();
    expect(mockPushDispatch).not.toHaveBeenCalled();
  });
});

describe('invitationsApi.listMyInvitations', () => {
  test('invitee=me + pending + group/inviter join + desc 정렬', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'i1',
          group_id: 'g1',
          inviter_id: 'u2',
          invitee_id: ME,
          status: 'pending',
          created_at: '2026-05-28T01:00:00Z',
          group: { id: 'g1', name: '점심 모임' },
          inviter: { id: 'u2', nickname: '홍길동', avatar_url: 'a2' },
        },
        {
          id: 'i2',
          group_id: 'g3',
          inviter_id: 'u3',
          invitee_id: ME,
          status: 'pending',
          created_at: '2026-05-27T01:00:00Z',
          group: { id: 'g3', name: '저녁 모임' },
          inviter: { id: 'u3', nickname: '김영희', avatar_url: null },
        },
      ],
      error: null,
    });
    const status = jest.fn().mockReturnValue({ order });
    const eq = jest.fn().mockReturnValue({ eq: status });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const list = await invitationsApi.listMyInvitations();

    expect(mockFrom).toHaveBeenCalledWith('group_invitations');
    expect(select).toHaveBeenCalledWith(
      'id, group_id, inviter_id, invitee_id, status, created_at, group:group_id(id, name), inviter:inviter_id(id, nickname, avatar_url:profile_image_url)',
    );
    expect(eq).toHaveBeenCalledWith('invitee_id', ME);
    expect(status).toHaveBeenCalledWith('status', 'pending');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(list).toEqual([
      {
        id: 'i1',
        group_id: 'g1',
        inviter_id: 'u2',
        invitee_id: ME,
        status: 'pending',
        created_at: '2026-05-28T01:00:00Z',
        group: { id: 'g1', name: '점심 모임' },
        inviter: { id: 'u2', nickname: '홍길동', avatar_url: 'a2' },
      },
      {
        id: 'i2',
        group_id: 'g3',
        inviter_id: 'u3',
        invitee_id: ME,
        status: 'pending',
        created_at: '2026-05-27T01:00:00Z',
        group: { id: 'g3', name: '저녁 모임' },
        inviter: { id: 'u3', nickname: '김영희', avatar_url: undefined },
      },
    ]);
  });

  test('빈 결과 → 빈 배열', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ order }),
        }),
      }),
    });
    expect(await invitationsApi.listMyInvitations()).toEqual([]);
  });

  test('PostgREST 배열 join → 첫 row pick', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'i1',
          group_id: 'g1',
          inviter_id: 'u2',
          invitee_id: ME,
          status: 'pending',
          created_at: '2026-05-28T01:00:00Z',
          group: [{ id: 'g1', name: '점심 모임' }],
          inviter: [{ id: 'u2', nickname: '홍길동', avatar_url: 'a2' }],
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ order }),
        }),
      }),
    });
    const list = await invitationsApi.listMyInvitations();
    expect(list[0]?.group).toEqual({ id: 'g1', name: '점심 모임' });
    expect(list[0]?.inviter).toEqual({ id: 'u2', nickname: '홍길동', avatar_url: 'a2' });
  });

  test('에러 → 한국어 throw', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'rls' } });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ order }),
        }),
      }),
    });
    await expect(invitationsApi.listMyInvitations()).rejects.toThrow(
      '모임 초대를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('비인증 → 한국어 throw + from 미호출', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(invitationsApi.listMyInvitations()).rejects.toThrow(/로그인/);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('invitationsApi.acceptInvitation', () => {
  test('accept_group_invitation RPC + group_id 반환', async () => {
    mockRpc.mockResolvedValue({ data: 'g1', error: null });
    const result = await invitationsApi.acceptInvitation('i1');
    expect(mockRpc).toHaveBeenCalledWith('accept_group_invitation', { p_invitation_id: 'i1' });
    expect(result).toEqual({ groupId: 'g1' });
  });

  test('빈 id → 한국어 throw + rpc 미호출', async () => {
    await expect(invitationsApi.acceptInvitation('   ')).rejects.toThrow(/선택해주세요/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('invitation_not_found → 한국어 throw', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'invitation_not_found' },
    });
    await expect(invitationsApi.acceptInvitation('i1')).rejects.toThrow('없는 초대예요.');
  });

  test('invitation_not_pending → 한국어 throw', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'invitation_not_pending' },
    });
    await expect(invitationsApi.acceptInvitation('i1')).rejects.toThrow('이미 처리된 초대예요.');
  });

  test('blocked / not_invitee → 한국어 throw', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'blocked' } });
    await expect(invitationsApi.acceptInvitation('i1')).rejects.toThrow(/수락하지 못했어요/);
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_invitee' } });
    await expect(invitationsApi.acceptInvitation('i1')).rejects.toThrow(/수락하지 못했어요/);
  });

  test('일반 에러 → 한국어 throw', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network' } });
    await expect(invitationsApi.acceptInvitation('i1')).rejects.toThrow(/수락하지 못했어요/);
  });
});

describe('invitationsApi.rejectInvitation', () => {
  test('UPDATE status=rejected + invitee=me + pending guard', async () => {
    const status = jest.fn().mockResolvedValue({ data: null, error: null });
    const me = jest.fn().mockReturnValue({ eq: status });
    const id = jest.fn().mockReturnValue({ eq: me });
    const update = jest.fn().mockReturnValue({ eq: id });
    mockFrom.mockReturnValue({ update });

    await invitationsApi.rejectInvitation('i1');

    expect(mockFrom).toHaveBeenCalledWith('group_invitations');
    expect(update).toHaveBeenCalledWith({ status: 'rejected' });
    expect(id).toHaveBeenCalledWith('id', 'i1');
    expect(me).toHaveBeenCalledWith('invitee_id', ME);
    expect(status).toHaveBeenCalledWith('status', 'pending');
  });

  test('빈 id → 한국어 throw + from 미호출', async () => {
    await expect(invitationsApi.rejectInvitation('  ')).rejects.toThrow(/선택해주세요/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('에러 → 한국어 throw', async () => {
    const status = jest.fn().mockResolvedValue({ data: null, error: { message: 'rls' } });
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ eq: status }),
        }),
      }),
    });
    await expect(invitationsApi.rejectInvitation('i1')).rejects.toThrow(
      '거절하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('비인증 → 한국어 throw + from 미호출', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(invitationsApi.rejectInvitation('i1')).rejects.toThrow(/로그인/);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
