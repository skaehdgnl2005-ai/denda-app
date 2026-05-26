import { confirmGroup } from './confirm';

import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const VALID_GROUP_ID = '11111111-2222-3333-4444-555555555555';
const VALID_PLACE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const validInput = {
  groupId: VALID_GROUP_ID,
  dayIndex: 0,
  startMinute: 540,
  endMinute: 600,
  confirmedPlaceId: VALID_PLACE_ID,
};

describe('confirmGroup', () => {
  const mockInvoke = supabase.functions.invoke as jest.Mock;

  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('정상 케이스: group_confirm Edge에 snake_case body 전달 + camelCase 응답 변환', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        confirmed_at: '2026-05-26T20:00:00+09:00',
        f5_dispatch: { fulfilled: 3, rejected: 0 },
      },
      error: null,
    });

    const result = await confirmGroup(validInput);

    expect(mockInvoke).toHaveBeenCalledWith('group_confirm', {
      body: {
        group_id: VALID_GROUP_ID,
        day_index: 0,
        start_minute: 540,
        end_minute: 600,
        confirmed_place_id: VALID_PLACE_ID,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.confirmedAt).toBe('2026-05-26T20:00:00+09:00');
    expect(result.alreadyConfirmed).toBe(false);
    expect(result.f5Dispatch).toEqual({ fulfilled: 3, rejected: 0 });
  });

  it('already_confirmed=true 응답 → alreadyConfirmed=true 전달 (idempotent)', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        confirmed_at: '2026-05-26T20:00:00+09:00',
        already_confirmed: true,
        f5_dispatch: { fulfilled: 0, rejected: 0 },
      },
      error: null,
    });

    const result = await confirmGroup(validInput);
    expect(result.alreadyConfirmed).toBe(true);
  });

  it('confirmed_place_id null 입력 → body에 null 전달', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        confirmed_at: '2026-05-26T20:00:00+09:00',
        f5_dispatch: { fulfilled: 0, rejected: 0 },
      },
      error: null,
    });

    await confirmGroup({ ...validInput, confirmedPlaceId: null });

    expect(mockInvoke).toHaveBeenCalledWith('group_confirm', {
      body: expect.objectContaining({ confirmed_place_id: null }),
    });
  });

  it('사전 validation 실패 — Edge 호출 0', async () => {
    await expect(confirmGroup({ ...validInput, startMinute: 543 })).rejects.toThrow(/15분/);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('Edge 403 응답 → "호스트만" 한국어 에러', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: '호스트만 모임을 확정할 수 있습니다.' },
    });

    await expect(confirmGroup(validInput)).rejects.toThrow(/호스트만/);
  });

  it('Edge 401 응답 → "로그인 필요" 한국어 에러', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: '인증이 필요합니다.' },
    });

    await expect(confirmGroup(validInput)).rejects.toThrow(/로그인/);
  });

  it('Edge 기타 에러 → 일반 한국어 메시지', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'something else' },
    });

    await expect(confirmGroup(validInput)).rejects.toThrow(/모임을 확정하지 못했어요/);
  });

  it('Edge가 data null 반환 → 일반 한국어 에러', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(confirmGroup(validInput)).rejects.toThrow(/모임을 확정하지 못했어요/);
  });

  it('f5Dispatch.rejected > 0도 정상 응답 (partial 발송 성공)', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        confirmed_at: '2026-05-26T20:00:00+09:00',
        f5_dispatch: { fulfilled: 2, rejected: 1 },
      },
      error: null,
    });

    const result = await confirmGroup(validInput);
    expect(result.f5Dispatch.fulfilled).toBe(2);
    expect(result.f5Dispatch.rejected).toBe(1);
  });
});
