// 닉네임 규칙 — 단일 진실. 스펙: docs/superpowers/specs/2026-07-29-nickname-design.md §4.
//
// 이 규칙은 세 곳에 복제되어 있다. 하나를 바꾸면 셋 다 바꿔야 한다:
//   1. 이 파일           — 입력 중 실시간 피드백 (즉시성)
//   2. set_my_nickname() — 진짜 게이트 (0024_nickname.sql)
//   3. users CHECK 제약  — 최후 방어선 (0024_nickname.sql)
//
// 왜 복제를 감수하나: 서버 왕복 없이 타이핑 중 피드백을 주려면 클라이언트에 규칙이 필요하고,
// 클라이언트를 신뢰할 수 없으니 서버에도 필요하다. 복제를 없애려면 매 키 입력마다 RPC를
// 때려야 하는데 그건 더 나쁘다.

/** 최소 길이 (사용자 인지 문자 수) */
export const NICKNAME_MIN = 2;

/** 최대 길이 (사용자 인지 문자 수) */
export const NICKNAME_MAX = 12;

/**
 * 허용 문자: 한글 완성형 · 영문 · 숫자 · 밑줄.
 *
 * 제외되는 것과 이유:
 *   - 자모 단독(ㄱ, ㅏ = U+3131~U+318E)은 가-힣(U+AC00~U+D7A3) 범위 밖 → 자동 제외.
 *     "ㅋㅋㅋ" 같은 이름을 막는 게 목적이 아니라, 조합 중인 미완성 입력이 저장되는 것을 막는다.
 *   - 공백: 유니크 제약을 무력화한다 ("지민" vs "지 민"이 다른 이름이 되고,
 *     검색하는 쪽이 공백 위치를 맞춰야 결과가 나온다).
 *   - 이모지: 폭이 들쭉날쭉해 목록 레이아웃이 깨지고, 검색어로 입력이 어렵다.
 */
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

export type NicknameError = 'too_short' | 'too_long' | 'invalid_chars';

export type NicknameValidation = { ok: true; value: string } | { ok: false; reason: NicknameError };

/**
 * 닉네임 입력을 정규화(trim)하고 규칙 위반을 분류한다.
 *
 * 길이를 문자 규칙보다 먼저 검사한다 — 사용자가 먼저 마주치는 제약이 길이이고,
 * 1자짜리 "@"에 "한글·영문·숫자만 쓸 수 있어요"를 띄우면 지우다가 혼란스럽다.
 */
export function validateNickname(raw: string): NicknameValidation {
  const value = raw.trim();

  // 코드포인트 단위로 센다 — String.length는 서로게이트 페어를 2로 세어
  // 12자 한도가 문자에 따라 들쭉날쭉해진다.
  const length = [...value].length;

  if (length < NICKNAME_MIN) {
    return { ok: false, reason: 'too_short' };
  }
  if (length > NICKNAME_MAX) {
    return { ok: false, reason: 'too_long' };
  }
  if (!NICKNAME_PATTERN.test(value)) {
    return { ok: false, reason: 'invalid_chars' };
  }
  return { ok: true, value };
}
