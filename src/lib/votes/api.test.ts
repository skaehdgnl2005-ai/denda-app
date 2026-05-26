import { commitVoteDiff } from './api';

import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('votes/api commitVoteDiff', () => {
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    mockFrom.mockReset();
  });

  function mockInsertOk() {
    const insert = jest.fn().mockResolvedValue({ data: null, error: null });
    return insert;
  }

  function mockDeleteOk() {
    // .delete().eq().eq().eq().in() chain — return resolved at end
    const inFn = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq3 = jest.fn().mockReturnValue({ in: inFn });
    const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const del = jest.fn().mockReturnValue({ eq: eq1 });
    return { del, eq1, eq2, eq3, inFn };
  }

  test('빈 diff: 어떤 supabase 호출도 안 함', async () => {
    await commitVoteDiff({
      groupId: 'g-1',
      userId: 'u-1',
      added: [],
      removed: [],
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('added만: votes INSERT 1회 (다중 row + end_minute = start_minute + 15)', async () => {
    const insert = mockInsertOk();
    mockFrom.mockReturnValue({ insert });

    await commitVoteDiff({
      groupId: 'g-1',
      userId: 'u-1',
      added: [
        { day: '2026-05-30', start_minute: 540 },
        { day: '2026-05-30', start_minute: 555 },
      ],
      removed: [],
    });

    expect(mockFrom).toHaveBeenCalledWith('votes');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([
      {
        group_id: 'g-1',
        user_id: 'u-1',
        day: '2026-05-30',
        start_minute: 540,
        end_minute: 555,
      },
      {
        group_id: 'g-1',
        user_id: 'u-1',
        day: '2026-05-30',
        start_minute: 555,
        end_minute: 570,
      },
    ]);
  });

  test('removed만 (같은 day): DELETE 1회 with .in([...])', async () => {
    const { del, eq1, eq2, eq3, inFn } = mockDeleteOk();
    mockFrom.mockReturnValue({ delete: del });

    await commitVoteDiff({
      groupId: 'g-1',
      userId: 'u-1',
      added: [],
      removed: [
        { day: '2026-05-30', start_minute: 540 },
        { day: '2026-05-30', start_minute: 555 },
      ],
    });

    expect(mockFrom).toHaveBeenCalledWith('votes');
    expect(del).toHaveBeenCalledTimes(1);
    expect(eq1).toHaveBeenCalledWith('group_id', 'g-1');
    expect(eq2).toHaveBeenCalledWith('user_id', 'u-1');
    expect(eq3).toHaveBeenCalledWith('day', '2026-05-30');
    expect(inFn).toHaveBeenCalledWith('start_minute', [540, 555]);
  });

  test('removed (서로 다른 day): day별로 DELETE 분기', async () => {
    const day1 = mockDeleteOk();
    const day2 = mockDeleteOk();
    const insert = mockInsertOk();
    let deleteCallIdx = 0;
    mockFrom.mockImplementation(() => ({
      delete: () => (deleteCallIdx++ === 0 ? day1.del() : day2.del()),
      insert,
    }));

    await commitVoteDiff({
      groupId: 'g-1',
      userId: 'u-1',
      added: [],
      removed: [
        { day: '2026-05-30', start_minute: 540 },
        { day: '2026-05-31', start_minute: 600 },
      ],
    });

    // 2 DELETE call (한 day씩)
    expect(day1.del).toHaveBeenCalledTimes(1);
    expect(day2.del).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });

  test('added + removed 동시: INSERT + DELETE 둘 다 호출', async () => {
    const insert = mockInsertOk();
    const { del } = mockDeleteOk();
    mockFrom.mockImplementation(() => ({ insert, delete: del }));

    await commitVoteDiff({
      groupId: 'g-1',
      userId: 'u-1',
      added: [{ day: '2026-05-30', start_minute: 600 }],
      removed: [{ day: '2026-05-30', start_minute: 540 }],
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(1);
  });

  test('INSERT error는 한국어 메시지 throw', async () => {
    const insert = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table votes' },
    });
    mockFrom.mockReturnValue({ insert });

    await expect(
      commitVoteDiff({
        groupId: 'g-1',
        userId: 'u-1',
        added: [{ day: '2026-05-30', start_minute: 540 }],
        removed: [],
      }),
    ).rejects.toThrow(/투표를 저장하지 못했어요/);
  });

  test('DELETE error는 한국어 메시지 throw', async () => {
    const inFn = jest.fn().mockResolvedValue({ data: null, error: { message: 'rls denied' } });
    const eq3 = jest.fn().mockReturnValue({ in: inFn });
    const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const del = jest.fn().mockReturnValue({ eq: eq1 });
    mockFrom.mockReturnValue({ delete: del });

    await expect(
      commitVoteDiff({
        groupId: 'g-1',
        userId: 'u-1',
        added: [],
        removed: [{ day: '2026-05-30', start_minute: 540 }],
      }),
    ).rejects.toThrow(/투표를 저장하지 못했어요/);
  });
});
