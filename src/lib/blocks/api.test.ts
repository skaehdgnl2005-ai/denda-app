import { blockUser } from './api';

import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

describe('blocks/api', () => {
  const mockRpc = supabase.rpc as jest.Mock;

  beforeEach(() => {
    mockRpc.mockReset();
  });

  describe('blockUser', () => {
    it('정상 케이스: supabase.rpc("block_user", { p_target_id }) 호출', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      await blockUser('target-uuid-1');

      expect(mockRpc).toHaveBeenCalledWith('block_user', { p_target_id: 'target-uuid-1' });
    });

    it('빈 targetUserId는 사전 throw (RPC 호출 0)', async () => {
      await expect(blockUser('')).rejects.toThrow(/대상/);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('whitespace-only targetUserId 사전 throw', async () => {
      await expect(blockUser('   ')).rejects.toThrow(/대상/);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('supabase rpc error는 한국어 메시지로 throw', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      });

      await expect(blockUser('target-1')).rejects.toThrow(/차단하지 못했어요/);
    });

    it('RPC가 Cannot block self를 raise한 경우 한국어 변환', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Cannot block self' },
      });

      await expect(blockUser('target-1')).rejects.toThrow(/자기 자신/);
    });
  });
});
