// setup — production wiring 어댑터 (RN/Expo only).
//
// 책임:
//   1. createGoogleCalendarProvider — expo-auth-session + expo-secure-store + fetch + now DI로 GoogleCalendarProvider 인스턴스 생성. storage도 함께 expose(서버 업로드 wrapper용)
//   2. createAppleCalendarProvider — expo-calendar DI로 AppleCalendarProvider 인스턴스 생성
//   3. uploadGoogleTokensToServer — 클라가 OAuth 완료 후 `upsert_user_oauth_tokens` RPC 호출 → user_oauth_tokens row 저장 (D35)
//   4. deleteGoogleTokensFromServer — 본인 row DELETE (사용자가 캘린더 연결 해제 시)
//   5. signInGoogleAndUpload — authorize + storage read + uploadGoogleTokensToServer 묶음
//
// **다음 EAS Build 시점 lazy install 필요**:
//   npx expo install expo-auth-session expo-secure-store expo-calendar
//
// 본 lib는 dynamic require로 패키지 lazy load — 미설치 시 import-time throw 회피.
// Jest 환경에서는 require 자체가 실패할 수 있어 createXxx 함수는 호출 시 throw.
// Jest tests는 uploadGoogleTokensToServer/deleteGoogleTokensFromServer/signInGoogleAndUpload만 검증 — adapter factory는 EAS Build 후 실 동작 검증.

import { SupabaseClient } from '@supabase/supabase-js';

import { AppleCalendarProvider, type AppleCalendarApi } from './apple';
import {
  CalendarProviderError,
  GoogleCalendarProvider,
  type GoogleCalendarDeps,
  type GoogleOAuthAccessTokenResponse,
  type GoogleOAuthClient,
  type GoogleOAuthGrant,
  type GoogleTokenState,
  type GoogleTokenStorage,
  GOOGLE_TOKEN_STORAGE_KEY,
  parseStoredToken,
} from './google';

const GOOGLE_PROVIDER = 'google_calendar';

// ---------------------------------------------------------------------------
// dynamic require helpers — 패키지 미설치 시 한국어 에러
// ---------------------------------------------------------------------------

/**
 * `require`를 type assertion으로 우회. TS는 반환을 `any`로 취급 → 패키지 미설치 시점에
 * typecheck pass + runtime은 module not found throw (한국어 wrap).
 */
function dynamicRequire(packageName: string): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    return (require as (name: string) => unknown)(packageName);
  } catch {
    throw new Error(
      `${packageName} 패키지가 설치되지 않았어요. 다음 EAS Build 시점에 \`npx expo install ${packageName}\`을 실행해 주세요.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Google OAuth adapter — expo-auth-session 기반
// ---------------------------------------------------------------------------

/**
 * production 환경에서 GoogleOAuthClient 어댑터 생성.
 *
 * expo-auth-session API 가정 (subset, EAS Build 시 install 후 type check):
 *   - AuthRequest (만들기 + promptAsync)
 *   - exchangeCodeAsync / refreshAsync / revokeAsync
 *
 * EAS Build 미설치 시 require() throw → createGoogleCalendarProvider에서 전파.
 *
 * 본 함수의 정확한 expo-auth-session API binding은 EAS Build 시점에 검증.
 * 본 ship은 wrapper 구조만 정의 — production wiring 시 expo-auth-session config
 * (Google client id, redirect URI, scopes)와 함께 implement.
 */
function createGoogleOAuthClient(_config: GoogleOAuthConfig): GoogleOAuthClient {
  // 호출 시 패키지 require. 미설치 시 throw.
  dynamicRequire('expo-auth-session');

  return {
    async authorize(_scopes): Promise<GoogleOAuthGrant> {
      throw new Error(
        'createGoogleOAuthClient.authorize: expo-auth-session production wiring 필요. EAS Build 시점에 implement.',
      );
    },
    async refresh(_refreshToken): Promise<GoogleOAuthAccessTokenResponse> {
      throw new Error(
        'createGoogleOAuthClient.refresh: expo-auth-session production wiring 필요. EAS Build 시점에 implement.',
      );
    },
    async revoke(_refreshToken): Promise<void> {
      throw new Error(
        'createGoogleOAuthClient.revoke: expo-auth-session production wiring 필요. EAS Build 시점에 implement.',
      );
    },
  };
}

export interface GoogleOAuthConfig {
  /** Google Cloud Console에서 발급받은 OAuth client id (web type 또는 ios/android). */
  clientId: string;
  /** OAuth redirect URI (expo-auth-session 또는 native scheme). */
  redirectUri: string;
  /** scope list. default = ['https://www.googleapis.com/auth/calendar.events']. */
  scopes?: string[];
}

// ---------------------------------------------------------------------------
// expo-secure-store adapter
// ---------------------------------------------------------------------------

function createSecureStoreAdapter(): GoogleTokenStorage {
  const mod = dynamicRequire('expo-secure-store') as {
    getItemAsync: (key: string) => Promise<string | null>;
    setItemAsync: (key: string, value: string) => Promise<void>;
    deleteItemAsync: (key: string) => Promise<void>;
  };
  return {
    getItemAsync: (key) => mod.getItemAsync(key),
    setItemAsync: (key, value) => mod.setItemAsync(key, value),
    deleteItemAsync: (key) => mod.deleteItemAsync(key),
  };
}

// ---------------------------------------------------------------------------
// expo-calendar adapter
// ---------------------------------------------------------------------------

function createExpoCalendarApi(): AppleCalendarApi {
  const mod = dynamicRequire('expo-calendar') as {
    getCalendarPermissionsAsync: () => Promise<{ status: 'granted' | 'denied' | 'undetermined' }>;
    requestCalendarPermissionsAsync: () => Promise<{
      status: 'granted' | 'denied' | 'undetermined';
    }>;
    getDefaultCalendarAsync: () => Promise<{
      id: string;
      title: string;
      source: { name: string };
      allowsModifications: boolean;
    } | null>;
    getCalendarsAsync: (entityType?: string) => Promise<
      {
        id: string;
        title: string;
        source: { name: string };
        allowsModifications: boolean;
      }[]
    >;
    createEventAsync: (
      calendarId: string,
      event: {
        title: string;
        startDate: string;
        endDate: string;
        notes?: string;
        location?: string;
        timeZone: string;
      },
    ) => Promise<string>;
  };
  return {
    getCalendarPermissionsAsync: () => mod.getCalendarPermissionsAsync(),
    requestCalendarPermissionsAsync: () => mod.requestCalendarPermissionsAsync(),
    getDefaultCalendarAsync: () => mod.getDefaultCalendarAsync(),
    getCalendarsAsync: (entityType) => mod.getCalendarsAsync(entityType),
    createEventAsync: (calendarId, event) => mod.createEventAsync(calendarId, event),
  };
}

// ---------------------------------------------------------------------------
// Provider factories
// ---------------------------------------------------------------------------

export interface CreatedGoogleProvider {
  provider: GoogleCalendarProvider;
  /** signInGoogleAndUpload wrapper가 SecureStore에서 token 읽기 위해 expose. */
  storage: GoogleTokenStorage;
}

export interface CreateGoogleProviderArgs {
  oauthConfig: GoogleOAuthConfig;
  /** 테스트용 fetch DI override. default = globalThis.fetch. */
  fetchImpl?: typeof globalThis.fetch;
  /** 테스트용 now DI override. default = Date.now. */
  nowMs?: () => number;
}

export function createGoogleCalendarProvider(
  args: CreateGoogleProviderArgs,
): CreatedGoogleProvider {
  const storage = createSecureStoreAdapter();
  const oauth = createGoogleOAuthClient(args.oauthConfig);
  const deps: GoogleCalendarDeps = {
    oauth,
    storage,
    fetch: args.fetchImpl ?? globalThis.fetch.bind(globalThis),
    now: args.nowMs ?? (() => Date.now()),
  };
  return { provider: new GoogleCalendarProvider(deps), storage };
}

export function createAppleCalendarProvider(): AppleCalendarProvider {
  const api = createExpoCalendarApi();
  return new AppleCalendarProvider({ api });
}

// ---------------------------------------------------------------------------
// Server token storage (D35) — `upsert_user_oauth_tokens` RPC
// ---------------------------------------------------------------------------

export async function uploadGoogleTokensToServer(
  supabase: SupabaseClient,
  state: GoogleTokenState,
): Promise<void> {
  const { error } = await supabase.rpc('upsert_user_oauth_tokens', {
    p_provider: GOOGLE_PROVIDER,
    p_access_token: state.accessToken,
    p_refresh_token: state.refreshToken,
    p_expires_at: new Date(state.expiresAtMs).toISOString(),
    p_scope: state.scope,
  });
  if (error) {
    throw new CalendarProviderError({
      kind: 'network',
      message: `Google token 서버 업로드 실패: ${error.message}`,
    });
  }
}

export async function deleteGoogleTokensFromServer(supabase: SupabaseClient): Promise<void> {
  // user_id는 RLS로 자동 본인 행만. 단일 row 삭제 (provider unique).
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    throw new CalendarProviderError({ kind: 'unauthorized' });
  }
  const { error } = await supabase
    .from('user_oauth_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('provider', GOOGLE_PROVIDER);
  if (error) {
    throw new CalendarProviderError({
      kind: 'network',
      message: `Google token 서버 삭제 실패: ${error.message}`,
    });
  }
}

// ---------------------------------------------------------------------------
// AppState 어댑터 — react-native AppState → AppStateAdapter
// ---------------------------------------------------------------------------

/**
 * production 환경에서 react-native의 AppState API를 useApplePendingSync hook의
 * AppStateAdapter 인터페이스에 맞춰 wrap. dynamicRequire로 react-native lazy load —
 * Jest 환경에서는 호출되지 않음 (CalendarSyncRoot 테스트는 mock appState DI 사용).
 */
export function createAppStateAdapter(): import('./useApplePendingSync').AppStateAdapter {
  const RNAppState = (
    dynamicRequire('react-native') as {
      AppState: {
        currentState: string;
        addEventListener: (
          event: 'change',
          listener: (state: string) => void,
        ) => { remove: () => void };
      };
    }
  ).AppState;
  return {
    get currentState() {
      return RNAppState.currentState as import('./useApplePendingSync').AppStateStatus;
    },
    addEventListener(event, listener) {
      const sub = RNAppState.addEventListener(event, (state) =>
        listener(state as import('./useApplePendingSync').AppStateStatus),
      );
      return { remove: () => sub.remove() };
    },
  };
}

// ---------------------------------------------------------------------------
// signInGoogleAndUpload — authorize + storage read + server upload 묶음
// ---------------------------------------------------------------------------

export interface SignInGoogleAndUploadArgs {
  provider: GoogleCalendarProvider;
  storage: GoogleTokenStorage;
  supabase: SupabaseClient;
}

/**
 * UI 모달의 첫 모임 확정 후 "Google 캘린더 연결" 흐름:
 *   1. provider.authorize() → consent screen + SecureStore 저장
 *   2. SecureStore에서 token state 읽기
 *   3. uploadGoogleTokensToServer로 서버 row UPSERT
 *
 * 1·2·3 어디서든 throw 시 caller(UI 모달)가 한국어 에러 메시지 표시.
 */
export async function signInGoogleAndUpload(args: SignInGoogleAndUploadArgs): Promise<void> {
  await args.provider.authorize();

  const raw = await args.storage.getItemAsync(GOOGLE_TOKEN_STORAGE_KEY);
  const state = parseStoredToken(raw);
  if (!state) {
    throw new CalendarProviderError({
      kind: 'unknown',
      message: 'OAuth 완료 후 token 저장 실패.',
    });
  }
  await uploadGoogleTokensToServer(args.supabase, state);
}
