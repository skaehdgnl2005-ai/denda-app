import { persistPlace } from './persist';
import type { PlaceSearchResult } from './PlaceSearchProvider';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function mockUpsertChain(result: { data: unknown; error: unknown }) {
  const single = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ single });
  const upsert = jest.fn().mockReturnValue({ select });
  mockFrom.mockReturnValue({ upsert });
  return { upsert, select, single };
}

const naverResult: PlaceSearchResult = {
  providerPlaceId: 'naver:한솥도시락 안암점:37.123:127.456',
  name: '한솥도시락 안암점',
  category: '한식',
  address: '서울 성북구 안암동',
  lat: 37.123,
  lng: 127.456,
  phone: '02-123-4567',
  source: 'naver',
};

describe('persistPlace', () => {
  beforeEach(() => mockFrom.mockReset());

  test('네이버 장소 → upsert(onConflict source,provider_place_id) + placeId 반환', async () => {
    const { upsert } = mockUpsertChain({ data: { id: 'place-uuid' }, error: null });
    const id = await persistPlace(naverResult);
    expect(id).toBe('place-uuid');
    expect(mockFrom).toHaveBeenCalledWith('places');
    expect(upsert).toHaveBeenCalledWith(
      {
        source: 'naver',
        provider_place_id: 'naver:한솥도시락 안암점:37.123:127.456',
        name: '한솥도시락 안암점',
        category: '한식',
        address: '서울 성북구 안암동',
        lat: 37.123,
        lng: 127.456,
      },
      { onConflict: 'source,provider_place_id' },
    );
  });

  test('category/address null 도 그대로 영속화', async () => {
    const { upsert } = mockUpsertChain({ data: { id: 'p2' }, error: null });
    await persistPlace({ ...naverResult, category: null, address: null });
    const row = upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.category).toBeNull();
    expect(row.address).toBeNull();
  });

  test('phone 은 places 스키마에 없음 → row 에서 제외', async () => {
    const { upsert } = mockUpsertChain({ data: { id: 'p3' }, error: null });
    await persistPlace(naverResult);
    const row = upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('phone');
  });

  test('에러 → 한국어 throw', async () => {
    mockUpsertChain({ data: null, error: { message: 'boom' } });
    await expect(persistPlace(naverResult)).rejects.toThrow(
      '장소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('data 누락 → 한국어 throw', async () => {
    mockUpsertChain({ data: null, error: null });
    await expect(persistPlace(naverResult)).rejects.toThrow(
      '장소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});
