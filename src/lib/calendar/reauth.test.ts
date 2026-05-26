// S06-ui-reauth-modal — isGoogleReauthNeeded helper tests.

import { isGoogleReauthNeeded } from './reauth';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

interface UserResult {
  data: { calendar_preference: string | null } | null;
  error: { message: string } | null;
}

interface TokenResult {
  data: { user_id: string } | null;
  error: { message: string } | null;
}

function buildSupabaseMock(user: UserResult, token: TokenResult): { from: jest.Mock } {
  const userSingle = jest.fn().mockResolvedValue(user);
  const userEq = jest.fn().mockReturnValue({ single: userSingle });
  const userSelect = jest.fn().mockReturnValue({ eq: userEq });

  const tokenMaybeSingle = jest.fn().mockResolvedValue(token);
  const tokenEq2 = jest.fn().mockReturnValue({ maybeSingle: tokenMaybeSingle });
  const tokenEq1 = jest.fn().mockReturnValue({ eq: tokenEq2 });
  const tokenSelect = jest.fn().mockReturnValue({ eq: tokenEq1 });

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'users') return { select: userSelect };
    if (table === 'user_oauth_tokens') return { select: tokenSelect };
    throw new Error(`unexpected table ${table}`);
  });
  return { from };
}

describe('isGoogleReauthNeeded', () => {
  test('preference=null → false (사용자가 아직 선택 안 함, FirstTimeModal 영역)', async () => {
    const supabase = buildSupabaseMock(
      { data: { calendar_preference: null }, error: null },
      { data: null, error: null },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(false);
  });

  test('preference="none" → false', async () => {
    const supabase = buildSupabaseMock(
      { data: { calendar_preference: 'none' }, error: null },
      { data: null, error: null },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(false);
  });

  test('preference="apple_ios" → false (Google 무관)', async () => {
    const supabase = buildSupabaseMock(
      { data: { calendar_preference: 'apple_ios' }, error: null },
      { data: null, error: null },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(false);
  });

  test('preference="google" + token row 존재 → false', async () => {
    const supabase = buildSupabaseMock(
      { data: { calendar_preference: 'google' }, error: null },
      { data: { user_id: USER_ID }, error: null },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(false);
  });

  test('preference="google" + token row 없음 → true (reauth 필요)', async () => {
    const supabase = buildSupabaseMock(
      { data: { calendar_preference: 'google' }, error: null },
      { data: null, error: null },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(true);
  });

  test('preference="both" + token row 없음 → true', async () => {
    const supabase = buildSupabaseMock(
      { data: { calendar_preference: 'both' }, error: null },
      { data: null, error: null },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(true);
  });

  test('preference="both" + token row 존재 → false', async () => {
    const supabase = buildSupabaseMock(
      { data: { calendar_preference: 'both' }, error: null },
      { data: { user_id: USER_ID }, error: null },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(false);
  });

  test('users 조회 에러 → false (silent — 모달 노출 X, 다음 회 재시도)', async () => {
    const supabase = buildSupabaseMock(
      { data: null, error: { message: 'permission denied' } },
      { data: null, error: null },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(false);
  });

  test('user_oauth_tokens 조회 에러 → false (silent)', async () => {
    const supabase = buildSupabaseMock(
      { data: { calendar_preference: 'google' }, error: null },
      { data: null, error: { message: 'rls' } },
    );
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(false);
  });

  test('users row 자체가 null → false (방어적)', async () => {
    const supabase = buildSupabaseMock({ data: null, error: null }, { data: null, error: null });
    expect(await isGoogleReauthNeeded(supabase as never, USER_ID)).toBe(false);
  });
});
