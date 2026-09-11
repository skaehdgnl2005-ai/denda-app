// expoNotifications — token 등록 + push_tokens upsert + permission Jest tests
//
// expo-notifications 패키지는 본 lib 안에서 dynamicRequire(lazy)이고,
// 본 test는 모든 expo-notifications/react-native API를 DI로 주입해 검증한다.

import {
  buildPushTokenRow,
  registerForPushNotifications,
  type ExpoNotificationsApi,
  type PlatformApi,
} from './expoNotifications';

// ---------------------------------------------------------------------------
// buildPushTokenRow — push_tokens UPSERT row 빌드
// ---------------------------------------------------------------------------

describe('buildPushTokenRow', () => {
  it('user_id + token + platform 포함', () => {
    const row = buildPushTokenRow({
      userId: 'u1',
      token: 'ExponentPushToken[abc]',
      platform: 'ios',
    });
    expect(row.user_id).toBe('u1');
    expect(row.token).toBe('ExponentPushToken[abc]');
    expect(row.platform).toBe('ios');
  });

  it('platform=android', () => {
    const row = buildPushTokenRow({
      userId: 'u1',
      token: 'ExponentPushToken[abc]',
      platform: 'android',
    });
    expect(row.platform).toBe('android');
  });
});

// ---------------------------------------------------------------------------
// registerForPushNotifications — 통합 flow
// ---------------------------------------------------------------------------

interface MockUpsertResult {
  error: { message: string } | null;
}

function makeMockSupabase(upsertResult: MockUpsertResult = { error: null }) {
  const calls: { table: string; rows: unknown; onConflict?: string }[] = [];
  const supabase = {
    from(table: string) {
      return {
        upsert(rows: unknown, opts?: { onConflict?: string }) {
          calls.push({ table, rows, onConflict: opts?.onConflict });
          return Promise.resolve(upsertResult);
        },
      };
    },
  };
  return { supabase, calls };
}

function makeMockNotifications(opts: {
  permissionsResult?: { granted: boolean };
  tokenResult?: { data: string };
  setNotificationHandlerCalled?: { called: boolean };
}): ExpoNotificationsApi {
  return {
    getPermissionsAsync: () =>
      Promise.resolve({
        granted: opts.permissionsResult?.granted ?? false,
      }),
    requestPermissionsAsync: () =>
      Promise.resolve({
        granted: opts.permissionsResult?.granted ?? true,
      }),
    getExpoPushTokenAsync: () =>
      Promise.resolve(opts.tokenResult ?? { data: 'ExponentPushToken[stub]' }),
    setNotificationHandler: () => {
      if (opts.setNotificationHandlerCalled) {
        opts.setNotificationHandlerCalled.called = true;
      }
    },
  };
}

const mockPlatformIos: PlatformApi = { OS: 'ios' };
const mockPlatformAndroid: PlatformApi = { OS: 'android' };
const mockPlatformWeb: PlatformApi = { OS: 'web' };

describe('registerForPushNotifications', () => {
  it('granted=true → token upsert 후 token 반환', async () => {
    const { supabase, calls } = makeMockSupabase();
    const notifications = makeMockNotifications({
      permissionsResult: { granted: true },
      tokenResult: { data: 'ExponentPushToken[ios-1]' },
    });

    const result = await registerForPushNotifications({
      userId: 'u1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      notifications,
      platform: mockPlatformIos,
      projectId: 'denda-proj',
    });

    expect(result.granted).toBe(true);
    expect(result.token).toBe('ExponentPushToken[ios-1]');
    expect(calls).toHaveLength(1);
    const [first] = calls;
    expect(first?.table).toBe('push_tokens');
    expect(first?.rows).toEqual({
      user_id: 'u1',
      token: 'ExponentPushToken[ios-1]',
      platform: 'ios',
    });
    expect(first?.onConflict).toBe('user_id,token');
  });

  it('permission denied → token fetch/upsert skip + granted=false', async () => {
    const { supabase, calls } = makeMockSupabase();
    const notifications = makeMockNotifications({
      permissionsResult: { granted: false },
    });

    const result = await registerForPushNotifications({
      userId: 'u1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      notifications,
      platform: mockPlatformIos,
      projectId: 'denda-proj',
    });

    expect(result.granted).toBe(false);
    expect(result.token).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('platform=android → upsert row.platform=android', async () => {
    const { supabase, calls } = makeMockSupabase();
    const notifications = makeMockNotifications({
      permissionsResult: { granted: true },
      tokenResult: { data: 'ExponentPushToken[android-1]' },
    });

    await registerForPushNotifications({
      userId: 'u1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      notifications,
      platform: mockPlatformAndroid,
      projectId: 'denda-proj',
    });

    const [first] = calls;
    expect((first?.rows as { platform: string } | undefined)?.platform).toBe('android');
  });

  it('platform=web → 본 베타에서 미지원 → granted=false silent', async () => {
    const { supabase, calls } = makeMockSupabase();
    const notifications = makeMockNotifications({
      permissionsResult: { granted: true },
    });

    const result = await registerForPushNotifications({
      userId: 'u1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      notifications,
      platform: mockPlatformWeb,
      projectId: 'denda-proj',
    });

    expect(result.granted).toBe(false);
    expect(result.token).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('upsert error → 에러 propagate', async () => {
    const { supabase } = makeMockSupabase({
      error: { message: 'permission denied' },
    });
    const notifications = makeMockNotifications({
      permissionsResult: { granted: true },
      tokenResult: { data: 'ExponentPushToken[err]' },
    });

    await expect(
      registerForPushNotifications({
        userId: 'u1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: supabase as any,
        notifications,
        platform: mockPlatformIos,
        projectId: 'denda-proj',
      }),
    ).rejects.toThrow();
  });

  it('userId 빈 문자열 → 한국어 에러', async () => {
    const { supabase } = makeMockSupabase();
    const notifications = makeMockNotifications({
      permissionsResult: { granted: true },
    });
    await expect(
      registerForPushNotifications({
        userId: '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: supabase as any,
        notifications,
        platform: mockPlatformIos,
        projectId: 'denda-proj',
      }),
    ).rejects.toThrow();
  });

  it('getPermissionsAsync granted=true → requestPermissionsAsync 호출 skip', async () => {
    const { supabase, calls } = makeMockSupabase();
    let requestCalled = false;
    const notifications: ExpoNotificationsApi = {
      getPermissionsAsync: () => Promise.resolve({ granted: true }),
      requestPermissionsAsync: () => {
        requestCalled = true;
        return Promise.resolve({ granted: true });
      },
      getExpoPushTokenAsync: () => Promise.resolve({ data: 'ExponentPushToken[cached]' }),
      setNotificationHandler: () => {},
    };

    const result = await registerForPushNotifications({
      userId: 'u1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      notifications,
      platform: mockPlatformIos,
      projectId: 'denda-proj',
    });

    expect(result.granted).toBe(true);
    expect(requestCalled).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
