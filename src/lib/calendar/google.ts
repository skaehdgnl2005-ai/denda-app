// GoogleCalendarProvider — Google Calendar OAuth + events.insert wrapper.
//
// 본 lib는 클라이언트 전용(RN/Expo). 의존성은 모두 주입(DI):
//   - oauth: expo-auth-session 어댑터 (production 측에서 wiring)
//   - storage: expo-secure-store 어댑터
//   - fetch: globalThis.fetch (테스트에서는 mock Response)
//   - now: () => unix ms (token 만료 비교용 — D13 KST 일관성은 호출 측에서 보장)
//
// 결정 의존:
//   - D19: 단방향 sync (Read X, Push만). Token 만료 silent fail 금지 → token_expired error
//   - D13: 외부 캘린더 event timeZone='Asia/Seoul'로 항상 명시
//   - calendar_queue.ts CalendarEventPayload shape mirror — 서버 측 worker가 만든
//     payload와 동일 키로 받아 외부 캘린더 spec(Google events.insert body)으로 변환
//
// 본 sub-task(S06-google-oauth) 스코프: 클라이언트 lib 만.
// 다음 sub-task: worker stub 교체 + migration 0011(users.calendar_preference) +
//                서버 측 token 저장 architecture 결정.

/** SecureStore에 GoogleTokenState JSON 직렬화로 저장하는 key. setup.ts wrapper에서도 사용. */
export const GOOGLE_TOKEN_STORAGE_KEY = 'denda_google_calendar_token';
const STORAGE_KEY = GOOGLE_TOKEN_STORAGE_KEY;
const GOOGLE_EVENTS_INSERT_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const GOOGLE_CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const KST_TIMEZONE = 'Asia/Seoul';
const DEFAULT_SKEW_MS = 60_000;

// ---------------------------------------------------------------------------
// shared types — calendar_queue.ts (Deno runtime)와 동일 shape. cross-runtime import
// 불가하므로 dual 정의(드물게 변경됨). 변경 시 calendar_queue.ts와 동기 의무.
// ---------------------------------------------------------------------------

export interface CalendarEventPayload {
  title: string;
  startUtcIso: string;
  endUtcIso: string;
  descriptionKo: string;
  locationName: string | null;
}

/**
 * Google Calendar API events.insert request body (subset).
 * https://developers.google.com/calendar/api/v3/reference/events/insert
 */
export interface GoogleCalendarEvent {
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

// ---------------------------------------------------------------------------
// Token state + OAuth grant shape
// ---------------------------------------------------------------------------

export interface GoogleTokenState {
  accessToken: string;
  refreshToken: string;
  /** access_token 만료 시각 (unix ms) — refresh_token은 별도 만료 (몇 개월). */
  expiresAtMs: number;
  scope: string;
}

export interface GoogleOAuthGrant {
  accessToken: string;
  refreshToken: string;
  /** OAuth response의 expires_in (초). access_token 발급 시점 기준. */
  expiresInSeconds: number;
  scope: string;
}

export interface GoogleOAuthAccessTokenResponse {
  accessToken: string;
  expiresInSeconds: number;
}

// ---------------------------------------------------------------------------
// DI interfaces (production은 setup.ts에서 expo-auth-session + expo-secure-store wiring)
// ---------------------------------------------------------------------------

export interface GoogleOAuthClient {
  /** consent screen 띄우고 access + refresh 받음. 사용자 cancel 시 throw. */
  authorize(scopes: string[]): Promise<GoogleOAuthGrant>;
  /** refresh_token → 새 access_token. invalid_grant 시 throw (refresh 만료). */
  refresh(refreshToken: string): Promise<GoogleOAuthAccessTokenResponse>;
  /** OAuth grant 취소 (Google revoke endpoint). best-effort. */
  revoke(refreshToken: string): Promise<void>;
}

export interface GoogleTokenStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface GoogleCalendarDeps {
  oauth: GoogleOAuthClient;
  storage: GoogleTokenStorage;
  fetch: typeof globalThis.fetch;
  /** Token 만료 비교 + 새 만료 시각 계산용. unix ms. */
  now: () => number;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export type CalendarProviderErrorDetail =
  | { kind: 'cancelled' }
  | { kind: 'unauthorized' }
  | { kind: 'token_expired' }
  | { kind: 'rate_limit' }
  | { kind: 'network'; message: string }
  | { kind: 'unknown'; message: string };

export class CalendarProviderError extends Error {
  override readonly name = 'CalendarProviderError';
  readonly detail: CalendarProviderErrorDetail;

  constructor(detail: CalendarProviderErrorDetail) {
    super(messageForDetail(detail));
    this.detail = detail;
  }
}

function messageForDetail(detail: CalendarProviderErrorDetail): string {
  switch (detail.kind) {
    case 'cancelled':
      return '캘린더 연결이 취소되었어요.';
    case 'unauthorized':
      return '캘린더 권한이 필요해요.';
    case 'token_expired':
      return '캘린더 재인증이 필요해요. 다시 로그인해 주세요.';
    case 'rate_limit':
      return '요청이 많아 잠시 후 다시 시도해 주세요.';
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
 * access_token이 만료되었는지 판정.
 * skewMs: 만료 임박 (default 60초) 이내면 만료로 간주 → 미리 refresh.
 * 이유: Google 서버 시계 차이 + 네트워크 RTT로 만료 직전 호출은 401 위험.
 */
export function isTokenExpired(
  state: GoogleTokenState,
  nowMs: number,
  skewMs: number = DEFAULT_SKEW_MS,
): boolean {
  return state.expiresAtMs - skewMs <= nowMs;
}

/**
 * CalendarEventPayload → Google Calendar events.insert body.
 * - summary = title (Google 단일 행 제목)
 * - description = 한국어 본문 (KST 표기 포함 — calendar_queue.buildCalendarEventPayload)
 * - location = locationName (null이면 키 생략 — Google API spec)
 * - start/end timeZone = 'Asia/Seoul' (D13 — UTC ISO 보내도 Google이 KST로 보정)
 */
export function buildGoogleEvent(payload: CalendarEventPayload): GoogleCalendarEvent {
  if (!payload.title || payload.title.trim().length === 0) {
    throw new Error('event title이 필요합니다.');
  }
  const event: GoogleCalendarEvent = {
    summary: payload.title,
    description: payload.descriptionKo,
    start: { dateTime: payload.startUtcIso, timeZone: KST_TIMEZONE },
    end: { dateTime: payload.endUtcIso, timeZone: KST_TIMEZONE },
  };
  if (payload.locationName !== null && payload.locationName !== undefined) {
    event.location = payload.locationName;
  }
  return event;
}

/**
 * SecureStore raw string → GoogleTokenState (방어적 파싱).
 * null / malformed JSON / 필수 필드 누락 / 타입 불일치 모두 null 반환.
 */
export function parseStoredToken(raw: string | null): GoogleTokenState | null {
  if (raw === null || raw === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.accessToken !== 'string' ||
    typeof obj.refreshToken !== 'string' ||
    typeof obj.expiresAtMs !== 'number' ||
    typeof obj.scope !== 'string'
  ) {
    return null;
  }
  return {
    accessToken: obj.accessToken,
    refreshToken: obj.refreshToken,
    expiresAtMs: obj.expiresAtMs,
    scope: obj.scope,
  };
}

function serializeToken(state: GoogleTokenState): string {
  return JSON.stringify(state);
}

function isCancellationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { code?: unknown; message?: unknown };
  const code = typeof errObj.code === 'string' ? errObj.code : '';
  const message = typeof errObj.message === 'string' ? errObj.message : '';
  return code === 'CANCELLED' || code === 'GoogleAuthCancelled' || /cancel(led)?/i.test(message);
}

function isInvalidGrantError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { code?: unknown; message?: unknown };
  const code = typeof errObj.code === 'string' ? errObj.code : '';
  const message = typeof errObj.message === 'string' ? errObj.message : '';
  return code === 'invalid_grant' || /invalid_grant/i.test(message);
}

async function safeJsonError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body?.error?.message) return body.error.message;
  } catch {
    // ignore — fallthrough
  }
  return `Google Calendar API error: ${response.status}`;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class GoogleCalendarProvider {
  readonly providerName = 'google' as const;

  constructor(private readonly deps: GoogleCalendarDeps) {}

  /**
   * storage에 valid token이 저장되어 있고 refresh_token도 살아 있어 refresh 가능한지.
   * access_token 만료 여부는 무관 (refresh로 갱신 가능).
   */
  async isAuthorized(): Promise<boolean> {
    const raw = await this.deps.storage.getItemAsync(STORAGE_KEY);
    const state = parseStoredToken(raw);
    return state !== null && state.refreshToken.length > 0;
  }

  /**
   * OAuth consent screen → grant 저장.
   * - 사용자 cancel → CalendarProviderError({kind:'cancelled'})
   * - network 실패 → CalendarProviderError({kind:'network'})
   */
  async authorize(): Promise<void> {
    let grant: GoogleOAuthGrant;
    try {
      grant = await this.deps.oauth.authorize(GOOGLE_CALENDAR_SCOPES);
    } catch (error) {
      if (isCancellationError(error)) {
        throw new CalendarProviderError({ kind: 'cancelled' });
      }
      throw new CalendarProviderError({
        kind: 'network',
        message: error instanceof Error ? error.message : 'Google 로그인 실패',
      });
    }
    const state: GoogleTokenState = {
      accessToken: grant.accessToken,
      refreshToken: grant.refreshToken,
      expiresAtMs: this.deps.now() + grant.expiresInSeconds * 1000,
      scope: grant.scope,
    };
    await this.deps.storage.setItemAsync(STORAGE_KEY, serializeToken(state));
  }

  /**
   * events.insert POST. token 만료면 자동 refresh.
   *
   * 에러 정책:
   *   - 저장된 token 없음 → unauthorized
   *   - refresh 실패 (invalid_grant) → token_expired + storage 삭제 (재인증 필요)
   *   - 401 → unauthorized + storage 삭제 (revoke됨)
   *   - 429 → rate_limit (storage 유지)
   *   - 기타 5xx/4xx → unknown (storage 유지)
   *   - fetch reject → network
   */
  async insertEvent(payload: CalendarEventPayload): Promise<{ eventId: string }> {
    const raw = await this.deps.storage.getItemAsync(STORAGE_KEY);
    const state = parseStoredToken(raw);
    if (!state) {
      throw new CalendarProviderError({ kind: 'unauthorized' });
    }

    let accessToken = state.accessToken;
    if (isTokenExpired(state, this.deps.now())) {
      try {
        const refreshed = await this.deps.oauth.refresh(state.refreshToken);
        const newState: GoogleTokenState = {
          accessToken: refreshed.accessToken,
          refreshToken: state.refreshToken,
          expiresAtMs: this.deps.now() + refreshed.expiresInSeconds * 1000,
          scope: state.scope,
        };
        await this.deps.storage.setItemAsync(STORAGE_KEY, serializeToken(newState));
        accessToken = refreshed.accessToken;
      } catch (error) {
        if (isInvalidGrantError(error)) {
          await this.deps.storage.deleteItemAsync(STORAGE_KEY);
          throw new CalendarProviderError({ kind: 'token_expired' });
        }
        throw new CalendarProviderError({
          kind: 'network',
          message: error instanceof Error ? error.message : 'token refresh 실패',
        });
      }
    }

    const eventBody = buildGoogleEvent(payload);
    let response: Response;
    try {
      response = await this.deps.fetch(GOOGLE_EVENTS_INSERT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      });
    } catch (error) {
      throw new CalendarProviderError({
        kind: 'network',
        message: error instanceof Error ? error.message : 'fetch 실패',
      });
    }

    if (response.status === 401) {
      await this.deps.storage.deleteItemAsync(STORAGE_KEY);
      throw new CalendarProviderError({ kind: 'unauthorized' });
    }
    if (response.status === 429) {
      throw new CalendarProviderError({ kind: 'rate_limit' });
    }
    if (!response.ok) {
      const message = await safeJsonError(response);
      throw new CalendarProviderError({ kind: 'unknown', message });
    }

    const data = (await response.json()) as { id?: string };
    if (typeof data.id !== 'string' || data.id.length === 0) {
      throw new CalendarProviderError({
        kind: 'unknown',
        message: 'Google 응답에 event id 없음',
      });
    }
    return { eventId: data.id };
  }

  /**
   * revoke + storage 삭제. revoke 실패해도 storage는 무조건 삭제 (best-effort).
   * 저장된 token 없으면 revoke skip, delete만 호출 (idempotent).
   */
  async signOut(): Promise<void> {
    const raw = await this.deps.storage.getItemAsync(STORAGE_KEY);
    const state = parseStoredToken(raw);
    if (state) {
      try {
        await this.deps.oauth.revoke(state.refreshToken);
      } catch {
        // best-effort — storage 삭제는 보장
      }
    }
    await this.deps.storage.deleteItemAsync(STORAGE_KEY);
  }
}
