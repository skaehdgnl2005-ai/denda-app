// KakaoOIDCProvider — D29 카카오 OIDC + Supabase signInWithIdToken 구현.
//
// 의존성은 모두 주입 (DI). 이유: 네이티브 SDK와 Supabase 클라이언트를
// 직접 import 시 jest에서 native 모듈 모킹 비용이 크고, S16 fallback (Apple)을
// 같은 패턴으로 추가하기 위해서다.
//
// 실제 wiring (네이티브 SDK + supabase client)은 `src/lib/auth/setup.ts`에서.

import {
  type AuthProvider,
  type AuthSession,
  type AuthSignInResult,
  type AuthUser,
  AuthError,
} from './AuthProvider';

// ---------------------------------------------------------------------------
// 외부 의존성 타입 (interface 최소 면)
// ---------------------------------------------------------------------------

type KakaoLoginResponse = {
  idToken: string;
  accessToken: string;
};

type KakaoLoginRequest = {
  scopes: string[];
  nonce: string;
};

type SupabaseUserMetadata = Record<string, unknown>;

type SupabaseUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  user_metadata: SupabaseUserMetadata;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  // Unix epoch SECONDS (Supabase convention). 우리는 ms로 변환해 노출.
  expires_at: number;
  user: SupabaseUser;
};

type SignInWithIdTokenArgs = {
  provider: 'kakao';
  token: string;
  nonce: string;
};

type SignInWithIdTokenResult = {
  data: { user: SupabaseUser | null; session: SupabaseSession | null };
  error: { message: string } | null;
};

type SignOutResult = { error: { message: string } | null };

export type KakaoOIDCSupabaseAuth = {
  signInWithIdToken(args: SignInWithIdTokenArgs): Promise<SignInWithIdTokenResult>;
  signOut(): Promise<SignOutResult>;
};

export type KakaoOIDCDeps = {
  kakaoNativeAppKey: string;
  generateNonce: () => Promise<string>;
  initKakaoSDK: (nativeAppKey: string) => Promise<void>;
  kakaoLogin: (request: KakaoLoginRequest) => Promise<KakaoLoginResponse>;
  kakaoLogout: () => Promise<void>;
  supabaseAuth: KakaoOIDCSupabaseAuth;
};

// ---------------------------------------------------------------------------
// 구현
// ---------------------------------------------------------------------------

const KAKAO_OIDC_SCOPES = ['openid', 'profile_nickname'];
// isNewUser 휴리스틱: created_at과 last_sign_in_at이 1초 이내면 첫 로그인.
const NEW_USER_WINDOW_MS = 1000;

export class KakaoOIDCProvider implements AuthProvider {
  readonly providerName = 'kakao' as const;

  private initPromise: Promise<void> | null = null;

  constructor(private readonly deps: KakaoOIDCDeps) {}

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.deps.initKakaoSDK(this.deps.kakaoNativeAppKey).catch((error) => {
      // init 실패 시 다음 호출에서 재시도 가능하도록 promise 초기화
      this.initPromise = null;
      throw new AuthError({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Kakao SDK 초기화 실패',
      });
    });
    return this.initPromise;
  }

  async signIn(): Promise<AuthSignInResult> {
    await this.initialize();

    const nonce = await this.deps.generateNonce();

    let kakaoResponse: KakaoLoginResponse;
    try {
      kakaoResponse = await this.deps.kakaoLogin({ scopes: KAKAO_OIDC_SCOPES, nonce });
    } catch (error) {
      if (isCancellationError(error)) {
        throw new AuthError({ kind: 'cancelled' });
      }
      throw new AuthError({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Kakao 로그인 실패',
      });
    }

    const result = await this.deps.supabaseAuth.signInWithIdToken({
      provider: 'kakao',
      token: kakaoResponse.idToken,
      nonce,
    });

    if (result.error) {
      throw new AuthError({ kind: 'invalid_token', message: result.error.message });
    }

    const { user, session } = result.data;
    if (!user || !session) {
      throw new AuthError({
        kind: 'unknown',
        message: 'Supabase 응답에 user/session 없음',
      });
    }

    return {
      session: mapToAuthSession(user, session),
      isNewUser: detectNewUser(user),
    };
  }

  async signOut(): Promise<void> {
    // best-effort: Kakao 실패해도 Supabase는 시도
    try {
      await this.deps.kakaoLogout();
    } catch {
      // swallow — 다음 라인 Supabase signOut 계속
    }
    await this.deps.supabaseAuth.signOut();
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mapToAuthSession(user: SupabaseUser, session: SupabaseSession): AuthSession {
  const meta = user.user_metadata ?? {};
  return {
    user: {
      id: user.id,
      kakaoId: stringClaim(meta, 'sub'),
      nickname: nicknameWithFallback(meta),
      email: user.email,
      profileImageUrl: stringClaim(meta, 'picture'),
    } satisfies AuthUser,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at * 1000,
  };
}

function stringClaim(meta: SupabaseUserMetadata, key: string): string | null {
  const value = meta[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nicknameWithFallback(meta: SupabaseUserMetadata): string {
  return (
    stringClaim(meta, 'nickname') ??
    stringClaim(meta, 'name') ??
    stringClaim(meta, 'preferred_username') ??
    '익명'
  );
}

function detectNewUser(user: SupabaseUser): boolean {
  if (!user.last_sign_in_at) {
    return true;
  }
  const created = Date.parse(user.created_at);
  const lastSignIn = Date.parse(user.last_sign_in_at);
  if (Number.isNaN(created) || Number.isNaN(lastSignIn)) {
    return false;
  }
  return Math.abs(lastSignIn - created) <= NEW_USER_WINDOW_MS;
}

function isCancellationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const errObj = error as { code?: unknown; message?: unknown };
  const code = typeof errObj.code === 'string' ? errObj.code : '';
  const message = typeof errObj.message === 'string' ? errObj.message : '';
  return code === 'KakaoLoginCancelled' || code === 'CANCELLED' || /cancel(led)?/i.test(message);
}
