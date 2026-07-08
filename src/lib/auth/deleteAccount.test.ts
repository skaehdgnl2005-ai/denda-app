import { deleteAccount } from './deleteAccount';

import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('deleteAccount', () => {
  const mockInvoke = supabase.functions.invoke as jest.Mock;

  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('성공: delete_account Edge 호출(본문 없음) + ok:true → resolve', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    await expect(deleteAccount()).resolves.toBeUndefined();

    // 서버가 JWT에서 user_id를 도출하므로 본문(user_id 등)을 절대 전달하지 않는다(IDOR 차단).
    expect(mockInvoke).toHaveBeenCalledWith('delete_account');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('Edge 기타 에러 → 일반 탈퇴 실패 한국어 (raw 메시지 비노출)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'internal boom xyz' } });
    await expect(deleteAccount()).rejects.toThrow(
      '회원 탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  it('data null / ok 아님 → 실패 한국어', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(deleteAccount()).rejects.toThrow(/회원 탈퇴에 실패/);
  });

  it('invoke 자체 reject(네트워크) → 실패 한국어 (raw 메시지 비노출)', async () => {
    mockInvoke.mockRejectedValue(new Error('Network request failed'));
    await expect(deleteAccount()).rejects.toThrow(
      '회원 탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});
