import { fetchPlace } from './queries';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function singleResolve(value: unknown) {
  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve(value),
      }),
    }),
  };
}

describe('fetchPlace', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('정상 row → camelCase 변환 반환', async () => {
    mockFrom.mockReturnValue(
      singleResolve({
        data: {
          id: '11111111-2222-3333-4444-555555555555',
          name: '한솥도시락 안암점',
          category: '한식',
          address: '서울 성북구 안암동',
          partnership_id: '99999999-8888-7777-6666-555555555555',
        },
        error: null,
      }),
    );

    const place = await fetchPlace('11111111-2222-3333-4444-555555555555');
    expect(place.id).toBe('11111111-2222-3333-4444-555555555555');
    expect(place.name).toBe('한솥도시락 안암점');
    expect(place.category).toBe('한식');
    expect(place.address).toBe('서울 성북구 안암동');
    expect(place.partnershipId).toBe('99999999-8888-7777-6666-555555555555');
  });

  it('partnership_id null → partnershipId null', async () => {
    mockFrom.mockReturnValue(
      singleResolve({
        data: {
          id: '11111111-2222-3333-4444-555555555555',
          name: '식당',
          category: null,
          address: null,
          partnership_id: null,
        },
        error: null,
      }),
    );

    const place = await fetchPlace('11111111-2222-3333-4444-555555555555');
    expect(place.partnershipId).toBeNull();
    expect(place.category).toBeNull();
    expect(place.address).toBeNull();
  });

  it('row not found → 한국어 throw', async () => {
    mockFrom.mockReturnValue(
      singleResolve({
        data: null,
        error: null,
      }),
    );

    await expect(fetchPlace('11111111-2222-3333-4444-555555555555')).rejects.toThrow(
      /장소를 찾을 수 없어요/,
    );
  });

  it('Supabase error → 한국어 throw', async () => {
    mockFrom.mockReturnValue(
      singleResolve({
        data: null,
        error: { message: 'connection error' },
      }),
    );

    await expect(fetchPlace('11111111-2222-3333-4444-555555555555')).rejects.toThrow(
      /장소를 불러오지 못했어요/,
    );
  });
});
