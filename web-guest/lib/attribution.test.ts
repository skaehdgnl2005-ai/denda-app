import { logAttributionClick } from './attribution';

const SUPABASE_URL = 'https://example.supabase.co';
const SUPABASE_ANON_KEY = 'anon_test_key';
const VALID_UUID = '11111111-1111-1111-1111-111111111111';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
});

describe('logAttributionClick', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('POST to attribution_click_log Edge Function', async () => {
    await logAttributionClick({
      branchLinkId: 'token123',
      groupId: VALID_UUID,
      guestToken: VALID_UUID,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0];
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/attribution_click_log`);
  });

  it('body는 snake_case JSON', async () => {
    await logAttributionClick({
      branchLinkId: 'token123',
      groupId: VALID_UUID,
      guestToken: VALID_UUID,
    });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      branch_link_id: 'token123',
      group_id: VALID_UUID,
      guest_token: VALID_UUID,
    });
  });

  it('headers에 Content-Type + apikey', async () => {
    await logAttributionClick({
      branchLinkId: 'token123',
      groupId: VALID_UUID,
      guestToken: VALID_UUID,
    });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.apikey).toBe(SUPABASE_ANON_KEY);
    expect(init.headers.Authorization).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
  });

  it('500 응답도 silent (throw X) — UX 보호', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'fail' }),
    });
    await expect(
      logAttributionClick({
        branchLinkId: 'token123',
        groupId: VALID_UUID,
        guestToken: VALID_UUID,
      }),
    ).resolves.toEqual({ ok: false, error: 'attribution_click_log HTTP 500' });
  });

  it('network error 도 silent (throw X)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(
      logAttributionClick({
        branchLinkId: 'token123',
        groupId: VALID_UUID,
        guestToken: VALID_UUID,
      }),
    ).resolves.toEqual({ ok: false, error: 'network down' });
  });

  it('성공 시 { ok: true }', async () => {
    const res = await logAttributionClick({
      branchLinkId: 'token123',
      groupId: VALID_UUID,
      guestToken: VALID_UUID,
    });
    expect(res).toEqual({ ok: true });
  });
});
