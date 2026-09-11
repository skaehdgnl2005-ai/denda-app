import { setConfirmedPlace } from './setConfirmedPlace';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function mockUpdateChain(result: { data: unknown; error: unknown }) {
  const select = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ select });
  const update = jest.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ update });
  return { update, eq, select };
}

describe('setConfirmedPlace', () => {
  beforeEach(() => mockFrom.mockReset());

  test('정상 → groups UPDATE confirmed_place_id + 행 1개 반환', async () => {
    const { update, eq } = mockUpdateChain({ data: [{ id: 'g-1' }], error: null });
    await setConfirmedPlace('g-1', 'p-1');
    expect(mockFrom).toHaveBeenCalledWith('groups');
    expect(update).toHaveBeenCalledWith({ confirmed_place_id: 'p-1' });
    expect(eq).toHaveBeenCalledWith('id', 'g-1');
  });

  test('비호스트(RLS deny) → 0 rows 반환 → 호스트만 메시지로 throw', async () => {
    mockUpdateChain({ data: [], error: null });
    await expect(setConfirmedPlace('g-1', 'p-1')).rejects.toThrow(
      '호스트만 장소를 정할 수 있어요.',
    );
  });

  test('Supabase 에러 → 한국어 throw', async () => {
    mockUpdateChain({ data: null, error: { message: 'boom' } });
    await expect(setConfirmedPlace('g-1', 'p-1')).rejects.toThrow(
      '장소를 확정하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('groupId 비어 있으면 사전 throw + UPDATE 미호출', async () => {
    await expect(setConfirmedPlace('', 'p-1')).rejects.toThrow();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('placeId 비어 있으면 사전 throw + UPDATE 미호출', async () => {
    await expect(setConfirmedPlace('g-1', '')).rejects.toThrow();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
