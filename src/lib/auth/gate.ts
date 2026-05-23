// 인증/온보딩 라우팅 게이트 결정 로직 (pure function).
// app/index.tsx에서 호출. 분리 이유: expo-router 의존 없이 단위 테스트 가능.

import type { AuthState } from './authStore';

export type GateDecision =
  | { kind: 'splash' } // 아직 부트스트랩 중
  | { kind: 'login' } // 로그아웃 또는 로그인 진행 중
  | { kind: 'terms' } // 로그인 완료, 약관 동의 필요
  | { kind: 'onboarding' } // 약관 OK, 온보딩 미완료
  | { kind: 'home' }; // 모두 완료

export type GateInput = Pick<AuthState, 'status' | 'hasAgreedToTerms' | 'hasCompletedOnboarding'>;

export function decideGate(state: GateInput): GateDecision {
  if (state.status === 'initializing') {
    return { kind: 'splash' };
  }
  if (state.status === 'signed_out' || state.status === 'authenticating') {
    return { kind: 'login' };
  }
  // status === 'signed_in'
  if (!state.hasAgreedToTerms) {
    return { kind: 'terms' };
  }
  if (!state.hasCompletedOnboarding) {
    return { kind: 'onboarding' };
  }
  return { kind: 'home' };
}
