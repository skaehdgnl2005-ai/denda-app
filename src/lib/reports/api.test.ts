import { submitReport } from './api';

import { supabase } from '@/lib/supabase/client';

// supabase client mock
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('reports/api', () => {
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    mockFrom.mockReset();
  });

  function mockInsertChain(result: { data: unknown; error: unknown }) {
    const single = jest.fn().mockResolvedValue(result);
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });
    return { insert, select, single };
  }

  describe('submitReport', () => {
    it('정상 케이스: reports INSERT 호출 + ID 반환', async () => {
      const { insert } = mockInsertChain({
        data: { id: 'report-uuid', created_at: '2026-05-26T03:00:00Z' },
        error: null,
      });

      const result = await submitReport({
        reporterId: 'reporter-1',
        targetUserId: 'target-2',
        reason: 'spam',
        detail: '광고 도배',
      });

      expect(mockFrom).toHaveBeenCalledWith('reports');
      expect(insert).toHaveBeenCalledWith({
        reporter_id: 'reporter-1',
        target_id: 'target-2',
        reason: 'spam',
        detail: '광고 도배',
      });
      expect(result.id).toBe('report-uuid');
    });

    it('detail이 빈 문자열이면 null로 INSERT (schema TEXT nullable)', async () => {
      const { insert } = mockInsertChain({
        data: { id: 'r-2', created_at: 'x' },
        error: null,
      });

      await submitReport({
        reporterId: 'r-1',
        targetUserId: 't-1',
        reason: 'other',
        detail: '',
      });

      expect(insert).toHaveBeenCalledWith({
        reporter_id: 'r-1',
        target_id: 't-1',
        reason: 'other',
        detail: null,
      });
    });

    it('detail 미전달 시 null로 INSERT', async () => {
      const { insert } = mockInsertChain({
        data: { id: 'r-3', created_at: 'x' },
        error: null,
      });

      await submitReport({
        reporterId: 'r-1',
        targetUserId: 't-1',
        reason: 'harassment',
      });

      expect(insert).toHaveBeenCalledWith({
        reporter_id: 'r-1',
        target_id: 't-1',
        reason: 'harassment',
        detail: null,
      });
    });

    it('reporter_id === target_id 자기신고는 throw (CHECK 사전 차단)', async () => {
      await expect(
        submitReport({
          reporterId: 'same',
          targetUserId: 'same',
          reason: 'spam',
        }),
      ).rejects.toThrow(/자기 자신/);

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('schema에 없는 reason은 INSERT 전 throw', async () => {
      await expect(
        submitReport({
          reporterId: 'r-1',
          targetUserId: 't-1',
          reason: 'fraud',
        }),
      ).rejects.toThrow(/사유/);

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('detail 500자 초과는 INSERT 전 throw', async () => {
      await expect(
        submitReport({
          reporterId: 'r-1',
          targetUserId: 't-1',
          reason: 'spam',
          detail: 'ㄱ'.repeat(501),
        }),
      ).rejects.toThrow(/500자/);

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('supabase error는 한국어 메시지 throw', async () => {
      mockInsertChain({
        data: null,
        error: { message: 'permission denied for table reports' },
      });

      await expect(
        submitReport({
          reporterId: 'r-1',
          targetUserId: 't-1',
          reason: 'spam',
        }),
      ).rejects.toThrow(/신고를 접수하지 못했어요/);
    });
  });
});
