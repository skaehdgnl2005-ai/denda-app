import { createGroup } from './create';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockRpc = supabase.rpc as jest.Mock;

describe('createGroup', () => {
  beforeEach(() => mockRpc.mockReset());

  test('정상 → {id} 반환 + RPC 인자 shape', async () => {
    mockRpc.mockResolvedValue({ data: 'group-uuid', error: null });
    const result = await createGroup({ name: '5/30 저녁', dates: ['2026-05-30'] });
    expect(result).toEqual({ id: 'group-uuid' });
    expect(mockRpc).toHaveBeenCalledWith('create_group', {
      p_name: '5/30 저녁',
      p_dates: ['2026-05-30'],
    });
  });

  test('이름 앞뒤 공백은 trim 후 전달', async () => {
    mockRpc.mockResolvedValue({ data: 'g', error: null });
    await createGroup({ name: '  점심  ', dates: ['2026-05-30'] });
    expect(mockRpc).toHaveBeenCalledWith('create_group', {
      p_name: '점심',
      p_dates: ['2026-05-30'],
    });
  });

  test('이름이 공백뿐이면 사전 throw + RPC 미호출', async () => {
    await expect(createGroup({ name: '   ', dates: ['2026-05-30'] })).rejects.toThrow(
      '모임 이름을 입력해주세요.',
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('날짜 0개면 사전 throw + RPC 미호출', async () => {
    await expect(createGroup({ name: 'g', dates: [] })).rejects.toThrow(
      '후보 날짜를 한 개 이상 선택해주세요.',
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('인증 에러 → 로그인 필요 메시지', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Not authenticated' } });
    await expect(createGroup({ name: 'g', dates: ['2026-05-30'] })).rejects.toThrow(
      '로그인이 필요해요.',
    );
  });

  test('기타 에러 → 일반 한국어 메시지', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(createGroup({ name: 'g', dates: ['2026-05-30'] })).rejects.toThrow(
      '모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('data 누락 → 일반 한국어 메시지', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(createGroup({ name: 'g', dates: ['2026-05-30'] })).rejects.toThrow(
      '모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});
