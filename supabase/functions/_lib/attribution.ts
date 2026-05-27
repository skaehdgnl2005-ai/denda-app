// D28 attribution 비즈니스 로직 helper.
// Edge Function 본체에서 분리하여 단위 테스트 가능.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_CODE_RE = /^[0-9]{4}$/;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function isInviteCode(v: unknown): v is string {
  return typeof v === 'string' && INVITE_CODE_RE.test(v);
}

// --- attribution_click_log -------------------------------------------------

export interface ClickLogRequestRaw {
  branch_link_id?: unknown;
  group_id?: unknown;
  guest_token?: unknown;
}

export interface ClickLogRequest {
  branchLinkId: string;
  groupId: string;
  guestToken: string;
}

export function parseClickLogRequest(body: ClickLogRequestRaw): ClickLogRequest {
  if (typeof body.branch_link_id !== 'string' || body.branch_link_id.length === 0) {
    throw new Error('branch_link_id가 필요합니다.');
  }
  if (body.branch_link_id.length > 64) {
    throw new Error('branch_link_id가 너무 깁니다.');
  }
  if (!isUuid(body.group_id)) {
    throw new Error('group_id (UUID)가 필요합니다.');
  }
  if (!isUuid(body.guest_token)) {
    throw new Error('guest_token (UUID)가 필요합니다.');
  }
  return {
    branchLinkId: body.branch_link_id,
    groupId: body.group_id,
    guestToken: body.guest_token,
  };
}

// --- attribution_resolve ---------------------------------------------------

export type ResolveRequestRaw =
  | { mode?: 'fingerprint' }
  | { mode?: 'invite_code'; code?: unknown }
  | { mode?: unknown; [k: string]: unknown };

export type ResolveRequest =
  | { mode: 'fingerprint' }
  | { mode: 'invite_code'; code: string };

export function parseResolveRequest(body: ResolveRequestRaw): ResolveRequest {
  const mode = (body as { mode?: unknown }).mode;
  if (mode === 'fingerprint') {
    return { mode: 'fingerprint' };
  }
  if (mode === 'invite_code') {
    const code = (body as { code?: unknown }).code;
    if (!isInviteCode(code)) {
      throw new Error('초대 코드는 4자리 숫자여야 해요.');
    }
    return { mode: 'invite_code', code };
  }
  throw new Error('mode는 fingerprint 또는 invite_code여야 합니다.');
}

// --- Fingerprint 매칭 SQL 빌더 (Supabase query 인자) -----------------------

export const FINGERPRINT_MATCH_WINDOW_HOURS = 24;

export interface MatchFilters {
  ipHash: string;
  uaHash: string;
  windowHours: number;
}

/**
 * 매칭 window 시작 시점(UTC ISO). NOW() - INTERVAL '24h'를 Supabase JS client에서
 * 사용하기 위해 application-side에서 계산.
 */
export function fingerprintMatchSince(now: Date, windowHours: number): string {
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  return since.toISOString();
}

export function buildMatchFilters(ipHash: string, uaHash: string): MatchFilters {
  return { ipHash, uaHash, windowHours: FINGERPRINT_MATCH_WINDOW_HOURS };
}
