import { deleteMyOrigin, fetchGroupOrigins, upsertMyOrigin } from './groupOrigins';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
const mockFrom = supabase.from as jest.Mock;

describe('fetchGroupOrigins', () => {
  beforeEach(() => mockFrom.mockReset());

  function mockSelectChain(result: { data: unknown; error: unknown }): {
    select: jest.Mock;
    eq: jest.Mock;
    order: jest.Mock;
  } {
    const order = jest.fn().mockResolvedValue(result);
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });
    return { select, eq, order };
  }

  test('users(nickname) join + group_id 필터 + created_at 오름차순', async () => {
    const { select, eq, order } = mockSelectChain({
      data: [
        { user_id: 'u1', label: '강남역', lat: 37.4979, lng: 127.0276, users: { nickname: '지연' } },
        { user_id: 'u2', label: '홍대입구역', lat: 37.5572, lng: 126.9245, users: null },
      ],
      error: null,
    });

    const out = await fetchGroupOrigins('g-1');

    expect(mockFrom).toHaveBeenCalledWith('group_origins');
    expect(select).toHaveBeenCalledWith('user_id, label, lat, lng, users(nickname)');
    expect(eq).toHaveBeenCalledWith('group_id', 'g-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(out).toEqual([
      { userId: 'u1', nickname: '지연', label: '강남역', coord: { lat: 37.4979, lng: 127.0276 } },
      { userId: 'u2', nickname: '멤버', label: '홍대입구역', coord: { lat: 37.5572, lng: 126.9245 } },
    ]);
  });

  test('에러 시 한국어 메시지 throw', async () => {
    mockSelectChain({ data: null, error: { message: 'boom' } });
    await expect(fetchGroupOrigins('g-1')).rejects.toThrow(
      '출발지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});

describe('upsertMyOrigin', () => {
  beforeEach(() => mockFrom.mockReset());

  test('onConflict group_id,user_id로 본인 행 upsert (updated_at은 UTC ISO)', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert });

    await upsertMyOrigin('g-1', 'me', { label: '공덕역', coord: { lat: 37.5432, lng: 126.9512 } });

    expect(mockFrom).toHaveBeenCalledWith('group_origins');
    const [row, opts] = upsert.mock.calls[0] as [Record<string, unknown>, { onConflict: string }];
    expect(row).toMatchObject({
      group_id: 'g-1',
      user_id: 'me',
      label: '공덕역',
      lat: 37.5432,
      lng: 126.9512,
    });
    expect(typeof row.updated_at).toBe('string'); // luxon UTC ISO (D13 — new Date() 금지)
    expect(opts).toEqual({ onConflict: 'group_id,user_id' });
  });

  test('좌표가 WGS84 범위 밖이면 저장 전에 throw (D18)', async () => {
    const upsert = jest.fn();
    mockFrom.mockReturnValue({ upsert });
    await expect(
      upsertMyOrigin('g-1', 'me', { label: 'X', coord: { lat: 999, lng: 0 } }),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  test('에러 시 한국어 메시지 throw', async () => {
    mockFrom.mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: { message: 'x' } }) });
    await expect(
      upsertMyOrigin('g-1', 'me', { label: '공덕역', coord: { lat: 37.5, lng: 126.9 } }),
    ).rejects.toThrow('출발지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
  });
});

describe('deleteMyOrigin', () => {
  beforeEach(() => mockFrom.mockReset());

  test('group_id + user_id로 본인 행 삭제', async () => {
    const eqUser = jest.fn().mockResolvedValue({ error: null });
    const eqGroup = jest.fn().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: eqGroup }) });

    await deleteMyOrigin('g-1', 'me');

    expect(eqGroup).toHaveBeenCalledWith('group_id', 'g-1');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'me');
  });

  test('에러 시 한국어 메시지 throw', async () => {
    const eqUser = jest.fn().mockResolvedValue({ error: { message: 'x' } });
    const eqGroup = jest.fn().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: eqGroup }) });
    await expect(deleteMyOrigin('g-1', 'me')).rejects.toThrow(
      '출발지를 삭제하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});
