// S15-mapmode-logic — confirmed groups + places JOIN fetcher.
//
// RLS groups_select_member_or_host(0002:209)가 호스트·멤버 모임만 자연 반환 → userId 인자 불필요.
// confirmed_at·confirmed_start_at·confirmed_place_id 모두 NOT NULL인 행만 필터.
// 좌표는 places JOIN으로 lat/lng 동반.

import { fetchConfirmedGroupSchedules } from './groupScheduleQueries';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
const mockFrom = supabase.from as jest.Mock;

interface ChainResult {
  data: unknown;
  error: unknown;
}

function mockChain(result: ChainResult): {
  select: jest.Mock;
  notA: jest.Mock;
  notB: jest.Mock;
  notC: jest.Mock;
  order: jest.Mock;
} {
  const order = jest.fn().mockResolvedValue(result);
  const notC = jest.fn().mockReturnValue({ order });
  const notB = jest.fn().mockReturnValue({ not: notC });
  const notA = jest.fn().mockReturnValue({ not: notB });
  const select = jest.fn().mockReturnValue({ not: notA });
  mockFrom.mockReturnValue({ select });
  return { select, notA, notB, notC, order };
}

describe('fetchConfirmedGroupSchedules', () => {
  beforeEach(() => mockFrom.mockReset());

  test('confirmed_at·start_at·place_id NOT NULL 필터 + places JOIN + start_at 오름차순', async () => {
    const { select, notA, notB, notC, order } = mockChain({
      data: [
        {
          id: 'g1',
          name: '저녁',
          confirmed_start_at: '2026-05-30T10:00:00.000Z',
          confirmed_place_id: 'p1',
          places: { id: 'p1', name: '광장시장', lat: 37.5704, lng: 126.9999 },
        },
      ],
      error: null,
    });

    const out = await fetchConfirmedGroupSchedules();

    expect(mockFrom).toHaveBeenCalledWith('groups');
    expect(select).toHaveBeenCalledWith(
      'id, name, confirmed_start_at, confirmed_place_id, places(id, name, lat, lng)',
    );
    expect(notA).toHaveBeenCalledWith('confirmed_at', 'is', null);
    expect(notB).toHaveBeenCalledWith('confirmed_start_at', 'is', null);
    expect(notC).toHaveBeenCalledWith('confirmed_place_id', 'is', null);
    expect(order).toHaveBeenCalledWith('confirmed_start_at', { ascending: true });

    expect(out).toEqual([
      {
        groupId: 'g1',
        groupName: '저녁',
        placeId: 'p1',
        placeName: '광장시장',
        lat: 37.5704,
        lng: 126.9999,
        confirmedStartAt: '2026-05-30T10:00:00.000Z',
      },
    ]);
  });

  test('places JOIN null인 행은 제외 (defensive)', async () => {
    mockChain({
      data: [
        {
          id: 'g1',
          name: 'A',
          confirmed_start_at: '2026-05-30T10:00:00.000Z',
          confirmed_place_id: 'p1',
          places: null,
        },
        {
          id: 'g2',
          name: 'B',
          confirmed_start_at: '2026-05-31T10:00:00.000Z',
          confirmed_place_id: 'p2',
          places: { id: 'p2', name: '맛집', lat: 37.5, lng: 127.0 },
        },
      ],
      error: null,
    });
    const out = await fetchConfirmedGroupSchedules();
    expect(out).toHaveLength(1);
    expect(out[0]?.groupId).toBe('g2');
  });

  test('에러 → 한국어 throw', async () => {
    mockChain({ data: null, error: { message: 'rls' } });
    await expect(fetchConfirmedGroupSchedules()).rejects.toThrow(
      '모임 일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('빈 결과 → 빈 배열', async () => {
    mockChain({ data: null, error: null });
    expect(await fetchConfirmedGroupSchedules()).toEqual([]);
  });
});
