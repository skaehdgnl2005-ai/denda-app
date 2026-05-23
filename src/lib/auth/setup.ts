// 인증 시스템 wiring — 네이티브 SDK + Supabase + Store를 production 의존성으로 묶는다.
//
// 분리 이유:
//   - authStore/KakaoOIDCProvider는 모두 DI 패턴이라 jest에서 native module 없이 테스트 가능
//   - 본 파일만 실제 native module import → jest는 만나지 않음
//
// 사용:
//   import { useAuth, authStore } from '@/lib/auth/setup';

import { initializeKakaoSDK } from '@react-native-kakao/core';
import { login as kakaoLoginNative, logout as kakaoLogoutNative } from '@react-native-kakao/user';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { supabase } from '../supabase/client';

import { type AuthState, createAuthStore } from './authStore';
import { KakaoOIDCProvider, type KakaoOIDCSupabaseAuth } from './KakaoOIDCProvider';

// -------------------------------------------------------------------------
// 환경변수 + 가드
// -------------------------------------------------------------------------

const KAKAO_NATIVE_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;

if (!KAKAO_NATIVE_APP_KEY) {
  // 빌드 시점 가드 — .env.local 누락된 채 native build에 들어가면 명확한 에러를 던진다.
  // 테스트는 setup.ts를 import하지 않으므로 영향 없음.
  throw new Error(
    'EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY 환경 변수가 설정되지 않았습니다. .env.local 확인.',
  );
}

// -------------------------------------------------------------------------
// Provider 어댑터
// -------------------------------------------------------------------------

const supabaseAuthAdapter: KakaoOIDCSupabaseAuth = {
  async signInWithIdToken(args) {
    const { data, error } = await supabase.auth.signInWithIdToken(args);
    return {
      data: {
        // supabase-js의 User/Session 타입은 우리 내부 SupabaseUser/SupabaseSession과
        // 호환 — `user_metadata`, `created_at`, `last_sign_in_at`, `access_token`,
        // `refresh_token`, `expires_at` 모두 동일 키.
        user: data.user as never,
        session: data.session as never,
      },
      error: error ? { message: error.message } : null,
    };
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error: error ? { message: error.message } : null };
  },
};

const provider = new KakaoOIDCProvider({
  kakaoNativeAppKey: KAKAO_NATIVE_APP_KEY,
  generateNonce: async () => Crypto.randomUUID(),
  initKakaoSDK: async (key) => {
    await initializeKakaoSDK(key);
  },
  kakaoLogin: async ({ scopes, nonce }) => {
    // @react-native-kakao/user (2.4.5)의 native login bridge는 nonce 인자를 받지 않는다
    // (spec: `login(serviceTerms, prompts, useKakaoAccountLogin, scopes?)`). 우리는 nonce를 생성해
    // Supabase signInWithIdToken에는 전달하지만, 카카오 id_token에는 nonce_hash가 박히지 않으므로
    // Supabase의 nonce_hash 비교는 skip된다. native iOS/Android Kakao SDK는 nonce를 지원하므로
    // 패키지 patch 또는 react-native-seoul/kakao-login fallback이 필요.
    // → docs/OPEN_QUESTIONS Q-A1-next 등재 + S01 user-required-actions에 명시.
    void nonce;
    const result = await kakaoLoginNative({ scopes });
    return {
      idToken: result.idToken ?? '',
      accessToken: result.accessToken,
    };
  },
  kakaoLogout: async () => {
    await kakaoLogoutNative();
  },
  supabaseAuth: supabaseAuthAdapter,
});

// -------------------------------------------------------------------------
// Singleton store
// -------------------------------------------------------------------------

export const authStore = createAuthStore({
  provider,
  storage: {
    getItemAsync: SecureStore.getItemAsync,
    setItemAsync: SecureStore.setItemAsync,
    deleteItemAsync: SecureStore.deleteItemAsync,
  },
  // luxon 경유로 가도 되지만, JS Date는 toISOString만 쓰므로 timezone 무관.
  // 단, design-guard rule을 만족시키려면 lib/time/kst를 통과해야 한다.
  now: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nowKst } = require('../time/kst') as typeof import('../time/kst');
    return nowKst().toJSDate();
  },
});

// -------------------------------------------------------------------------
// React hook
// -------------------------------------------------------------------------

export function useAuth<T>(selector: (state: AuthState) => T): T {
  return useSyncExternalStore(
    authStore.subscribe,
    () => selector(authStore.getState()),
    () => selector(authStore.getState()),
  );
}
