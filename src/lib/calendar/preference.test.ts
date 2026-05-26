// S06-ui-first-time-modal — fetchCalendarPreference helper tests.

import { fetchCalendarPreference, type CalendarPreference } from './preference';

type Single = { data: { calendar_preference: CalendarPreference | null } | null; error: { message: string } | null };

function buildMock(single: Single): { from: jest.Mock } {
  const singleFn = jest.fn().mockResolvedValue(single);
  const eq = jest.fn().mockReturnValue({ single: singleFn });
  const select = jest.fn().mockReturnValue({ eq });
  return { from: jest.fn().mockReturnValue({ select }) };
}

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('fetchCalendarPreference', () => {
  test('row 존재 + calendar_preference NULL → null 반환 (모달 노출 대상)', async () => {
    const supabase = buildMock({ data: { calendar_preference: null }, error: null });
    const pref = await fetchCalendarPreference(supabase as never, USER_ID);
    expect(pref).toBeNull();
    expect(supabase.from).toHaveBeenCalledWith('users');
  });

  test('preference="google" → "google" 반환', async () => {
    const supabase = buildMock({ data: { calendar_preference: 'google' }, error: null });
    expect(await fetchCalendarPreference(supabase as never, USER_ID)).toBe('google');
  });

  test('preference="apple_ios" → "apple_ios" 반환', async () => {
    const supabase = buildMock({ data: { calendar_preference: 'apple_ios' }, error: null });
    expect(await fetchCalendarPreference(supabase as never, USER_ID)).toBe('apple_ios');
  });

  test('preference="both" → "both" 반환', async () => {
    const supabase = buildMock({ data: { calendar_preference: 'both' }, error: null });
    expect(await fetchCalendarPreference(supabase as never, USER_ID)).toBe('both');
  });

  test('preference="none" → "none" 반환', async () => {
    const supabase = buildMock({ data: { calendar_preference: 'none' }, error: null });
    expect(await fetchCalendarPreference(supabase as never, USER_ID)).toBe('none');
  });

  test('row 없음 → null 반환 (모달 노출 대상)', async () => {
    const supabase = buildMock({ data: null, error: null });
    expect(await fetchCalendarPreference(supabase as never, USER_ID)).toBeNull();
  });

  test('에러 → 한국어 메시지 throw', async () => {
    const supabase = buildMock({ data: null, error: { message: 'permission denied' } });
    await expect(fetchCalendarPreference(supabase as never, USER_ID)).rejects.toThrow(
      /설정/,
    );
  });
});
