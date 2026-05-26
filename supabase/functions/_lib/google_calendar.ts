// google_calendar.ts — S06 서버 측 Google Calendar API client (Deno fetch 기반).
//
// 책임:
//   1. buildGoogleEventBody — CalendarEventPayload → events.insert body (timeZone 'Asia/Seoul' — D13)
//   2. isAccessTokenExpired — token state 만료 판정 (60s skew default)
//   3. refreshAccessToken — refresh_token → 새 access_token (Google OAuth token endpoint POST)
//   4. insertCalendarEvent — events.insert POST → eventId
//
// 모두 fetch DI (테스트 친화). DB 접근 X — worker가 user_oauth_tokens SELECT/UPDATE 책임.
//
// 결정 의존:
//   - [D35](../../../docs/DECISIONS.md#d35) — user_oauth_tokens에 access·refresh 저장 → worker가 본 lib 호출
//   - [D19](../../../docs/DECISIONS.md#d19) — token 만료 silent fail 금지 → token_expired error로 명시
//   - [D13](../../../docs/DECISIONS.md#d13) — KST 강제: timeZone='Asia/Seoul' 항상 명시
//   - calendar_queue.ts CalendarEventPayload shape mirror — worker가 만든 payload 그대로 받음

import type { CalendarEventPayload } from './calendar_queue.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_INSERT_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const KST_TIMEZONE = 'Asia/Seoul';
const DEFAULT_SKEW_MS = 60_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Google Calendar API events.insert request body (subset — Phase 1+2은 단일 event push).
 * https://developers.google.com/calendar/api/v3/reference/events/insert
 */
export interface GoogleEventBody {
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

export interface RefreshAccessTokenArgs {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetch: typeof globalThis.fetch;
}

export interface RefreshAccessTokenResult {
  accessToken: string;
  expiresInSeconds: number;
  /** Google이 회전된 refresh_token을 보낸 경우만 채움. 없으면 기존 refresh_token 유지. */
  refreshToken?: string;
}

export interface InsertCalendarEventArgs {
  accessToken: string;
  body: GoogleEventBody;
  fetch: typeof globalThis.fetch;
}

export interface InsertCalendarEventResult {
  eventId: string;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export type GoogleApiErrorDetail =
  | { kind: 'unauthorized' }
  | { kind: 'token_expired' }
  | { kind: 'rate_limit' }
  | { kind: 'network'; message: string }
  | { kind: 'unknown'; message: string };

export class GoogleApiError extends Error {
  override readonly name = 'GoogleApiError';
  readonly detail: GoogleApiErrorDetail;

  constructor(detail: GoogleApiErrorDetail) {
    super(messageForDetail(detail));
    this.detail = detail;
  }
}

function messageForDetail(detail: GoogleApiErrorDetail): string {
  switch (detail.kind) {
    case 'unauthorized':
      return 'Google Calendar 권한이 없습니다.';
    case 'token_expired':
      return 'Google Calendar 재인증이 필요합니다.';
    case 'rate_limit':
      return 'Google Calendar API 호출 한도 초과.';
    case 'network':
      return detail.message;
    case 'unknown':
      return detail.message;
  }
}

// ---------------------------------------------------------------------------
// 순수 helpers
// ---------------------------------------------------------------------------

/**
 * CalendarEventPayload → Google Calendar events.insert body.
 * - summary = title
 * - description = descriptionKo (calendar_queue.buildCalendarEventPayload가 KST 표기 포함)
 * - location = locationName (null이면 키 생략 — Google API spec)
 * - start/end timeZone = 'Asia/Seoul' (D13)
 */
export function buildGoogleEventBody(payload: CalendarEventPayload): GoogleEventBody {
  if (!payload.title || payload.title.trim().length === 0) {
    throw new Error('이벤트 제목이 필요합니다.');
  }
  const body: GoogleEventBody = {
    summary: payload.title,
    description: payload.descriptionKo,
    start: { dateTime: payload.startUtcIso, timeZone: KST_TIMEZONE },
    end: { dateTime: payload.endUtcIso, timeZone: KST_TIMEZONE },
  };
  if (payload.locationName !== null && payload.locationName !== undefined) {
    body.location = payload.locationName;
  }
  return body;
}

/**
 * access_token이 만료되었는지 판정.
 * skewMs(default 60s) 안에 들어가도 만료로 간주 → 미리 refresh.
 * 이유: Google 서버 시계 차이 + 네트워크 RTT로 만료 직전 호출은 401 위험.
 */
export function isAccessTokenExpired(
  expiresAtIso: string,
  nowMs: number,
  skewMs: number = DEFAULT_SKEW_MS,
): boolean {
  const expiresMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresMs)) {
    throw new Error(`expires_at parse 실패: ${expiresAtIso}`);
  }
  return expiresMs - skewMs <= nowMs;
}

// ---------------------------------------------------------------------------
// refreshAccessToken — Google OAuth token endpoint POST
// ---------------------------------------------------------------------------

interface GoogleRefreshResponseBody {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  error?: unknown;
  error_description?: unknown;
}

export async function refreshAccessToken(
  args: RefreshAccessTokenArgs,
): Promise<RefreshAccessTokenResult> {
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: args.refreshToken,
    client_id: args.clientId,
    client_secret: args.clientSecret,
  });

  let response: Response;
  try {
    response = await args.fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (error) {
    throw new GoogleApiError({
      kind: 'network',
      message: error instanceof Error ? error.message : 'token endpoint fetch 실패',
    });
  }

  let body: GoogleRefreshResponseBody;
  try {
    body = (await response.json()) as GoogleRefreshResponseBody;
  } catch {
    throw new GoogleApiError({
      kind: 'network',
      message: `token endpoint 응답 JSON parse 실패 (status=${response.status})`,
    });
  }

  if (!response.ok) {
    // Google: 400 + body.error='invalid_grant' = refresh_token 만료/revoke
    const errorCode = typeof body.error === 'string' ? body.error : '';
    if (response.status === 400 && errorCode === 'invalid_grant') {
      throw new GoogleApiError({ kind: 'token_expired' });
    }
    const errDesc =
      typeof body.error_description === 'string'
        ? body.error_description
        : errorCode || `status=${response.status}`;
    // 5xx + 기타 4xx는 network 분류 (refresh 재시도 가능)
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new GoogleApiError({ kind: 'network', message: errDesc });
    }
    throw new GoogleApiError({ kind: 'network', message: errDesc });
  }

  if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
    throw new GoogleApiError({
      kind: 'unknown',
      message: 'token endpoint 응답에 access_token 없음',
    });
  }
  if (typeof body.expires_in !== 'number') {
    throw new GoogleApiError({
      kind: 'unknown',
      message: 'token endpoint 응답에 expires_in 없음',
    });
  }

  const result: RefreshAccessTokenResult = {
    accessToken: body.access_token,
    expiresInSeconds: body.expires_in,
  };
  if (typeof body.refresh_token === 'string' && body.refresh_token.length > 0) {
    result.refreshToken = body.refresh_token;
  }
  return result;
}

// ---------------------------------------------------------------------------
// insertCalendarEvent — events.insert POST
// ---------------------------------------------------------------------------

export async function insertCalendarEvent(
  args: InsertCalendarEventArgs,
): Promise<InsertCalendarEventResult> {
  let response: Response;
  try {
    response = await args.fetch(GOOGLE_EVENTS_INSERT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args.body),
    });
  } catch (error) {
    throw new GoogleApiError({
      kind: 'network',
      message: error instanceof Error ? error.message : 'events.insert fetch 실패',
    });
  }

  if (response.status === 401) {
    throw new GoogleApiError({ kind: 'unauthorized' });
  }
  if (response.status === 429) {
    throw new GoogleApiError({ kind: 'rate_limit' });
  }
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new GoogleApiError({ kind: 'unknown', message });
  }

  let body: { id?: unknown };
  try {
    body = (await response.json()) as { id?: unknown };
  } catch {
    throw new GoogleApiError({
      kind: 'unknown',
      message: 'events.insert 응답 JSON parse 실패',
    });
  }

  if (typeof body.id !== 'string' || body.id.length === 0) {
    throw new GoogleApiError({
      kind: 'unknown',
      message: 'events.insert 응답에 event id 없음',
    });
  }
  return { eventId: body.id };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (body?.error && typeof body.error.message === 'string') {
      return body.error.message;
    }
  } catch {
    // ignore
  }
  return `Google Calendar API error: ${response.status}`;
}
