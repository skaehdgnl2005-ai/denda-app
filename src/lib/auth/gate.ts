// 인증/온보딩 라우팅 게이트 결정 로직 (pure function).
// app/index.tsx에서 호출. 분리 이유: expo-router 의존 없이 단위 테스트 가능.

import type { AuthState } from './authStore';

export type GateDecision =
  | { kind: 'splash' } // 아직 부트스트랩 중
  | { kind: 'login' } // 로그아웃 또는 로그인 진행 중
  | { kind: 'terms' } // 로그인 완료, 약관 동의 필요
  | { kind: 'nickname' } // 약관 OK, 닉네임 미설정 (카톡 이름 그대로)
  | { kind: 'onboarding' } // 닉네임 OK, 온보딩 미완료
  | { kind: 'home' }; // 모두 완료

export type GateInput = Pick<
  AuthState,
  'status' | 'hasAgreedToTerms' | 'hasCompletedOnboarding'
> & {
  /**
   * 세션 사용자의 users.nickname_set_at. 3-상태:
   *   string    — 사용자가 직접 정함 → 통과
   *   null      — 아직 카톡 이름 그대로 → 닉네임 화면
   *   undefined — 아직 서버에 안 물어봄 → 판단 보류(통과)
   *
   * undefined가 없으면 콜드 스타트마다 "모름"을 "미설정"으로 오인해 닉네임 화면이 번쩍인다.
   * 스펙 §5-§6.
   */
  nicknameSetAt: string | null | undefined;
};

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
  // null만 차단 — undefined(조회 전)는 통과시킨다.
  if (state.nicknameSetAt === null) {
    return { kind: 'nickname' };
  }
  if (!state.hasCompletedOnboarding) {
    return { kind: 'onboarding' };
  }
  return { kind: 'home' };
}
