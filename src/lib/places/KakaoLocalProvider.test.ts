import { KakaoLocalProvider } from './KakaoLocalProvider';

import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const SAMPLE_RESULT = {
  providerPlaceId: 'kakao:26338954',
  name: '스타벅스 강남점',
  category: '카페',
  address: '서울 강남구 강남대로 390',
  lat: 37.500435,
  lng: 127.0276662,
  phone: '02-1234-5678',
  source: 'kakao' as const,
};

describe('KakaoLocalProvider', () => {
  const mockInvoke = supabase.functions.invoke as jest.Mock;

  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('source는 kakao', () => {
    expect(new KakaoLocalProvider().source).toBe('kakao');
  });

  it('정상: kakao_local_search Edge에 query/display 전달 + results 반환', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, results: [SAMPLE_RESULT] },
      error: null,
    });

    const provider = new KakaoLocalProvider();
    const results = await provider.search({ query: '강남 카페', display: 15 });

    expect(mockInvoke).toHaveBeenCalledWith('kakao_local_search', {
      body: { query: '강남 카페', display: 15 },
    });
    expect(results).toEqual([SAMPLE_RESULT]);
  });

  it('display 미명시 → body에 query만 전달', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, results: [] }, error: null });

    await new KakaoLocalProvider().search({ query: '홍대' });

    expect(mockInvoke).toHaveBeenCalledWith('kakao_local_search', {
      body: { query: '홍대' },
    });
  });

  it('빈 검색어 → invoke 없이 throw', async () => {
    await expect(new KakaoLocalProvider().search({ query: '   ' })).rejects.toThrow();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('Edge error → 한국어 throw', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'rate limit' },
    });

    await expect(new KakaoLocalProvider().search({ query: '강남' })).rejects.toThrow(/다시 시도/);
  });

  it('data null + error null → 한국어 throw', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(new KakaoLocalProvider().search({ query: '강남' })).rejects.toThrow(/다시 시도/);
  });

  it('results 누락(빈 응답 shape) → 빈 배열', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    const results = await new KakaoLocalProvider().search({ query: '강남' });
    expect(results).toEqual([]);
  });

  it('PlaceSearchProvider 인터페이스 충족 (search 메서드 존재)', () => {
    const provider = new KakaoLocalProvider();
    expect(typeof provider.search).toBe('function');
  });
});
