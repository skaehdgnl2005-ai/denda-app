// authStore — 세션 + 약관 + 온보딩 상태 머신.
//
// 책임:
//   1. Provider.initialize()를 1회 호출 (앱 시작 시 bootstrap)
//   2. 약관 동의 / 온보딩 완료 플래그를 SecureStore에 영속
//   3. signIn/signOut 액션 + 상태 전이 (initializing → signed_out → authenticating → signed_in)
//   4. AuthError를 lastError에 보관 (cancelled는 보관 안 함)
//
// 명시적으로 하지 않는 것:
//   - Supabase 세션 자체의 복원: supabase-js가 자체 SecureStore를 사용 (config 시 supabase.auth
//     클라이언트에 storage adapter 주입). authStore는 그 위에 UI/온보딩 플래그만 얹는다.
//   - 토큰 refresh: Supabase가 자동.

import { createStore } from 'zustand/vanilla';

import {
  AuthError,
  type AuthProvider,
  type AuthProviderError,
  type AuthSession,
} from './AuthProvider';

const KEY_TERMS_AGREED_AT = 'denda.auth.terms_agreed_at';
const KEY_ONBOARDED = 'denda.auth.onboarded';

export type AuthStatus = 'initializing' | 'signed_out' | 'authenticating' | 'signed_in';

export type AuthStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type AuthStoreDeps = {
  provider: AuthProvider;
  storage: AuthStorage;
  // 테스트 시 deterministic time을 위해 주입. 프로덕션은 luxon DateTime.now()→toJSDate.
  now: () => Date;
  // 앱 시작 시 supabase가 디스크에서 복원한 세션을 store로 승격 (setup.ts에서 주입).
  // 미주입 시 복원 생략 — 항상 signed_out으로 시작.
  restoreSession?: () => Promise<AuthSession | null>;
};

export type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  hasAgreedToTerms: boolean;
  termsAgreedAt: string | null;
  hasCompletedOnboarding: boolean;
  isNewUser: boolean;
  lastError: AuthProviderError | null;

  bootstrap: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  resetForAccountDeletion: () => Promise<void>;
  agreeToTerms: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  clearError: () => void;
};

export function createAuthStore(deps: AuthStoreDeps) {
  let bootstrapPromise: Promise<void> | null = null;

  return createStore<AuthState>((set, get) => ({
    status: 'initializing',
    session: null,
    hasAgreedToTerms: false,
    termsAgreedAt: null,
    hasCompletedOnboarding: false,
    isNewUser: false,
    lastError: null,

    bootstrap: async () => {
      if (bootstrapPromise) {
        return bootstrapPromise;
      }
      // 각 단계 fail-open — 어떤 실패도 앱을 무한 initializing(스플래시)에 가두지 않는다.
      // 실패한 promise를 캐시하면 이후 bootstrap 호출도 전부 실패를 돌려주므로,
      // 이 함수는 절대 reject하지 않는 promise만 캐시한다.
      bootstrapPromise = (async () => {
        let termsAgreedAt: string | null = null;
        let onboarded: string | null = null;
        try {
          [termsAgreedAt, onboarded] = await Promise.all([
            deps.storage.getItemAsync(KEY_TERMS_AGREED_AT),
            deps.storage.getItemAsync(KEY_ONBOARDED),
          ]);
        } catch {
          // keychain 잠김 등 — 플래그 기본값으로 진행 (약관 재동의는 무해)
        }

        try {
          await deps.provider.initialize();
        } catch {
          // SDK 초기화 실패 — provider가 내부에서 다음 signIn 시 재시도 (KakaoOIDCProvider)
        }

        // supabase가 디스크에서 복원한 세션을 store로 승격 — 없거나 실패하면 로그인 화면행
        let restored: AuthSession | null = null;
        try {
          restored = (await deps.restoreSession?.()) ?? null;
        } catch {
          restored = null;
        }

        set({
          status: restored !== null ? 'signed_in' : 'signed_out',
          session: restored,
          hasAgreedToTerms: termsAgreedAt !== null,
          termsAgreedAt,
          hasCompletedOnboarding: onboarded === '1',
        });
      })();
      return bootstrapPromise;
    },

    signIn: async () => {
      set({ status: 'authenticating', lastError: null });
      try {
        const result = await deps.provider.signIn();
        set({
          status: 'signed_in',
          session: result.session,
          isNewUser: result.isNewUser,
        });
      } catch (error) {
        const detail = toAuthProviderError(error);
        set({
          status: 'signed_out',
          // 사용자가 모달을 닫은 경우는 UI에 에러로 노출하지 않음
          lastError: detail.kind === 'cancelled' ? null : detail,
        });
        throw error;
      }
    },

    signOut: async () => {
      await deps.provider.signOut();
      set({
        session: null,
        status: 'signed_out',
        isNewUser: false,
        lastError: null,
      });
    },

    resetForAccountDeletion: async () => {
      // 서버에서 이미 계정(auth.users)이 삭제됐을 수 있으므로 provider.signOut 실패는 무시하고
      // 로컬 teardown을 반드시 마친다. signOut과 달리 온보딩·약관 플래그도 제거 —
      // 다음에 이 기기로 로그인하는 사용자에게 이전 사용자의 동의가 누출되지 않게 한다.
      try {
        await deps.provider.signOut();
      } catch {
        // ignore — 로컬 상태만 확실히 정리
      }
      // allSettled — SecureStore 삭제가 실패(키체인 잠금 등)해도 절대 throw하지 않는다.
      // 이미 서버에서 삭제된 계정이므로 state 초기화(set)까지 반드시 도달해야 한다(무한 로딩 방지).
      await Promise.allSettled([
        deps.storage.deleteItemAsync(KEY_TERMS_AGREED_AT),
        deps.storage.deleteItemAsync(KEY_ONBOARDED),
      ]);
      set({
        session: null,
        status: 'signed_out',
        isNewUser: false,
        hasAgreedToTerms: false,
        termsAgreedAt: null,
        hasCompletedOnboarding: false,
        lastError: null,
      });
    },

    agreeToTerms: async () => {
      const now = deps.now().toISOString();
      await deps.storage.setItemAsync(KEY_TERMS_AGREED_AT, now);
      set({ hasAgreedToTerms: true, termsAgreedAt: now });
    },

    completeOnboarding: async () => {
      await deps.storage.setItemAsync(KEY_ONBOARDED, '1');
      set({ hasCompletedOnboarding: true });
    },

    clearError: () => {
      set({ lastError: null });
    },

    // 내부 helper — getter 시점에 state shape에 영향 안 줌
    _: get,
  }));
}

function toAuthProviderError(error: unknown): AuthProviderError {
  if (error instanceof AuthError) {
    return error.detail;
  }
  return {
    kind: 'unknown',
    message: error instanceof Error ? error.message : '알 수 없는 오류',
  };
}
