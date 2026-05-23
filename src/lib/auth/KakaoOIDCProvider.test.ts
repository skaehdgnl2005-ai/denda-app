// KakaoOIDCProvider 단위 테스트.
// 네이티브 SDK · Supabase Auth 모두 의존성 주입으로 모킹.
//
// 커버리지:
//   1. signIn happy path → AuthSignInResult 반환
//   2. nonce 생성 → Kakao SDK · Supabase 둘 다 같은 nonce 전달
//   3. Kakao SDK cancel → AuthError({ kind: 'cancelled' })
//   4. Supabase 검증 실패 → AuthError({ kind: 'invalid_token' })
//   5. Supabase 응답에 session 없음 → AuthError({ kind: 'unknown' })
//   6. signOut → Kakao + Supabase 둘 다 호출
//   7. initialize → kakao SDK init 1회만 (idempotent)
//   8. isNewUser 휴리스틱 (created_at ≈ last_sign_in_at 1초 윈도)

import { AuthError } from './AuthProvider';
import { KakaoOIDCProvider, type KakaoOIDCDeps } from './KakaoOIDCProvider';

const FIXED_NONCE = '00000000-0000-4000-8000-000000000001';
const TEST_KAKAO_KEY = 'test-kakao-native-key';

type SupabaseUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  user_metadata: Record<string, unknown>;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  user: SupabaseUser;
};

function makeUser(overrides: Partial<SupabaseUser> = {}): SupabaseUser {
  return {
    id: 'uuid-1234',
    email: null,
    created_at: '2026-05-23T10:00:00Z',
    last_sign_in_at: '2026-05-23T10:00:00Z',
    user_metadata: {
      sub: 'kakao-9876',
      nickname: '홍길동',
      picture: 'https://example.com/pic.jpg',
    },
    ...overrides,
  };
}

function makeSession(userOverrides: Partial<SupabaseUser> = {}): SupabaseSession {
  return {
    access_token: 'access-jwt',
    refresh_token: 'refresh-jwt',
    expires_at: 1747958400, // 2026-05-23 + 1h (unix seconds)
    user: makeUser(userOverrides),
  };
}

function makeDeps(overrides: Partial<KakaoOIDCDeps> = {}): KakaoOIDCDeps {
  return {
    kakaoNativeAppKey: TEST_KAKAO_KEY,
    generateNonce: jest.fn().mockResolvedValue(FIXED_NONCE),
    initKakaoSDK: jest.fn().mockResolvedValue(undefined),
    kakaoLogin: jest.fn().mockResolvedValue({
      idToken: 'fake-id-token',
      accessToken: 'fake-access-token',
    }),
    kakaoLogout: jest.fn().mockResolvedValue(undefined),
    supabaseAuth: {
      signInWithIdToken: jest.fn().mockResolvedValue({
        data: { user: makeUser(), session: makeSession() },
        error: null,
      }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    ...overrides,
  };
}

describe('KakaoOIDCProvider', () => {
  describe('initialize()', () => {
    it('네이티브 SDK init을 1회만 호출 (idempotent)', async () => {
      const deps = makeDeps();
      const provider = new KakaoOIDCProvider(deps);

      await provider.initialize();
      await provider.initialize();
      await provider.initialize();

      expect(deps.initKakaoSDK).toHaveBeenCalledTimes(1);
      expect(deps.initKakaoSDK).toHaveBeenCalledWith(TEST_KAKAO_KEY);
    });

    it('초기화 실패 시 AuthError(network) throw', async () => {
      const deps = makeDeps({
        initKakaoSDK: jest.fn().mockRejectedValue(new Error('SDK init failed')),
      });
      const provider = new KakaoOIDCProvider(deps);

      await expect(provider.initialize()).rejects.toBeInstanceOf(AuthError);
      await expect(provider.initialize()).rejects.toMatchObject({
        detail: { kind: 'network' },
      });
    });
  });

  describe('signIn()', () => {
    it('happy path — 카카오 로그인 → Supabase 검증 → 세션 반환', async () => {
      const deps = makeDeps();
      const provider = new KakaoOIDCProvider(deps);

      const result = await provider.signIn();

      expect(result.session.user.id).toBe('uuid-1234');
      expect(result.session.user.kakaoId).toBe('kakao-9876');
      expect(result.session.user.nickname).toBe('홍길동');
      expect(result.session.user.email).toBeNull();
      expect(result.session.user.profileImageUrl).toBe('https://example.com/pic.jpg');
      expect(result.session.accessToken).toBe('access-jwt');
      expect(result.session.refreshToken).toBe('refresh-jwt');
      expect(result.session.expiresAt).toBe(1747958400 * 1000);
    });

    it('signIn 전 자동으로 SDK init', async () => {
      const deps = makeDeps();
      const provider = new KakaoOIDCProvider(deps);

      await provider.signIn();

      expect(deps.initKakaoSDK).toHaveBeenCalledTimes(1);
    });

    it('OIDC scope=openid+profile_nickname + nonce를 Kakao SDK에 전달', async () => {
      const deps = makeDeps();
      const provider = new KakaoOIDCProvider(deps);

      await provider.signIn();

      expect(deps.kakaoLogin).toHaveBeenCalledWith({
        scopes: ['openid', 'profile_nickname'],
        nonce: FIXED_NONCE,
      });
    });

    it('Kakao SDK가 받은 nonce와 같은 nonce를 Supabase로 전달 (replay 방지)', async () => {
      const deps = makeDeps();
      const provider = new KakaoOIDCProvider(deps);

      await provider.signIn();

      expect(deps.supabaseAuth.signInWithIdToken).toHaveBeenCalledWith({
        provider: 'kakao',
        token: 'fake-id-token',
        nonce: FIXED_NONCE,
      });
    });

    it('사용자 취소 시 AuthError(cancelled)', async () => {
      const cancelError = new Error('user cancelled');
      // @react-native-kakao 패키지는 cancel 시 보통 message에 "cancelled" 포함
      Object.assign(cancelError, { code: 'KakaoLoginCancelled' });
      const deps = makeDeps({
        kakaoLogin: jest.fn().mockRejectedValue(cancelError),
      });
      const provider = new KakaoOIDCProvider(deps);

      await expect(provider.signIn()).rejects.toBeInstanceOf(AuthError);
      await expect(provider.signIn()).rejects.toMatchObject({
        detail: { kind: 'cancelled' },
      });
    });

    it('Supabase 검증 실패 → AuthError(invalid_token)', async () => {
      const deps = makeDeps({
        supabaseAuth: {
          signInWithIdToken: jest.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: { message: 'invalid nonce' },
          }),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      });
      const provider = new KakaoOIDCProvider(deps);

      await expect(provider.signIn()).rejects.toMatchObject({
        detail: { kind: 'invalid_token', message: 'invalid nonce' },
      });
    });

    it('Supabase가 session 없이 user만 반환하면 AuthError(unknown)', async () => {
      const deps = makeDeps({
        supabaseAuth: {
          signInWithIdToken: jest.fn().mockResolvedValue({
            data: { user: makeUser(), session: null },
            error: null,
          }),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      });
      const provider = new KakaoOIDCProvider(deps);

      await expect(provider.signIn()).rejects.toMatchObject({
        detail: { kind: 'unknown' },
      });
    });

    it('isNewUser=true: created_at과 last_sign_in_at이 1초 이내', async () => {
      const deps = makeDeps({
        supabaseAuth: {
          signInWithIdToken: jest.fn().mockResolvedValue({
            data: {
              user: makeUser({
                created_at: '2026-05-23T10:00:00.000Z',
                last_sign_in_at: '2026-05-23T10:00:00.500Z',
              }),
              session: makeSession({
                created_at: '2026-05-23T10:00:00.000Z',
                last_sign_in_at: '2026-05-23T10:00:00.500Z',
              }),
            },
            error: null,
          }),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      });
      const provider = new KakaoOIDCProvider(deps);

      const result = await provider.signIn();
      expect(result.isNewUser).toBe(true);
    });

    it('isNewUser=false: 재로그인 (created_at과 last_sign_in_at 차이 큼)', async () => {
      const deps = makeDeps({
        supabaseAuth: {
          signInWithIdToken: jest.fn().mockResolvedValue({
            data: {
              user: makeUser({
                created_at: '2026-05-01T10:00:00Z',
                last_sign_in_at: '2026-05-23T10:00:00Z',
              }),
              session: makeSession({
                created_at: '2026-05-01T10:00:00Z',
                last_sign_in_at: '2026-05-23T10:00:00Z',
              }),
            },
            error: null,
          }),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      });
      const provider = new KakaoOIDCProvider(deps);

      const result = await provider.signIn();
      expect(result.isNewUser).toBe(false);
    });

    it('nickname fallback: nickname 없으면 name → preferred_username → 익명', async () => {
      const deps = makeDeps({
        supabaseAuth: {
          signInWithIdToken: jest.fn().mockResolvedValue({
            data: {
              user: makeUser({
                user_metadata: {
                  sub: 'kakao-9876',
                  name: '대체이름',
                },
              }),
              session: makeSession({
                user_metadata: {
                  sub: 'kakao-9876',
                  name: '대체이름',
                },
              }),
            },
            error: null,
          }),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      });
      const provider = new KakaoOIDCProvider(deps);

      const result = await provider.signIn();
      expect(result.session.user.nickname).toBe('대체이름');
    });

    it('nickname fallback chain 끝: 익명', async () => {
      const deps = makeDeps({
        supabaseAuth: {
          signInWithIdToken: jest.fn().mockResolvedValue({
            data: {
              user: makeUser({
                user_metadata: { sub: 'kakao-9876' },
              }),
              session: makeSession({
                user_metadata: { sub: 'kakao-9876' },
              }),
            },
            error: null,
          }),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      });
      const provider = new KakaoOIDCProvider(deps);

      const result = await provider.signIn();
      expect(result.session.user.nickname).toBe('익명');
    });
  });

  describe('signOut()', () => {
    it('Kakao + Supabase 둘 다 signOut 호출', async () => {
      const deps = makeDeps();
      const provider = new KakaoOIDCProvider(deps);

      await provider.signOut();

      expect(deps.kakaoLogout).toHaveBeenCalledTimes(1);
      expect(deps.supabaseAuth.signOut).toHaveBeenCalledTimes(1);
    });

    it('Kakao logout 실패해도 Supabase signOut은 시도 (best effort)', async () => {
      const deps = makeDeps({
        kakaoLogout: jest.fn().mockRejectedValue(new Error('SDK logout failed')),
      });
      const provider = new KakaoOIDCProvider(deps);

      await provider.signOut(); // throw 안 함

      expect(deps.supabaseAuth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('providerName', () => {
    it("'kakao'", () => {
      const provider = new KakaoOIDCProvider(makeDeps());
      expect(provider.providerName).toBe('kakao');
    });
  });
});
