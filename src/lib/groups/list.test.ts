import { fetchMyGroups } from './list';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
const mockFrom = supabase.from as jest.Mock;

function mockSelectOrder(result: { data: unknown; error: unknown }) {
  const order = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });
  return { select, order };
}

describe('fetchMyGroups', () => {
  beforeEach(() => mockFrom.mockReset());

  test('groups 행을 camelCase 요약으로 매핑 (미확정 먼저 정렬 호출)', async () => {
    const { select, order } = mockSelectOrder({
      data: [
        { id: 'g1', name: '저녁', dates: ['2026-05-30'], confirmed_at: null },
        { id: 'g2', name: '점심', dates: ['2026-06-01'], confirmed_at: '2026-05-28T03:00:00Z' },
      ],
      error: null,
    });
    const result = await fetchMyGroups();
    expect(mockFrom).toHaveBeenCalledWith('groups');
    expect(select).toHaveBeenCalledWith('id, name, dates, confirmed_at');
    expect(order).toHaveBeenCalledWith('confirmed_at', { ascending: true, nullsFirst: true });
    expect(result).toEqual([
      { id: 'g1', name: '저녁', dates: ['2026-05-30'], confirmedAt: null },
      { id: 'g2', name: '점심', dates: ['2026-06-01'], confirmedAt: '2026-05-28T03:00:00Z' },
    ]);
  });

  test('에러 → 한국어 throw', async () => {
    mockSelectOrder({ data: null, error: { message: 'rls' } });
    await expect(fetchMyGroups()).rejects.toThrow(
      '모임 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('빈 결과 → 빈 배열', async () => {
    mockSelectOrder({ data: null, error: null });
    expect(await fetchMyGroups()).toEqual([]);
  });
});
