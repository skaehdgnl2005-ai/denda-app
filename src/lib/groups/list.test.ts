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
        {
          id: 'g1',
          name: '저녁',
          dates: ['2026-05-30'],
          confirmed_at: null,
          confirmed_start_at: null,
          confirmed_end_at: null,
          places: null,
        },
        {
          id: 'g2',
          name: '점심',
          dates: ['2026-06-01'],
          confirmed_at: '2026-05-28T03:00:00Z',
          confirmed_start_at: '2026-06-01T03:00:00Z',
          confirmed_end_at: '2026-06-01T05:00:00Z',
          places: { name: '강남 이자카야' },
        },
      ],
      error: null,
    });
    const result = await fetchMyGroups();
    expect(mockFrom).toHaveBeenCalledWith('groups');
    // S25 홈 캘린더: 확정 시각 + 장소명까지 한 번에 (추가 쿼리 없음)
    expect(select).toHaveBeenCalledWith(
      'id, name, dates, confirmed_at, confirmed_start_at, confirmed_end_at, places(name)',
    );
    expect(order).toHaveBeenCalledWith('confirmed_at', { ascending: true, nullsFirst: true });
    expect(result).toEqual([
      {
        id: 'g1',
        name: '저녁',
        dates: ['2026-05-30'],
        confirmedAt: null,
        confirmedStartAt: null,
        confirmedEndAt: null,
        placeName: null,
      },
      {
        id: 'g2',
        name: '점심',
        dates: ['2026-06-01'],
        confirmedAt: '2026-05-28T03:00:00Z',
        confirmedStartAt: '2026-06-01T03:00:00Z',
        confirmedEndAt: '2026-06-01T05:00:00Z',
        placeName: '강남 이자카야',
      },
    ]);
  });

  // PostgREST FK JOIN은 관계 추론에 따라 배열로 올 수 있다 (groupScheduleQueries와 동일 방어).
  test('places JOIN이 배열로 와도 첫 요소를 언랩', async () => {
    mockSelectOrder({
      data: [
        {
          id: 'g3',
          name: '회식',
          dates: [],
          confirmed_at: '2026-06-02T03:00:00Z',
          confirmed_start_at: '2026-06-02T10:00:00Z',
          confirmed_end_at: '2026-06-02T12:00:00Z',
          places: [{ name: '홍대 포차' }],
        },
      ],
      error: null,
    });
    const [row] = await fetchMyGroups();
    expect(row?.placeName).toBe('홍대 포차');
  });

  test('dates가 null인 행도 빈 배열로 방어', async () => {
    mockSelectOrder({
      data: [
        {
          id: 'g4',
          name: '미정',
          dates: null,
          confirmed_at: null,
          confirmed_start_at: null,
          places: null,
        },
      ],
      error: null,
    });
    const [row] = await fetchMyGroups();
    expect(row?.dates).toEqual([]);
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
