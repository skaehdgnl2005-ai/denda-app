// expoNotifications — Expo Push token 등록 + push_tokens upsert + permission (S12-client).
//
// 동작:
//   1. iOS/Android만 (web 미지원)
//   2. getPermissionsAsync → granted=false면 requestPermissionsAsync
//   3. granted=true 시 getExpoPushTokenAsync({projectId}) → ExponentPushToken[...]
//   4. push_tokens UPSERT (ON CONFLICT user_id, token) → 동일 디바이스 재등록 안전
//
// expo-notifications + react-native는 본 lib에서 lazy require — Jest 환경 안전.
// 본 lib는 DI 우선 — production wiring은 setup 헬퍼에서 dynamicRequire로 결합.

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Type contracts (DI)
// ---------------------------------------------------------------------------

export interface ExpoNotificationsApi {
  getPermissionsAsync(): Promise<{ granted: boolean }>;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  getExpoPushTokenAsync(opts: { projectId: string }): Promise<{ data: string }>;
  setNotificationHandler(handler: unknown): void;
}

export interface PlatformApi {
  OS: 'ios' | 'android' | 'web' | 'windows' | 'macos';
}

export type Platform = 'ios' | 'android';

// ---------------------------------------------------------------------------
// 순수 함수
// ---------------------------------------------------------------------------

export interface BuildPushTokenRowArgs {
  userId: string;
  token: string;
  platform: Platform;
}

export interface PushTokenRow {
  user_id: string;
  token: string;
  platform: Platform;
}

export function buildPushTokenRow(args: BuildPushTokenRowArgs): PushTokenRow {
  return {
    user_id: args.userId,
    token: args.token,
    platform: args.platform,
  };
}

// ---------------------------------------------------------------------------
// registerForPushNotifications — 통합 flow
// ---------------------------------------------------------------------------

export interface RegisterArgs {
  userId: string;
  supabase: SupabaseClient;
  notifications: ExpoNotificationsApi;
  platform: PlatformApi;
  projectId: string;
}

export interface RegisterResult {
  granted: boolean;
  token: string | null;
}

/**
 * 권한 + 토큰 + push_tokens UPSERT 통합.
 *
 * - iOS/Android만 처리. web/기타 platform은 silent granted=false (web-guest는 게스트 page라 push 알림 비대상)
 * - getPermissionsAsync(현재 상태) granted=true면 request 생략
 * - granted=false → upsert skip + result.token=null
 * - upsert ON CONFLICT user_id,token → 동일 디바이스 재등록 안전
 */
export async function registerForPushNotifications(
  args: RegisterArgs,
): Promise<RegisterResult> {
  if (!args.userId.trim()) {
    throw new Error('userId가 필요해요.');
  }

  const os = args.platform.OS;
  if (os !== 'ios' && os !== 'android') {
    return { granted: false, token: null };
  }

  // 1) permission
  const current = await args.notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const requested = await args.notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) {
    return { granted: false, token: null };
  }

  // 2) Expo push token
  const tokenResult = await args.notifications.getExpoPushTokenAsync({
    projectId: args.projectId,
  });
  const token = tokenResult.data;

  // 3) push_tokens UPSERT (RLS — 본인만 INSERT/UPDATE)
  const row = buildPushTokenRow({
    userId: args.userId,
    token,
    platform: os,
  });
  const { error } = await args.supabase
    .from('push_tokens')
    .upsert(row, { onConflict: 'user_id,token' });
  if (error) {
    throw new Error(`푸시 토큰 저장 실패: ${error.message}`);
  }

  return { granted: true, token };
}

// ---------------------------------------------------------------------------
// dynamicRequire 어댑터 (production wiring)
// ---------------------------------------------------------------------------

// Metro 프로덕션 번들러는 require(변수)를 거부 → 호출부에서 `() => require('pkg')` thunk로 전달
// (리터럴 문자열). require는 factory 호출 시에만 실행 → cold start(D25) 영향 없음.
function loadOptionalModule<T = unknown>(load: () => T, packageName: string): T {
  try {
    return load();
  } catch {
    throw new Error(
      `${packageName} 패키지가 설치되지 않았어요. 다음 EAS Build 시점에 \`npx expo install ${packageName}\`을 실행해 주세요.`,
    );
  }
}

/**
 * expo-notifications 모듈을 lazy require로 가져와 `ExpoNotificationsApi` shape으로 wrap.
 */
export function createExpoNotificationsApi(): ExpoNotificationsApi {
  const mod = loadOptionalModule(
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    () => require('expo-notifications'),
    'expo-notifications',
  ) as {
    getPermissionsAsync: () => Promise<{ status: string; granted?: boolean }>;
    requestPermissionsAsync: () => Promise<{ status: string; granted?: boolean }>;
    getExpoPushTokenAsync: (opts: {
      projectId: string;
    }) => Promise<{ data: string }>;
    setNotificationHandler: (handler: unknown) => void;
  };
  const isGranted = (r: { status: string; granted?: boolean }) =>
    r.granted ?? r.status === 'granted';
  return {
    getPermissionsAsync: async () => ({
      granted: isGranted(await mod.getPermissionsAsync()),
    }),
    requestPermissionsAsync: async () => ({
      granted: isGranted(await mod.requestPermissionsAsync()),
    }),
    getExpoPushTokenAsync: (opts) => mod.getExpoPushTokenAsync(opts),
    setNotificationHandler: (handler) => mod.setNotificationHandler(handler),
  };
}

/**
 * react-native Platform을 lazy require.
 */
export function createPlatformApi(): PlatformApi {
  const mod = loadOptionalModule(
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    () => require('react-native'),
    'react-native',
  ) as {
    Platform: { OS: PlatformApi['OS'] };
  };
  return { OS: mod.Platform.OS };
}
