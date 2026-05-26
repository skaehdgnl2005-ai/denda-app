// GoogleCalendarProvider 단위 테스트.
// expo-auth-session · expo-secure-store · fetch 모두 의존성 주입(DI)으로 모킹.
//
// 커버리지:
//   순수 함수
//     1. isTokenExpired — skew window 60초 default
//     2. buildGoogleEvent — CalendarEventPayload → Google event format (Asia/Seoul timezone)
//     3. parseStoredToken — JSON parse + schema 검증 (malformed/partial 방어)
//   GoogleCalendarProvider
//     4. isAuthorized — storage 비어 있음 / valid token / expired access but refresh 있음 / malformed
//     5. authorize — happy path / cancel / network 실패
//     6. insertEvent — fresh access → POST happy / expired access → refresh → POST /
//                       refresh fails(invalid_grant) → token_expired / 401 / 429 / 네트워크 / no-token
//     7. signOut — happy(revoke + delete) / no-token (no-op) / revoke 실패 시에도 delete

import {
  buildGoogleEvent,
  CalendarProviderError,
  type CalendarEventPayload,
  GoogleCalendarProvider,
  type GoogleCalendarDeps,
  type GoogleOAuthClient,
  type GoogleTokenStorage,
  isTokenExpired,
  parseStoredToken,
} from './google';

const FIXED_NOW_MS = 1_770_000_000_000; // 임의 unix ms
const ONE_HOUR_MS = 3_600_000;
const STORAGE_KEY = 'denda_google_calendar_token';

const FRESH_TOKEN_JSON = JSON.stringify({
  accessToken: 'access-fresh',
  refreshToken: 'refresh-1',
  expiresAtMs: FIXED_NOW_MS + ONE_HOUR_MS,
  scope: 'https://www.googleapis.com/auth/calendar.events',
});

const EXPIRED_TOKEN_JSON = JSON.stringify({
  accessToken: 'access-expired',
  refreshToken: 'refresh-1',
  expiresAtMs: FIXED_NOW_MS - 5 * 60 * 1000, // 5분 전 만료
  scope: 'https://www.googleapis.com/auth/calendar.events',
});

// ---------------------------------------------------------------------------
// 순수 함수
// ---------------------------------------------------------------------------

describe('isTokenExpired', () => {
  const skewMs = 60_000;
  const baseState = {
    accessToken: 'a',
    refreshToken: 'r',
    expiresAtMs: FIXED_NOW_MS + ONE_HOUR_MS,
    scope: 'https://www.googleapis.com/auth/calendar.events',
  };

  it('만료까지 1시간 남음 → false', () => {
    expect(isTokenExpired(baseState, FIXED_NOW_MS, skewMs)).toBe(false);
  });

  it('이미 5분 전 만료 → true', () => {
    const state = { ...baseState, expiresAtMs: FIXED_NOW_MS - 5 * 60 * 1000 };
    expect(isTokenExpired(state, FIXED_NOW_MS, skewMs)).toBe(true);
  });

  it('만료까지 30초 남음(skew 60s 안) → true', () => {
    const state = { ...baseState, expiresAtMs: FIXED_NOW_MS + 30_000 };
    expect(isTokenExpired(state, FIXED_NOW_MS, skewMs)).toBe(true);
  });

  it('default skew는 60초', () => {
    const expiringIn30s = { ...baseState, expiresAtMs: FIXED_NOW_MS + 30_000 };
    expect(isTokenExpired(expiringIn30s, FIXED_NOW_MS)).toBe(true);
    const expiringIn120s = { ...baseState, expiresAtMs: FIXED_NOW_MS + 120_000 };
    expect(isTokenExpired(expiringIn120s, FIXED_NOW_MS)).toBe(false);
  });
});

describe('buildGoogleEvent', () => {
  const payload: CalendarEventPayload = {
    title: '동아리 회식',
    startUtcIso: '2026-05-26T11:00:00.000Z', // KST 20:00
    endUtcIso: '2026-05-26T13:00:00.000Z', // KST 22:00
    descriptionKo: '[된다] 2026년 5월 26일 (화) 20:00 ~ 22:00 KST',
    locationName: '안암 본관',
  };

  it('기본: summary/description/location/start/end 모두 매핑 + timeZone Asia/Seoul', () => {
    const event = buildGoogleEvent(payload);
    expect(event.summary).toBe('동아리 회식');
    expect(event.description).toBe('[된다] 2026년 5월 26일 (화) 20:00 ~ 22:00 KST');
    expect(event.location).toBe('안암 본관');
    expect(event.start).toEqual({
      dateTime: '2026-05-26T11:00:00.000Z',
      timeZone: 'Asia/Seoul',
    });
    expect(event.end).toEqual({
      dateTime: '2026-05-26T13:00:00.000Z',
      timeZone: 'Asia/Seoul',
    });
  });

  it('locationName null → location 키 자체 생략 (Google API spec)', () => {
    const event = buildGoogleEvent({ ...payload, locationName: null });
    expect(event.location).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(event, 'location')).toBe(false);
  });

  it('빈 title → throw (preserve invariant)', () => {
    expect(() => buildGoogleEvent({ ...payload, title: '' })).toThrow(/title/i);
    expect(() => buildGoogleEvent({ ...payload, title: '   ' })).toThrow(/title/i);
  });
});

describe('parseStoredToken', () => {
  it('valid JSON → GoogleTokenState 반환', () => {
    const state = parseStoredToken(FRESH_TOKEN_JSON);
    expect(state).not.toBeNull();
    expect(state?.accessToken).toBe('access-fresh');
    expect(state?.refreshToken).toBe('refresh-1');
    expect(state?.expiresAtMs).toBe(FIXED_NOW_MS + ONE_HOUR_MS);
  });

  it('null 입력 → null (storage 빈 경우)', () => {
    expect(parseStoredToken(null)).toBeNull();
  });

  it('malformed JSON → null (방어적)', () => {
    expect(parseStoredToken('{not json')).toBeNull();
    expect(parseStoredToken('null')).toBeNull();
  });

  it('필수 필드 누락 → null', () => {
    expect(parseStoredToken('{}')).toBeNull();
    expect(parseStoredToken(JSON.stringify({ accessToken: 'a' }))).toBeNull();
    expect(
      parseStoredToken(
        JSON.stringify({
          accessToken: 'a',
          refreshToken: 'r',
          expiresAtMs: 'not-a-number',
          scope: 's',
        }),
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GoogleCalendarProvider — DI 헬퍼
// ---------------------------------------------------------------------------

function makeStorage(initial: Record<string, string> = {}): GoogleTokenStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
}

function makeOAuth(overrides: Partial<GoogleOAuthClient> = {}): GoogleOAuthClient {
  return {
    authorize: jest.fn().mockResolvedValue({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresInSeconds: 3600,
      scope: 'https://www.googleapis.com/auth/calendar.events',
    }),
    refresh: jest.fn().mockResolvedValue({
      accessToken: 'access-refreshed',
      expiresInSeconds: 3600,
    }),
    revoke: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFetchOk(eventId = 'evt-abc'): jest.Mock {
  return jest.fn(
    async () =>
      new Response(JSON.stringify({ id: eventId }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

function makeDeps(overrides: Partial<GoogleCalendarDeps> = {}): GoogleCalendarDeps {
  return {
    oauth: makeOAuth(),
    storage: makeStorage(),
    fetch: makeFetchOk() as unknown as typeof globalThis.fetch,
    now: () => FIXED_NOW_MS,
    ...overrides,
  };
}

const EVENT_PAYLOAD: CalendarEventPayload = {
  title: '동아리 회식',
  startUtcIso: '2026-05-26T11:00:00.000Z',
  endUtcIso: '2026-05-26T13:00:00.000Z',
  descriptionKo: '[된다] 2026년 5월 26일 (화) 20:00 ~ 22:00 KST',
  locationName: '안암 본관',
};

// ---------------------------------------------------------------------------
// isAuthorized
// ---------------------------------------------------------------------------

describe('GoogleCalendarProvider.isAuthorized', () => {
  it('storage 비어 있음 → false', async () => {
    const provider = new GoogleCalendarProvider(makeDeps());
    expect(await provider.isAuthorized()).toBe(false);
  });

  it('valid token 저장됨 → true', async () => {
    const provider = new GoogleCalendarProvider(
      makeDeps({ storage: makeStorage({ [STORAGE_KEY]: FRESH_TOKEN_JSON }) }),
    );
    expect(await provider.isAuthorized()).toBe(true);
  });

  it('access 만료됐지만 refresh_token 있음 → true (refresh 가능)', async () => {
    const provider = new GoogleCalendarProvider(
      makeDeps({ storage: makeStorage({ [STORAGE_KEY]: EXPIRED_TOKEN_JSON }) }),
    );
    expect(await provider.isAuthorized()).toBe(true);
  });

  it('malformed JSON 저장됨 → false (방어적)', async () => {
    const provider = new GoogleCalendarProvider(
      makeDeps({ storage: makeStorage({ [STORAGE_KEY]: '{garbage' }) }),
    );
    expect(await provider.isAuthorized()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// authorize
// ---------------------------------------------------------------------------

describe('GoogleCalendarProvider.authorize', () => {
  it('happy: oauth.authorize → storage에 token 저장', async () => {
    const storage = makeStorage();
    const oauth = makeOAuth();
    const provider = new GoogleCalendarProvider(makeDeps({ storage, oauth }));

    await provider.authorize();

    expect(oauth.authorize).toHaveBeenCalledWith([
      'https://www.googleapis.com/auth/calendar.events',
    ]);
    expect(storage.setItemAsync).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"accessToken":"access-new"'),
    );
    const calls = (storage.setItemAsync as jest.Mock).mock.calls;
    const stored = JSON.parse(calls[0][1]);
    expect(stored.accessToken).toBe('access-new');
    expect(stored.refreshToken).toBe('refresh-new');
    expect(stored.expiresAtMs).toBe(FIXED_NOW_MS + 3600 * 1000);
    expect(stored.scope).toBe('https://www.googleapis.com/auth/calendar.events');
  });

  it('사용자 cancel → CalendarProviderError({kind:cancelled})', async () => {
    const cancelErr = Object.assign(new Error('user cancelled'), {
      code: 'CANCELLED',
    });
    const oauth = makeOAuth({
      authorize: jest.fn().mockRejectedValue(cancelErr),
    });
    const provider = new GoogleCalendarProvider(makeDeps({ oauth }));

    await expect(provider.authorize()).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'cancelled' },
    });
  });

  it('네트워크 실패 → CalendarProviderError({kind:network})', async () => {
    const oauth = makeOAuth({
      authorize: jest.fn().mockRejectedValue(new Error('ENOTFOUND')),
    });
    const provider = new GoogleCalendarProvider(makeDeps({ oauth }));

    await expect(provider.authorize()).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'network', message: expect.stringContaining('ENOTFOUND') },
    });
  });
});

// ---------------------------------------------------------------------------
// insertEvent
// ---------------------------------------------------------------------------

describe('GoogleCalendarProvider.insertEvent', () => {
  function makeProvider(
    opts: {
      storedToken?: string;
      fetchImpl?: jest.Mock;
      oauthOverrides?: Partial<GoogleOAuthClient>;
    } = {},
  ) {
    const storage = makeStorage(opts.storedToken ? { [STORAGE_KEY]: opts.storedToken } : {});
    const oauth = makeOAuth(opts.oauthOverrides);
    const fetchMock = opts.fetchImpl ?? makeFetchOk();
    const provider = new GoogleCalendarProvider(
      makeDeps({
        storage,
        oauth,
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      }),
    );
    return { provider, storage, oauth, fetchMock };
  }

  it('fresh access_token → 바로 POST events.insert', async () => {
    const { provider, oauth, fetchMock } = makeProvider({
      storedToken: FRESH_TOKEN_JSON,
    });

    const result = await provider.insertEvent(EVENT_PAYLOAD);

    expect(oauth.refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer access-fresh');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.summary).toBe('동아리 회식');
    expect(body.start.timeZone).toBe('Asia/Seoul');
    expect(result).toEqual({ eventId: 'evt-abc' });
  });

  it('access 만료 → oauth.refresh 호출 → 갱신된 token으로 POST + storage 갱신', async () => {
    const { provider, storage, oauth, fetchMock } = makeProvider({
      storedToken: EXPIRED_TOKEN_JSON,
    });

    await provider.insertEvent(EVENT_PAYLOAD);

    expect(oauth.refresh).toHaveBeenCalledWith('refresh-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer access-refreshed',
    );

    // storage가 갱신됐는지
    const setCall = (storage.setItemAsync as jest.Mock).mock.calls.pop();
    const stored = JSON.parse(setCall[1]);
    expect(stored.accessToken).toBe('access-refreshed');
    expect(stored.refreshToken).toBe('refresh-1'); // refresh token 유지
    expect(stored.expiresAtMs).toBe(FIXED_NOW_MS + 3600 * 1000);
  });

  it('refresh 실패 (invalid_grant) → token_expired + storage 삭제', async () => {
    const refreshErr = Object.assign(new Error('invalid_grant'), {
      code: 'invalid_grant',
    });
    const { provider, storage } = makeProvider({
      storedToken: EXPIRED_TOKEN_JSON,
      oauthOverrides: {
        refresh: jest.fn().mockRejectedValue(refreshErr),
      },
    });

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'token_expired' },
    });
    expect(storage.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('Google 401 응답 → unauthorized + storage 삭제', async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response('{"error":{"code":401,"message":"Invalid Credentials"}}', {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const { provider, storage } = makeProvider({
      storedToken: FRESH_TOKEN_JSON,
      fetchImpl: fetchMock,
    });

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'unauthorized' },
    });
    expect(storage.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('Google 429 응답 → rate_limit (storage 유지)', async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response('{"error":{"code":429,"message":"Rate Limit"}}', {
          status: 429,
        }),
    );
    const { provider, storage } = makeProvider({
      storedToken: FRESH_TOKEN_JSON,
      fetchImpl: fetchMock,
    });

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'rate_limit' },
    });
    expect(storage.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('네트워크 fetch reject → network 에러', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('fetch failed'));
    const { provider } = makeProvider({
      storedToken: FRESH_TOKEN_JSON,
      fetchImpl: fetchMock,
    });

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'network', message: expect.stringContaining('fetch failed') },
    });
  });

  it('저장된 token 없음 → unauthorized (authorize 호출 안 함)', async () => {
    const { provider, oauth, fetchMock } = makeProvider();

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'unauthorized' },
    });
    expect(oauth.authorize).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('500 응답 → unknown 에러', async () => {
    const fetchMock = jest.fn(
      async () => new Response('{"error":{"message":"oops"}}', { status: 500 }),
    );
    const { provider } = makeProvider({
      storedToken: FRESH_TOKEN_JSON,
      fetchImpl: fetchMock,
    });

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'unknown' },
    });
  });
});

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

describe('GoogleCalendarProvider.signOut', () => {
  it('happy: revoke 호출 + storage 삭제', async () => {
    const storage = makeStorage({ [STORAGE_KEY]: FRESH_TOKEN_JSON });
    const oauth = makeOAuth();
    const provider = new GoogleCalendarProvider(makeDeps({ storage, oauth }));

    await provider.signOut();

    expect(oauth.revoke).toHaveBeenCalledWith('refresh-1');
    expect(storage.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('저장된 token 없음 → revoke 미호출 + delete만 시도 (no-op safe)', async () => {
    const storage = makeStorage();
    const oauth = makeOAuth();
    const provider = new GoogleCalendarProvider(makeDeps({ storage, oauth }));

    await provider.signOut();

    expect(oauth.revoke).not.toHaveBeenCalled();
    expect(storage.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('revoke 실패해도 storage는 삭제 (best-effort)', async () => {
    const storage = makeStorage({ [STORAGE_KEY]: FRESH_TOKEN_JSON });
    const oauth = makeOAuth({
      revoke: jest.fn().mockRejectedValue(new Error('revoke failed')),
    });
    const provider = new GoogleCalendarProvider(makeDeps({ storage, oauth }));

    await provider.signOut();

    expect(storage.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });
});

// ---------------------------------------------------------------------------
// CalendarProviderError 클래스 동작 — instanceof check + name
// ---------------------------------------------------------------------------

describe('CalendarProviderError', () => {
  it('name=CalendarProviderError + detail 보존', () => {
    const err = new CalendarProviderError({ kind: 'cancelled' });
    expect(err.name).toBe('CalendarProviderError');
    expect(err.detail).toEqual({ kind: 'cancelled' });
    expect(err).toBeInstanceOf(Error);
  });

  it('message는 detail.kind에 따라 한국어', () => {
    expect(new CalendarProviderError({ kind: 'cancelled' }).message).toMatch(/취소/);
    expect(new CalendarProviderError({ kind: 'token_expired' }).message).toMatch(/재인증|로그인/);
  });
});
