// setup — server token RPC wrapper + signInGoogleAndUpload 흐름 unit tests.
//
// Adapter factory(createGoogleCalendarProvider/createAppleCalendarProvider)는
// dynamic require에 의존 — EAS Build 후 실 동작 검증. 본 ship test는 server-side
// RPC + storage read flow에 집중.

import { CalendarProviderError, GOOGLE_TOKEN_STORAGE_KEY } from './google';
import type { GoogleCalendarProvider, GoogleTokenStorage } from './google';
import {
  deleteGoogleTokensFromServer,
  signInGoogleAndUpload,
  uploadGoogleTokensToServer,
} from './setup';

// ---------------------------------------------------------------------------
// supabase mock
// ---------------------------------------------------------------------------

interface MockSupabaseOpts {
  rpcError?: { message: string } | null;
  deleteError?: { message: string } | null;
  authUserId?: string | null;
}

function makeSupabaseMock(opts: MockSupabaseOpts = {}) {
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];
  const deleteCalls: { table: string; filters: Record<string, unknown> }[] = [];

  const rpc = jest.fn().mockImplementation((name: string, params: Record<string, unknown>) => {
    rpcCalls.push({ name, params });
    return Promise.resolve({ data: null, error: opts.rpcError ?? null });
  });

  const deleteEqEq = jest.fn();
  const from = jest.fn().mockImplementation((table: string) => ({
    delete: jest.fn().mockImplementation(() => ({
      eq: jest.fn().mockImplementation((col1: string, val1: unknown) => ({
        eq: jest.fn().mockImplementation((col2: string, val2: unknown) => {
          deleteCalls.push({
            table,
            filters: { [col1]: val1, [col2]: val2 },
          });
          deleteEqEq();
          return Promise.resolve({ data: null, error: opts.deleteError ?? null });
        }),
      })),
    })),
  }));

  const auth = {
    getUser: jest.fn().mockResolvedValue(
      opts.authUserId === null
        ? { data: { user: null }, error: null }
        : { data: { user: { id: opts.authUserId ?? 'user-self' } }, error: null },
    ),
  };

  return {
    client: { rpc, from, auth } as unknown as Parameters<typeof uploadGoogleTokensToServer>[0],
    rpcCalls,
    deleteCalls,
  };
}

// ---------------------------------------------------------------------------
// uploadGoogleTokensToServer
// ---------------------------------------------------------------------------

describe('uploadGoogleTokensToServer', () => {
  const state = {
    accessToken: 'atok',
    refreshToken: 'rtok',
    expiresAtMs: 1779613200000, // → 2026-05-24T09:00:00.000Z
    scope: 'https://www.googleapis.com/auth/calendar.events',
  };

  it('RPC `upsert_user_oauth_tokens` 호출 + 모든 params 직렬화', async () => {
    const { client, rpcCalls } = makeSupabaseMock();
    await uploadGoogleTokensToServer(client, state);
    expect(rpcCalls).toEqual([
      {
        name: 'upsert_user_oauth_tokens',
        params: {
          p_provider: 'google_calendar',
          p_access_token: 'atok',
          p_refresh_token: 'rtok',
          p_expires_at: '2026-05-24T09:00:00.000Z',
          p_scope: 'https://www.googleapis.com/auth/calendar.events',
        },
      },
    ]);
  });

  it('RPC error → CalendarProviderError(network)', async () => {
    const { client } = makeSupabaseMock({ rpcError: { message: 'db oops' } });
    await expect(uploadGoogleTokensToServer(client, state)).rejects.toBeInstanceOf(
      CalendarProviderError,
    );
    try {
      await uploadGoogleTokensToServer(client, state);
    } catch (err) {
      expect(err).toBeInstanceOf(CalendarProviderError);
      expect((err as CalendarProviderError).detail.kind).toBe('network');
    }
  });
});

// ---------------------------------------------------------------------------
// deleteGoogleTokensFromServer
// ---------------------------------------------------------------------------

describe('deleteGoogleTokensFromServer', () => {
  it('본인 row DELETE — user_id + provider filter', async () => {
    const { client, deleteCalls } = makeSupabaseMock({ authUserId: 'user-self' });
    await deleteGoogleTokensFromServer(client);
    expect(deleteCalls).toEqual([
      {
        table: 'user_oauth_tokens',
        filters: { user_id: 'user-self', provider: 'google_calendar' },
      },
    ]);
  });

  it('비로그인 → CalendarProviderError(unauthorized)', async () => {
    const { client } = makeSupabaseMock({ authUserId: null });
    await expect(deleteGoogleTokensFromServer(client)).rejects.toBeInstanceOf(
      CalendarProviderError,
    );
    try {
      await deleteGoogleTokensFromServer(client);
    } catch (err) {
      expect((err as CalendarProviderError).detail.kind).toBe('unauthorized');
    }
  });

  it('DELETE error → CalendarProviderError(network)', async () => {
    const { client } = makeSupabaseMock({
      authUserId: 'user-self',
      deleteError: { message: 'db oops' },
    });
    await expect(deleteGoogleTokensFromServer(client)).rejects.toBeInstanceOf(
      CalendarProviderError,
    );
    try {
      await deleteGoogleTokensFromServer(client);
    } catch (err) {
      expect((err as CalendarProviderError).detail.kind).toBe('network');
    }
  });
});

// ---------------------------------------------------------------------------
// signInGoogleAndUpload
// ---------------------------------------------------------------------------

function makeStorageMock(initial: string | null = null): GoogleTokenStorage & {
  __setRaw: (value: string | null) => void;
  __reads: string[];
} {
  let raw = initial;
  const reads: string[] = [];
  return {
    getItemAsync: jest.fn().mockImplementation((key: string) => {
      reads.push(key);
      return Promise.resolve(raw);
    }),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
    __setRaw: (value) => {
      raw = value;
    },
    __reads: reads,
  };
}

function makeProviderMock(opts: {
  authorizeImpl?: () => Promise<void>;
}): GoogleCalendarProvider {
  return {
    providerName: 'google' as const,
    authorize: jest.fn().mockImplementation(opts.authorizeImpl ?? (() => Promise.resolve())),
    isAuthorized: jest.fn().mockResolvedValue(true),
    insertEvent: jest.fn(),
    signOut: jest.fn(),
  } as unknown as GoogleCalendarProvider;
}

describe('signInGoogleAndUpload', () => {
  const validRaw = JSON.stringify({
    accessToken: 'atok',
    refreshToken: 'rtok',
    expiresAtMs: 1779613200000,
    scope: 'scope-x',
  });

  it('정상: authorize → storage read → uploadGoogleTokensToServer 호출', async () => {
    const provider = makeProviderMock({});
    const storage = makeStorageMock();
    (storage.setItemAsync as jest.Mock).mockImplementation(async () => {
      // authorize 시점에 storage가 set 된 것처럼 시뮬레이션
    });
    storage.__setRaw(validRaw);
    const { client, rpcCalls } = makeSupabaseMock();

    await signInGoogleAndUpload({ provider, storage, supabase: client });

    expect(provider.authorize).toHaveBeenCalledTimes(1);
    expect(storage.__reads).toEqual([GOOGLE_TOKEN_STORAGE_KEY]);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe('upsert_user_oauth_tokens');
  });

  it('authorize throw → upload 호출 안 됨', async () => {
    const provider = makeProviderMock({
      authorizeImpl: () =>
        Promise.reject(new CalendarProviderError({ kind: 'cancelled' })),
    });
    const storage = makeStorageMock();
    const { client, rpcCalls } = makeSupabaseMock();

    await expect(
      signInGoogleAndUpload({ provider, storage, supabase: client }),
    ).rejects.toBeInstanceOf(CalendarProviderError);
    expect(rpcCalls).toEqual([]);
  });

  it('storage read null → CalendarProviderError(unknown), upload 호출 안 됨', async () => {
    const provider = makeProviderMock({});
    const storage = makeStorageMock(null);
    const { client, rpcCalls } = makeSupabaseMock();

    await expect(
      signInGoogleAndUpload({ provider, storage, supabase: client }),
    ).rejects.toBeInstanceOf(CalendarProviderError);
    try {
      await signInGoogleAndUpload({ provider, storage, supabase: client });
    } catch (err) {
      expect((err as CalendarProviderError).detail.kind).toBe('unknown');
    }
    expect(rpcCalls).toEqual([]);
  });

  it('storage read malformed JSON → CalendarProviderError(unknown)', async () => {
    const provider = makeProviderMock({});
    const storage = makeStorageMock();
    storage.__setRaw('not-json');
    const { client, rpcCalls } = makeSupabaseMock();

    await expect(
      signInGoogleAndUpload({ provider, storage, supabase: client }),
    ).rejects.toBeInstanceOf(CalendarProviderError);
    expect(rpcCalls).toEqual([]);
  });

  it('upload RPC error → CalendarProviderError(network) 전파', async () => {
    const provider = makeProviderMock({});
    const storage = makeStorageMock(validRaw);
    const { client } = makeSupabaseMock({ rpcError: { message: 'db read fail' } });

    await expect(
      signInGoogleAndUpload({ provider, storage, supabase: client }),
    ).rejects.toBeInstanceOf(CalendarProviderError);
    try {
      await signInGoogleAndUpload({ provider, storage, supabase: client });
    } catch (err) {
      expect((err as CalendarProviderError).detail.kind).toBe('network');
    }
  });
});
