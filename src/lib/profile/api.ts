// 내 프로필 읽기/쓰기 — public.users가 단일 진실.
// 스펙: docs/superpowers/specs/2026-07-29-nickname-design.md §4-§5.

import { supabase } from '@/lib/supabase/client';

import { type NicknameError, validateNickname } from './nickname';

/** 클라이언트 규칙 위반 + 서버만 알 수 있는 중복까지 포함한 실패 사유 */
export type SetNicknameReason = NicknameError | 'taken';

export type SetNicknameResult =
  | { ok: true; value: string }
  | { ok: false; reason: SetNicknameReason };

export interface MyProfile {
  nickname: string;
  profileImageUrl: string | null;
  /** null = 아직 카톡 이름 그대로 (닉네임 설정 단계를 거치지 않음) */
  nicknameSetAt: string | null;
}

/** RPC가 던지는 안정적 코드 → 화면이 카피를 고를 수 있는 reason */
const RPC_REASONS: Record<string, SetNicknameReason> = {
  nickname_taken: 'taken',
  nickname_too_short: 'too_short',
  nickname_too_long: 'too_long',
  nickname_invalid_chars: 'invalid_chars',
};

/**
 * 닉네임 설정/변경. `set_my_nickname` RPC가 검증·중복검사·nickname_set_at 기록을 한 번에 한다.
 *
 * 예상 가능한 실패(규칙 위반·중복)는 throw하지 않고 reason으로 돌려준다 —
 * throw하면 호출부의 mapError()가 raw를 버리고 일반 카피로 덮어써서
 * "이미 사용 중인 닉네임이에요"가 사라진다.
 * 로그인 만료·네트워크 등 화면이 다르게 처리해야 하는 실패만 throw.
 */
export async function setMyNickname(raw: string): Promise<SetNicknameResult> {
  // 서버 왕복 전에 로컬 규칙으로 거른다 — 타이핑 중 피드백과 같은 규칙이라 결과가 일관된다.
  const local = validateNickname(raw);
  if (!local.ok) {
    return local;
  }

  const { error } = await supabase.rpc('set_my_nickname', { p_nickname: local.value });

  if (error) {
    const reason = RPC_REASONS[error.message ?? ''];
    if (reason) {
      return { ok: false, reason };
    }
    // not_authenticated / 네트워크 / 권한 등 — raw 메시지는 사용자에게 노출하지 않는다.
    throw new Error('저장하지 못했어요. 다시 시도해볼게요.');
  }

  return { ok: true, value: local.value };
}

/**
 * 내 users row 조회. 실패는 null — 프로필 조회 실패가 앱을 막으면 안 된다
 * (authStore가 카톡 이름 폴백을 유지한 채 계속 진행한다).
 */
export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('nickname, profile_image_url, nickname_set_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as {
    nickname: string;
    profile_image_url: string | null;
    nickname_set_at: string | null;
  };

  return {
    nickname: row.nickname,
    profileImageUrl: row.profile_image_url,
    nicknameSetAt: row.nickname_set_at,
  };
}
