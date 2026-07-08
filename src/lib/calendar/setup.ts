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
 * 패키지를 lazy load — require 인자는 **리터럴 문자열**이어야 한다 (thunk로 전달).
 * Metro 프로덕션 번들러는 `require(변수)`를 거부(Invalid call)하므로 호출부에서
 * `() => require('pkg')` 형태로 넘긴다. 미설치 시 한국어 에러 wrap. require는 함수 내부
 * (factory 호출 시)에만 실행 → cold start(D25) 영향 없음.
 */
function loadOptionalModule<T = unknown>(load: () => T, packageName: string): T {
  try {
    return load();
  } catch {
    throw new Error(
      `${packageName} 패키지가 설치되지 않았어요. 다음 EAS Build 시점에 \`npx expo install ${packageName}\`을 실행해 주세요.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Google OAuth adapter — expo-auth-session 기반
// ---------------------------------------------------------------------------

export interface GoogleOAuthConfig {
  /** Google Cloud Console에서 발급받은 OAuth client id (web type 또는 ios/android). */
  clientId: string;
  /** OAuth redirect URI. expo-auth-session의 `makeRedirectUri()` 결과 권장. */
  redirectUri: string;
  /** scope list. default = ['https://www.googleapis.com/auth/calendar.events']. */
  scopes?: string[];
}

/**
 * Google OAuth 2.0 discovery endpoints. fetchDiscoveryAsync 호출 절약 위해 인라인.
 * https://accounts.google.com/.well-known/openid-configuration 의 subset.
 */
const GOOGLE_OAUTH_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
} as const;

const DEFAULT_GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// expo-auth-session SDK 56 minimal type surface (실제 패키지 type을 import하지 않고
// 사용처별 contract만 명시 — 미설치 환경 type compile 가드).
interface ExpoAuthSessionApi {
  AuthRequest: new (config: {
    clientId: string;
    scopes: string[];
    redirectUri: string;
    responseType: string;
    usePKCE: boolean;
    codeChallengeMethod?: string;
    extraParams?: Record<string, string>;
  }) => {
    codeVerifier?: string;
    promptAsync: (discovery: typeof GOOGLE_OAUTH_DISCOVERY) => Promise<{
      type: 'success' | 'cancel' | 'dismiss' | 'error' | 'locked';
      params?: { code?: string; error?: string };
    }>;
  };
  ResponseType: { Code: string };
  CodeChallengeMethod: { S256: string };
  exchangeCodeAsync: (
    config: {
      clientId: string;
      code: string;
      redirectUri: string;
      extraParams?: Record<string, string>;
    },
    discovery: typeof GOOGLE_OAUTH_DISCOVERY,
  ) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    scope?: string;
  }>;
  refreshAsync: (
    config: { clientId: string; refreshToken: string },
    discovery: typeof GOOGLE_OAUTH_DISCOVERY,
  ) => Promise<{
    accessToken: string;
    expiresIn?: number;
  }>;
  revokeAsync: (
    config: { token: string; clientId: string },
    discovery: typeof GOOGLE_OAUTH_DISCOVERY,
  ) => Promise<boolean>;
}

/**
 * production 환경에서 GoogleOAuthClient 어댑터 생성.
 *
 * expo-auth-session API (SDK 56, package.json `expo-auth-session ~56.0.12`):
 *   - `AuthRequest` (PKCE + S256) + `promptAsync(discovery)` → code 응답
 *   - `exchangeCodeAsync({code, code_verifier}, discovery)` → access + refresh
 *   - `refreshAsync` / `revokeAsync` (Google revocation endpoint)
 *
 * Google 특화 OAuth 파라미터:
 *   - `access_type=offline` — refresh_token 필수 발급
 *   - `prompt=consent` — 사용자가 이전에 동의한 적 있어도 refresh_token 재발급 보장
 *     (Google은 기본적으로 첫 동의 후 refresh_token을 한 번만 줌)
 *
 * 미설치 시 createGoogleCalendarProvider 호출 시점에 한국어 에러 wrap throw → UI 모달이 표시.
 */
function createGoogleOAuthClient(config: GoogleOAuthConfig): GoogleOAuthClient {
  const api = loadOptionalModule<ExpoAuthSessionApi>(
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    () => require('expo-auth-session'),
    'expo-auth-session',
  );

  const scopes = config.scopes ?? DEFAULT_GOOGLE_SCOPES;

  return {
    async authorize(requestScopes): Promise<GoogleOAuthGrant> {
      // requestScopes(GoogleCalendarProvider가 정의)를 우선, fallback config.scopes.
      const effectiveScopes = requestScopes.length > 0 ? requestScopes : scopes;

      const request = new api.AuthRequest({
        clientId: config.clientId,
        scopes: effectiveScopes,
        redirectUri: config.redirectUri,
        responseType: api.ResponseType.Code,
        usePKCE: true,
        codeChallengeMethod: api.CodeChallengeMethod.S256,
        // Google refresh_token 발급 보장 + 기존 동의 재요청
        extraParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      });

      const result = await request.promptAsync(GOOGLE_OAUTH_DISCOVERY);
      if (result.type !== 'success' || !result.params?.code) {
        const reason =
          result.type === 'cancel' || result.type === 'dismiss'
            ? '사용자가 Google 로그인을 취소했어요.'
            : result.params?.error
              ? `Google 로그인 실패: ${result.params.error}`
              : 'Google 로그인을 완료하지 못했어요.';
        throw new Error(reason);
      }
      if (!request.codeVerifier) {
        // usePKCE: true이면 항상 set되지만 type guard.
        throw new Error('PKCE code_verifier 누락 — expo-auth-session 내부 상태 오류.');
      }

      const token = await api.exchangeCodeAsync(
        {
          clientId: config.clientId,
          code: result.params.code,
          redirectUri: config.redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        GOOGLE_OAUTH_DISCOVERY,
      );

      if (!token.refreshToken) {
        // 동의 후 refresh_token 미수신은 access_type=offline + prompt=consent 누락 외엔 발생 X.
        // Google이 이전 grant를 재사용하면 발생 가능 → 사용자에게 재인증 안내.
        throw new Error('Google이 refresh_token을 발급하지 않았어요. 잠시 후 다시 시도해 주세요.');
      }

      return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresInSeconds: token.expiresIn ?? 3600,
        scope: token.scope ?? effectiveScopes.join(' '),
      };
    },

    async refresh(refreshToken): Promise<GoogleOAuthAccessTokenResponse> {
      const refreshed = await api.refreshAsync(
        { clientId: config.clientId, refreshToken },
        GOOGLE_OAUTH_DISCOVERY,
      );
      return {
        accessToken: refreshed.accessToken,
        expiresInSeconds: refreshed.expiresIn ?? 3600,
      };
    },

    async revoke(refreshToken): Promise<void> {
      // revokeAsync는 boolean을 반환하지만 best-effort라 결과 무시.
      await api.revokeAsync(
        { token: refreshToken, clientId: config.clientId },
        GOOGLE_OAUTH_DISCOVERY,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// expo-secure-store adapter
// ---------------------------------------------------------------------------

function createSecureStoreAdapter(): GoogleTokenStorage {
  const mod = loadOptionalModule(
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    () => require('expo-secure-store'),
    'expo-secure-store',
  ) as {
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

/**
 * SecureStore에 저장된 Google 캘린더 토큰(access·refresh)을 기기에서 제거한다.
 * 회원 탈퇴 teardown용 — 서버 user_oauth_tokens 행은 계정 삭제 cascade로 지워지지만,
 * 기기에 남은 refresh_token(살아있는 제3자 자격증명)까지 정리해 잔여 PII/공유기기 누출을 막는다.
 */
export async function clearStoredGoogleToken(): Promise<void> {
  const storage = createSecureStoreAdapter();
  await storage.deleteItemAsync(GOOGLE_TOKEN_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// expo-calendar adapter
// ---------------------------------------------------------------------------

function createExpoCalendarApi(): AppleCalendarApi {
  const mod = loadOptionalModule(
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    () => require('expo-calendar'),
    'expo-calendar',
  ) as {
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
    loadOptionalModule(
      // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
      () => require('react-native'),
      'react-native',
    ) as {
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
