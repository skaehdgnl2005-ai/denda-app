import { fetchGroupForConfirm } from './queries';

import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const VALID_GROUP_ID = '11111111-2222-3333-4444-555555555555';
const HOST_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const MEMBER_USER_ID = '99999999-8888-7777-6666-555555555555';
const VALID_PLACE_ID = 'cccccccc-dddd-eeee-ffff-111111111111';

function buildGroupQueryMock(
  group: Record<string, unknown> | null,
  error: { message: string } | null = null,
) {
  const single = jest.fn().mockResolvedValue({ data: group, error });
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  return { from: jest.fn().mockReturnValue({ select }), select, eq, single };
}

function buildMembersQueryMock(
  members: Record<string, unknown>[],
  error: { message: string } | null = null,
) {
  const eq = jest.fn().mockResolvedValue({ data: members, error });
  const select = jest.fn().mockReturnValue({ eq });
  return { from: jest.fn().mockReturnValue({ select }), select, eq };
}

describe('fetchGroupForConfirm', () => {
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    mockFrom.mockReset();
  });

  test('groups + group_members fetch 후 결과 합쳐서 반환', async () => {
    const groupRow = {
      id: VALID_GROUP_ID,
      host_id: HOST_USER_ID,
      name: '안암 회식',
      dates: ['2026-06-01', '2026-06-02', '2026-06-03'],
      confirmed_at: null,
      confirmed_start_at: null,
      confirmed_end_at: null,
      confirmed_place_id: null,
    };
    const members = [{ user_id: HOST_USER_ID }, { user_id: MEMBER_USER_ID }];

    const groupMock = buildGroupQueryMock(groupRow);
    const membersMock = buildMembersQueryMock(members);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'groups') return groupMock.from('groups');
      if (table === 'group_members') return membersMock.from('group_members');
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await fetchGroupForConfirm(VALID_GROUP_ID);

    expect(result.id).toBe(VALID_GROUP_ID);
    expect(result.hostId).toBe(HOST_USER_ID);
    expect(result.name).toBe('안암 회식');
    expect(result.dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(result.memberCount).toBe(2);
    expect(result.confirmedAt).toBeNull();
    expect(result.confirmedStartAt).toBeNull();
    expect(result.confirmedEndAt).toBeNull();
    expect(result.confirmedPlaceId).toBeNull();
    expect(groupMock.select).toHaveBeenCalled();
    expect(groupMock.eq).toHaveBeenCalledWith('id', VALID_GROUP_ID);
    expect(membersMock.eq).toHaveBeenCalledWith('group_id', VALID_GROUP_ID);
  });

  test('confirmed 상태 → confirmedAt / confirmedStartAt / confirmedEndAt 전달', async () => {
    const groupRow = {
      id: VALID_GROUP_ID,
      host_id: HOST_USER_ID,
      name: '확정된 모임',
      dates: ['2026-06-01'],
      confirmed_at: '2026-05-30T10:00:00+09:00',
      confirmed_start_at: '2026-06-01T19:00:00+00:00',
      confirmed_end_at: '2026-06-01T21:00:00+00:00',
      confirmed_place_id: VALID_PLACE_ID,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'groups') return buildGroupQueryMock(groupRow).from('groups');
      if (table === 'group_members')
        return buildMembersQueryMock([{ user_id: HOST_USER_ID }]).from('group_members');
      throw new Error('unexpected');
    });

    const result = await fetchGroupForConfirm(VALID_GROUP_ID);
    expect(result.confirmedAt).toBe('2026-05-30T10:00:00+09:00');
    expect(result.confirmedStartAt).toBe('2026-06-01T19:00:00+00:00');
    expect(result.confirmedEndAt).toBe('2026-06-01T21:00:00+00:00');
    expect(result.confirmedPlaceId).toBe(VALID_PLACE_ID);
  });

  test('groups 에러 → 한국어 메시지 throw', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'groups')
        return buildGroupQueryMock(null, { message: 'permission denied' }).from('groups');
      return buildMembersQueryMock([]).from('group_members');
    });

    await expect(fetchGroupForConfirm(VALID_GROUP_ID)).rejects.toThrow('모임을 불러오지');
  });

  test('groups 조회 결과 null → "찾을 수 없어요"', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'groups') return buildGroupQueryMock(null, null).from('groups');
      return buildMembersQueryMock([]).from('group_members');
    });

    await expect(fetchGroupForConfirm(VALID_GROUP_ID)).rejects.toThrow('찾을 수 없');
  });

  test('group_members 에러 → 한국어 메시지 throw', async () => {
    const groupRow = {
      id: VALID_GROUP_ID,
      host_id: HOST_USER_ID,
      name: 'x',
      dates: ['2026-06-01'],
      confirmed_at: null,
      confirmed_start_at: null,
      confirmed_end_at: null,
      confirmed_place_id: null,
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'groups') return buildGroupQueryMock(groupRow).from('groups');
      return buildMembersQueryMock([], { message: 'rls' }).from('group_members');
    });

    await expect(fetchGroupForConfirm(VALID_GROUP_ID)).rejects.toThrow('멤버');
  });

  test('빈 member list → memberCount=0', async () => {
    const groupRow = {
      id: VALID_GROUP_ID,
      host_id: HOST_USER_ID,
      name: 'x',
      dates: ['2026-06-01'],
      confirmed_at: null,
      confirmed_start_at: null,
      confirmed_end_at: null,
      confirmed_place_id: null,
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'groups') return buildGroupQueryMock(groupRow).from('groups');
      return buildMembersQueryMock([]).from('group_members');
    });
    const result = await fetchGroupForConfirm(VALID_GROUP_ID);
    expect(result.memberCount).toBe(0);
  });
});
