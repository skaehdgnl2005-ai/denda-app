// AuthProvider 인터페이스 — 인증 공급자 추상화 (D29 + S16 fallback 대비).
//
// 베타: KakaoOIDCProvider만 구현됨. Phase 3 Apple 심사 시 AppleAuthProvider 추가 (S16).
//
// 결정 의존:
//   - D29: 카카오 OIDC + supabase.auth.signInWithIdToken
//   - D1 / S16: AppleAuthProvider plug-in 가능 인터페이스
//
// 본 인터페이스는 "어떻게 로그인하느냐"만 추상화한다.
// 세션 저장·라우팅·UI는 authStore + app/(auth)/* 에서 담당.

export type AuthProviderName = 'kakao' | 'apple';

export type AuthUser = {
  // Supabase auth.users.id (UUID). public.users.id 와 동일 (on_auth_user_created trigger).
  id: string;
  // 카카오 OIDC `sub` claim 캐시. 베타에는 항상 존재.
  kakaoId: string | null;
  // public.users.nickname. 로그인 직후엔 카카오 클레임 값이고, 프로필 조회가 끝나면
  // DB 값으로 교체된다 (public.users가 단일 진실 — 2026-07-29 스펙 §5).
  nickname: string;
  // public.users.nickname_set_at. 3-상태:
  //   string    — 사용자가 직접 정함
  //   null      — 아직 카톡 이름 그대로 → 게이트가 닉네임 화면으로 보냄
  //   undefined — 아직 서버에 안 물어봄 (조회 전/실패) → 게이트 판단 보류
  nicknameSetAt?: string | null;
  // 베타에는 null (account_email scope 비즈앱 한정). Phase 3에서 채워짐.
  email: string | null;
  profileImageUrl: string | null;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  // Unix epoch ms — Supabase가 자동 refresh하지만 만료 임박 체크용으로 노출.
  expiresAt: number;
};

export type AuthSignInResult = {
  session: AuthSession;
  // 첫 로그인 여부 — on_auth_user_created trigger가 public.users INSERT한 직후라면 true.
  // 현재 구현은 `created_at == last_sign_in_at` 휴리스틱 (1초 윈도).
  isNewUser: boolean;
};

export type AuthProviderError =
  | { kind: 'cancelled' } // 사용자가 카카오 로그인 모달을 닫음
  | { kind: 'network'; message: string } // 네트워크/SDK 실패
  | { kind: 'invalid_token'; message: string } // Supabase 검증 실패 (id_token 위조·만료·nonce 불일치)
  | { kind: 'unknown'; message: string };

export class AuthError extends Error {
  override readonly name = 'AuthError';
  readonly detail: AuthProviderError;

  constructor(detail: AuthProviderError) {
    super(
      detail.kind === 'cancelled' ? '로그인이 취소되었습니다' : (detail.message ?? '로그인 실패'),
    );
    this.detail = detail;
  }
}

export interface AuthProvider {
  readonly providerName: AuthProviderName;

  // 네이티브 SDK 초기화. signIn 호출 전 반드시 1회 (idempotent).
  initialize(): Promise<void>;

  // 네이티브 로그인 → id_token 발급 → Supabase 검증 → 세션 생성.
  // 사용자 취소 시 AuthError({ kind: 'cancelled' }) throw.
  signIn(): Promise<AuthSignInResult>;

  // 네이티브 + Supabase 세션 모두 정리.
  signOut(): Promise<void>;
}
