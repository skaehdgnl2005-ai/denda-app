// S25 — 수동 개인 일정 CRUD 테스트.
import {
  createPersonalSchedule,
  deletePersonalSchedule,
  toUtcRange,
  updatePersonalSchedule,
  validatePersonalSchedule,
} from './personal';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
const mockFrom = supabase.from as jest.Mock;

const input = { title: '치과', dateIso: '2026-07-18', startMinute: 600, endMinute: 690 };

describe('toUtcRange — KST 입력을 UTC TIMESTAMPTZ로 (D13)', () => {
  test('10:00~11:30 KST → 01:00~02:30Z', () => {
    expect(toUtcRange('2026-07-18', 600, 690)).toEqual({
      start_at: '2026-07-18T01:00:00.000Z',
      end_at: '2026-07-18T02:30:00.000Z',
    });
  });

  test('자정 넘김(1440) → 다음 날 00:00 KST', () => {
    expect(toUtcRange('2026-07-18', 1380, 1440)).toEqual({
      start_at: '2026-07-18T14:00:00.000Z', // 23:00 KST
      end_at: '2026-07-18T15:00:00.000Z', // 다음 날 00:00 KST
    });
  });
});

describe('validatePersonalSchedule', () => {
  test('정상 입력은 null', () => {
    expect(validatePersonalSchedule(input)).toBeNull();
  });

  test('빈 제목·공백 제목 → 한국어 메시지', () => {
    expect(validatePersonalSchedule({ ...input, title: '   ' })).toBe('일정 이름을 입력해주세요.');
  });

  test('40자 초과 제목', () => {
    expect(validatePersonalSchedule({ ...input, title: '가'.repeat(41) })).toBe(
      '일정 이름은 40자까지 쓸 수 있어요.',
    );
  });

  test('종료가 시작보다 빠르거나 같으면', () => {
    expect(validatePersonalSchedule({ ...input, endMinute: 600 })).toBe(
      '종료 시간은 시작 시간보다 늦어야 해요.',
    );
  });

  test('날짜 형식 오류', () => {
    expect(validatePersonalSchedule({ ...input, dateIso: '2026/07/18' })).toBe(
      '날짜를 다시 선택해주세요.',
    );
  });
});

describe('createPersonalSchedule', () => {
  test("source='manual'로 INSERT 하고 id 반환", async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'new-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const result = await createPersonalSchedule('u1', input);

    expect(mockFrom).toHaveBeenCalledWith('schedules');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u1',
      source: 'manual',
      title: '치과',
      start_at: '2026-07-18T01:00:00.000Z',
      end_at: '2026-07-18T02:30:00.000Z',
      recurrence_rule: null,
      expires_at: null,
    });
    expect(result).toEqual({ id: 'new-1' });
  });

  test('제목 앞뒤 공백은 잘라서 저장', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'new-2' }, error: null });
    const insert = jest.fn().mockReturnValue({ select: () => ({ single }) });
    mockFrom.mockReturnValue({ insert });

    await createPersonalSchedule('u1', { ...input, title: '  치과  ' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: '치과' }));
  });

  test('검증 실패는 네트워크 이전에 throw', async () => {
    mockFrom.mockReturnValue({ insert: jest.fn() });
    await expect(createPersonalSchedule('u1', { ...input, title: '' })).rejects.toThrow(
      '일정 이름을 입력해주세요.',
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('DB 에러 → 한국어 throw', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'rls' } });
    mockFrom.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
    await expect(createPersonalSchedule('u1', input)).rejects.toThrow(
      '일정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});

describe('updatePersonalSchedule', () => {
  function mockUpdate(result: { data: unknown; error: unknown }) {
    const select = jest.fn().mockResolvedValue(result);
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });
    return { update, eq };
  }

  test('제목·시간만 UPDATE (source·user_id 미변경)', async () => {
    const { update, eq } = mockUpdate({ data: [{ id: 's1' }], error: null });
    await updatePersonalSchedule('s1', input);
    expect(update).toHaveBeenCalledWith({
      title: '치과',
      start_at: '2026-07-18T01:00:00.000Z',
      end_at: '2026-07-18T02:30:00.000Z',
    });
    expect(eq).toHaveBeenCalledWith('id', 's1');
  });

  // RLS는 남의 행을 조용히 0 rows로 거른다 → 무음 성공 금지 (setConfirmedPlace 패턴 미러)
  test('0 rows(RLS deny) → 한국어 throw', async () => {
    mockUpdate({ data: [], error: null });
    await expect(updatePersonalSchedule('s1', input)).rejects.toThrow(
      '일정을 수정하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});

describe('deletePersonalSchedule', () => {
  test('id로 DELETE', async () => {
    const select = jest.fn().mockResolvedValue({ data: [{ id: 's1' }], error: null });
    const eq = jest.fn().mockReturnValue({ select });
    const del = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ delete: del });

    await deletePersonalSchedule('s1');
    expect(mockFrom).toHaveBeenCalledWith('schedules');
    expect(eq).toHaveBeenCalledWith('id', 's1');
  });

  test('0 rows → 한국어 throw', async () => {
    const eq = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockFrom.mockReturnValue({ delete: () => ({ eq }) });
    await expect(deletePersonalSchedule('s1')).rejects.toThrow(
      '일정을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});
