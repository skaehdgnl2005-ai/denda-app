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

/**
 * public.users에서 읽어오는 프로필 조각. profile/api::MyProfile이 구조적으로 대입 가능하다
 * (authStore가 profile 모듈을 import하지 않게 하려는 의도 — 의존 방향은 setup.ts에서만 이어진다).
 */
export type ProfileSnapshot = {
  nickname: string;
  nicknameSetAt: string | null;
};

export type AuthStoreDeps = {
  provider: AuthProvider;
  storage: AuthStorage;
  // 테스트 시 deterministic time을 위해 주입. 프로덕션은 luxon DateTime.now()→toJSDate.
  now: () => Date;
  // 앱 시작 시 supabase가 디스크에서 복원한 세션을 store로 승격 (setup.ts에서 주입).
  // 미주입 시 복원 생략 — 항상 signed_out으로 시작.
  restoreSession?: () => Promise<AuthSession | null>;
  // public.users에서 닉네임을 읽어 세션에 반영 (2026-07-29 스펙 §5).
  // 미주입 시 카카오 클레임 값이 그대로 남고 nicknameSetAt은 undefined — 게이트가 판단을 보류한다.
  fetchProfile?: (userId: string) => Promise<ProfileSnapshot | null>;
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
  /**
   * 닉네임 저장 성공을 세션에 반영 (네트워크 호출은 하지 않는다 —
   * profile/api::setMyNickname이 이미 했다). 재조회 왕복을 없앤다.
   */
  applyNickname: (nickname: string) => void;
  clearError: () => void;
};

export function createAuthStore(deps: AuthStoreDeps) {
  let bootstrapPromise: Promise<void> | null = null;

  /**
   * 세션 사용자에 DB 프로필을 덮어쓴 새 세션을 만든다. 조회 실패(null)면 세션을 그대로 둔다 —
   * 오프라인에서 카톡 이름이라도 보이는 편이 빈 화면보다 낫고, nicknameSetAt이 undefined로
   * 남아 게이트가 닉네임 화면을 강요하지 않는다.
   */
  const withProfile = (session: AuthSession, profile: ProfileSnapshot | null): AuthSession =>
    profile === null
      ? session
      : {
          ...session,
          user: {
            ...session.user,
            nickname: profile.nickname,
            nicknameSetAt: profile.nicknameSetAt,
          },
        };

  const loadProfile = async (userId: string): Promise<ProfileSnapshot | null> => {
    if (!deps.fetchProfile) return null;
    try {
      return await deps.fetchProfile(userId);
    } catch {
      return null;
    }
  };

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

        // D25 콜드 스타트 예산: 프로필 조회를 await하지 않는다. 백그라운드로 던지고
        // 도착하면 set() — 게이트가 자동으로 재평가된다. 대가는 이미 가입한 사용자가
        // 홈을 잠깐 보고 닉네임 화면으로 넘어가는 1회성 전환뿐이다.
        if (restored !== null) {
          const userId = restored.user.id;
          void loadProfile(userId).then((profile) => {
            if (profile === null) return;
            const current = get().session;
            // 조회 중 로그아웃/계정 전환이 일어났으면 버린다 (stale write 방지).
            if (current === null || current.user.id !== userId) return;
            set({ session: withProfile(current, profile) });
          });
        }
      })();
      return bootstrapPromise;
    },

    signIn: async () => {
      set({ status: 'authenticating', lastError: null });
      try {
        const result = await deps.provider.signIn();
        // bootstrap과 달리 여기선 await한다 — 이미 카카오 왕복 중이라 쿼리 하나가 체감되지
        // 않고, 신규 가입자가 홈을 거치지 않고 곧바로 닉네임 화면으로 간다.
        const profile = await loadProfile(result.session.user.id);
        set({
          status: 'signed_in',
          session: withProfile(result.session, profile),
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

    applyNickname: (nickname) => {
      const current = get().session;
      if (current === null) return;
      set({
        session: withProfile(current, {
          nickname,
          // 값 자체는 게이트 통과 마커일 뿐이지만, KST 규칙(D13)에 따라 deps.now()를 쓴다.
          nicknameSetAt: deps.now().toISOString(),
        }),
      });
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
