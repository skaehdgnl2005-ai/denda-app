// S15-deeplink (D28) — 4자리 invite_code helper.
// 자체 deferred deep link의 fallback: Universal Link + fingerprint 매칭 둘 다 miss 시
// 게스트가 카톡 메시지에서 본 4자리 코드를 앱 첫 화면에 입력 → 모임 매칭.
//
// invite_code spec:
//   - 4자리 numeric ("0000" ~ "9999")
//   - 0-padding 강제 (사용자가 본 그대로 입력)
//   - DB(`groups.invite_code` CHAR(4))와 동일 표현

const FOUR_DIGIT_RE = /^[0-9]{4}$/;

export function isValidInviteCode(code: string): boolean {
  return typeof code === 'string' && FOUR_DIGIT_RE.test(code);
}

export function formatInviteCode(code: number | string): string {
  let n: number;
  if (typeof code === 'string') {
    if (code.length === 0 || !/^[0-9]+$/.test(code)) {
      throw new Error(`Invalid invite code input: ${JSON.stringify(code)}`);
    }
    n = parseInt(code, 10);
  } else {
    n = code;
  }
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 9999) {
    throw new Error(`Invite code out of range (0..9999): ${code}`);
  }
  return n.toString().padStart(4, '0');
}

export function parseInviteCode(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  return FOUR_DIGIT_RE.test(trimmed) ? trimmed : null;
}
