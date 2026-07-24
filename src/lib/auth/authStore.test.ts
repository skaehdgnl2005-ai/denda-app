// authStore 단위 테스트.
// 세션 부트스트랩 + 상태 전이 + 약관·온보딩 플래그를 검증.
//
// 외부 의존:
//   - AuthProvider (signIn/signOut/initialize) — 모킹
//   - SecureStore (저장·복원) — 모킹
//   - Supabase auth.getSession — 부트스트랩 시 세션 확인용 — 모킹

import { AuthError, type AuthProvider, type AuthSignInResult } from './AuthProvider';
import { createAuthStore } from './authStore';

const NOW_ISO = '2026-05-23T10:00:00.000Z';

function makeSignInResult(overrides: Partial<AuthSignInResult> = {}): AuthSignInResult {
  return {
    session: {
      user: {
        id: 'uuid-1234',
        kakaoId: 'kakao-9876',
        nickname: '홍길동',
        email: null,
        profileImageUrl: null,
      },
      accessToken: 'access-jwt',
      refreshToken: 'refresh-jwt',
      expiresAt: 1747958400_000,
    },
    isNewUser: true,
    ...overrides,
  };
}

function makeAuthProvider(overrides: Partial<AuthProvider> = {}): AuthProvider {
  return {
    providerName: 'kakao',
    initialize: jest.fn().mockResolvedValue(undefined),
    signIn: jest.fn().mockResolvedValue(makeSignInResult()),
    signOut: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItemAsync: jest.fn(async (key: string) => map.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      map.delete(key);
    }),
    _dump: () => Object.fromEntries(map),
  };
}

type TestDeps = {
  provider: AuthProvider;
  storage: ReturnType<typeof makeStorage>;
  now: () => Date;
};

function makeDeps(overrides: Partial<TestDeps> = {}): TestDeps {
  return {
    provider: makeAuthProvider(),
    storage: makeStorage(),
    now: () => new Date(NOW_ISO),
    ...overrides,
  };
}

describe('authStore', () => {
  describe('초기 상태', () => {
    it('status=initializing, session=null, hasAgreedToTerms=false', () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);

      const state = store.getState();
      expect(state.status).toBe('initializing');
      expect(state.session).toBeNull();
      expect(state.hasAgreedToTerms).toBe(false);
      expect(state.hasCompletedOnboarding).toBe(false);
    });
  });

  describe('bootstrap()', () => {
    it('저장된 약관·온보딩 플래그 복원', async () => {
      const deps = makeDeps();
      deps.storage = makeStorage({
        'denda.auth.terms_agreed_at': NOW_ISO,
        'denda.auth.onboarded': '1',
      });
      const store = createAuthStore({ ...deps });

      await store.getState().bootstrap();

      expect(store.getState().hasAgreedToTerms).toBe(true);
      expect(store.getState().hasCompletedOnboarding).toBe(true);
      expect(store.getState().termsAgreedAt).toBe(NOW_ISO);
    });

    it('저장된 플래그 없으면 모두 false', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);

      await store.getState().bootstrap();

      expect(store.getState().hasAgreedToTerms).toBe(false);
      expect(store.getState().hasCompletedOnboarding).toBe(false);
      expect(store.getState().status).toBe('signed_out');
    });

    it('Provider initialize 호출', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);

      await store.getState().bootstrap();

      expect(deps.provider.initialize).toHaveBeenCalledTimes(1);
    });

    it('restoreSession 미주입이면 status=signed_out (복원 생략)', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);

      await store.getState().bootstrap();

      expect(store.getState().status).toBe('signed_out');
    });

    it('restoreSession이 세션 반환 → signed_in + session 승격 (앱 재시작 로그인 유지)', async () => {
      const deps = makeDeps();
      const restored = makeSignInResult().session;
      const store = createAuthStore({ ...deps, restoreSession: async () => restored });

      await store.getState().bootstrap();

      expect(store.getState().status).toBe('signed_in');
      expect(store.getState().session).toEqual(restored);
    });

    it('restoreSession null → signed_out', async () => {
      const deps = makeDeps();
      const store = createAuthStore({ ...deps, restoreSession: async () => null });

      await store.getState().bootstrap();

      expect(store.getState().status).toBe('signed_out');
      expect(store.getState().session).toBeNull();
    });

    it('restoreSession throw → signed_out (fail-open, 크래시·무한 로딩 금지)', async () => {
      const deps = makeDeps();
      const store = createAuthStore({
        ...deps,
        restoreSession: async () => {
          throw new Error('secure store 잠김');
        },
      });

      await store.getState().bootstrap();

      expect(store.getState().status).toBe('signed_out');
    });

    it('storage 읽기 실패 → 플래그 기본값으로 완료 (무한 initializing 금지)', async () => {
      const deps = makeDeps();
      deps.storage.getItemAsync.mockRejectedValue(new Error('keychain 잠김'));
      const store = createAuthStore(deps);

      await store.getState().bootstrap();

      expect(store.getState().status).toBe('signed_out');
      expect(store.getState().hasAgreedToTerms).toBe(false);
    });

    it('provider.initialize 실패 → signed_out으로 완료 (로그인 화면 진입은 가능해야 함)', async () => {
      const deps = makeDeps();
      deps.provider = makeAuthProvider({
        initialize: jest.fn().mockRejectedValue(new AuthError({ kind: 'network', message: 'SDK 실패' })),
      });
      const store = createAuthStore(deps);

      await expect(store.getState().bootstrap()).resolves.toBeUndefined();
      expect(store.getState().status).toBe('signed_out');
    });

    it('bootstrap 중복 호출 idempotent', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);

      await Promise.all([
        store.getState().bootstrap(),
        store.getState().bootstrap(),
        store.getState().bootstrap(),
      ]);

      expect(deps.provider.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('agreeToTerms()', () => {
    it('hasAgreedToTerms=true, termsAgreedAt=now, SecureStore 저장', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);
      await store.getState().bootstrap();

      await store.getState().agreeToTerms();

      expect(store.getState().hasAgreedToTerms).toBe(true);
      expect(store.getState().termsAgreedAt).toBe(NOW_ISO);
      expect(deps.storage.setItemAsync).toHaveBeenCalledWith('denda.auth.terms_agreed_at', NOW_ISO);
    });
  });

  describe('completeOnboarding()', () => {
    it('hasCompletedOnboarding=true, SecureStore 저장', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);
      await store.getState().bootstrap();

      await store.getState().completeOnboarding();

      expect(store.getState().hasCompletedOnboarding).toBe(true);
      expect(deps.storage.setItemAsync).toHaveBeenCalledWith('denda.auth.onboarded', '1');
    });
  });

  describe('signIn()', () => {
    it('성공 → status=signed_in, session 설정', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);
      await store.getState().bootstrap();

      await store.getState().signIn();

      expect(store.getState().status).toBe('signed_in');
      expect(store.getState().session?.user.nickname).toBe('홍길동');
    });

    it('signIn 중 status=authenticating', async () => {
      let resolveSignIn: (value: AuthSignInResult) => void = () => {};
      const signInPromise = new Promise<AuthSignInResult>((resolve) => {
        resolveSignIn = resolve;
      });
      const deps = makeDeps({
        provider: makeAuthProvider({
          signIn: jest.fn().mockReturnValue(signInPromise),
        }),
      });
      const store = createAuthStore(deps);
      await store.getState().bootstrap();

      const inflight = store.getState().signIn();
      expect(store.getState().status).toBe('authenticating');

      resolveSignIn(makeSignInResult());
      await inflight;

      expect(store.getState().status).toBe('signed_in');
    });

    it('취소 → status=signed_out, error 없음 (사용자가 닫은 것뿐)', async () => {
      const deps = makeDeps({
        provider: makeAuthProvider({
          signIn: jest.fn().mockRejectedValue(new AuthError({ kind: 'cancelled' })),
        }),
      });
      const store = createAuthStore(deps);
      await store.getState().bootstrap();

      await expect(store.getState().signIn()).rejects.toBeInstanceOf(AuthError);

      expect(store.getState().status).toBe('signed_out');
      expect(store.getState().lastError).toBeNull();
    });

    it('네트워크 실패 → status=signed_out, lastError 설정', async () => {
      const error = new AuthError({ kind: 'network', message: '연결 실패' });
      const deps = makeDeps({
        provider: makeAuthProvider({
          signIn: jest.fn().mockRejectedValue(error),
        }),
      });
      const store = createAuthStore(deps);
      await store.getState().bootstrap();

      await expect(store.getState().signIn()).rejects.toBeInstanceOf(AuthError);

      expect(store.getState().status).toBe('signed_out');
      expect(store.getState().lastError?.kind).toBe('network');
    });

    it('성공 시 isNewUser 플래그 보존 (온보딩 로직이 사용)', async () => {
      const deps = makeDeps({
        provider: makeAuthProvider({
          signIn: jest.fn().mockResolvedValue(makeSignInResult({ isNewUser: true })),
        }),
      });
      const store = createAuthStore(deps);
      await store.getState().bootstrap();

      await store.getState().signIn();

      expect(store.getState().isNewUser).toBe(true);
    });
  });

  describe('signOut()', () => {
    it('session=null, status=signed_out, provider.signOut 호출', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);
      await store.getState().bootstrap();
      await store.getState().signIn();

      await store.getState().signOut();

      expect(store.getState().session).toBeNull();
      expect(store.getState().status).toBe('signed_out');
      expect(deps.provider.signOut).toHaveBeenCalledTimes(1);
    });

    it('signOut은 온보딩·약관 플래그 유지 (재로그인 시 다시 묻지 않음)', async () => {
      const deps = makeDeps();
      const store = createAuthStore(deps);
      await store.getState().bootstrap();
      await store.getState().agreeToTerms();
      await store.getState().completeOnboarding();
      await store.getState().signIn();

      await store.getState().signOut();

      expect(store.getState().hasAgreedToTerms).toBe(true);
      expect(store.getState().hasCompletedOnboarding).toBe(true);
    });
  });

  describe('resetForAccountDeletion()', () => {
    it('provider.signOut + 온보딩·약관 플래그 SecureStore 삭제 + state 리셋 (signOut과 달리 플래그 제거)', async () => {
      const deps = makeDeps();
      deps.storage = makeStorage({
        'denda.auth.terms_agreed_at': NOW_ISO,
        'denda.auth.onboarded': '1',
      });
      const store = createAuthStore({ ...deps });
      await store.getState().bootstrap();
      await store.getState().signIn();

      await store.getState().resetForAccountDeletion();

      expect(deps.provider.signOut).toHaveBeenCalledTimes(1);
      expect(deps.storage.deleteItemAsync).toHaveBeenCalledWith('denda.auth.terms_agreed_at');
      expect(deps.storage.deleteItemAsync).toHaveBeenCalledWith('denda.auth.onboarded');
      expect(store.getState().session).toBeNull();
      expect(store.getState().status).toBe('signed_out');
      expect(store.getState().hasAgreedToTerms).toBe(false);
      expect(store.getState().termsAgreedAt).toBeNull();
      expect(store.getState().hasCompletedOnboarding).toBe(false);
    });

    it('provider.signOut 실패해도 로컬 teardown 진행 (세션이 서버에서 이미 삭제됨)', async () => {
      const deps = makeDeps({
        provider: makeAuthProvider({
          signOut: jest.fn().mockRejectedValue(new Error('session already gone')),
        }),
      });
      deps.storage = makeStorage({
        'denda.auth.terms_agreed_at': NOW_ISO,
        'denda.auth.onboarded': '1',
      });
      const store = createAuthStore({ ...deps });
      await store.getState().bootstrap();

      await expect(store.getState().resetForAccountDeletion()).resolves.toBeUndefined();

      expect(deps.storage.deleteItemAsync).toHaveBeenCalledWith('denda.auth.terms_agreed_at');
      expect(deps.storage.deleteItemAsync).toHaveBeenCalledWith('denda.auth.onboarded');
      expect(store.getState().status).toBe('signed_out');
      expect(store.getState().hasAgreedToTerms).toBe(false);
      expect(store.getState().hasCompletedOnboarding).toBe(false);
    });

    it('SecureStore 삭제가 실패해도 state는 초기화된다 (탈퇴 후 무한 로딩 방지)', async () => {
      const deps = makeDeps();
      deps.storage = makeStorage({
        'denda.auth.terms_agreed_at': NOW_ISO,
        'denda.auth.onboarded': '1',
      });
      // 키체인 잠금 등으로 삭제가 rejeect되는 상황 — resetForAccountDeletion은 throw하지 않아야 한다.
      deps.storage.deleteItemAsync = jest.fn().mockRejectedValue(new Error('keychain locked'));
      const store = createAuthStore({ ...deps });
      await store.getState().bootstrap();
      await store.getState().signIn();

      await expect(store.getState().resetForAccountDeletion()).resolves.toBeUndefined();

      // 삭제가 실패해도 state는 반드시 초기화(set 도달) — 이미 삭제된 계정이므로.
      expect(store.getState().session).toBeNull();
      expect(store.getState().status).toBe('signed_out');
      expect(store.getState().hasAgreedToTerms).toBe(false);
      expect(store.getState().hasCompletedOnboarding).toBe(false);
    });
  });

  describe('clearError()', () => {
    it('lastError를 null로 reset', async () => {
      const deps = makeDeps({
        provider: makeAuthProvider({
          signIn: jest.fn().mockRejectedValue(new AuthError({ kind: 'network', message: 'x' })),
        }),
      });
      const store = createAuthStore(deps);
      await store.getState().bootstrap();
      await expect(store.getState().signIn()).rejects.toBeInstanceOf(AuthError);
      expect(store.getState().lastError).not.toBeNull();

      store.getState().clearError();

      expect(store.getState().lastError).toBeNull();
    });
  });
});
