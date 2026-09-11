// google_calendar_test.ts — S06-worker-google-integration 서버 측 Google API client unit tests.
// 실행: deno test --allow-env supabase/functions/_lib/google_calendar_test.ts
//
// 검증 대상 (모두 fetch DI로 순수 + 단위 테스트):
//   - buildGoogleEventBody(payload) — CalendarEventPayload → events.insert body (D13 Asia/Seoul)
//   - isAccessTokenExpired(expiresAtIso, nowMs, skewMs) — token 만료 판정 (60s skew)
//   - refreshAccessToken({...}) — refresh_token → access_token + expires_in (회전 시 새 refresh_token)
//   - insertCalendarEvent({...}) — events.insert POST → eventId
//
// 에러 정책: GoogleApiError detail kind = token_expired/unauthorized/rate_limit/network/unknown

import {
  assert,
  assertEquals,
  assertObjectMatch,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildGoogleEventBody,
  GoogleApiError,
  insertCalendarEvent,
  isAccessTokenExpired,
  refreshAccessToken,
} from './google_calendar.ts';
import type { CalendarEventPayload } from './calendar_queue.ts';

// ---------------------------------------------------------------------------
// buildGoogleEventBody
// ---------------------------------------------------------------------------

const basePayload: CalendarEventPayload = {
  title: '안암 저녁 모임',
  startUtcIso: '2026-05-30T11:00:00+00:00',
  endUtcIso: '2026-05-30T13:00:00+00:00',
  descriptionKo: '[된다] 2026년 5월 30일 (토) 20:00 ~ 22:00 KST',
  locationName: '안암역 1번 출구 카페',
};

Deno.test('buildGoogleEventBody: 정상 payload → summary/description/location/start/end + timeZone Asia/Seoul', () => {
  const body = buildGoogleEventBody(basePayload);
  assertEquals(body.summary, '안암 저녁 모임');
  assertEquals(body.description, '[된다] 2026년 5월 30일 (토) 20:00 ~ 22:00 KST');
  assertEquals(body.location, '안암역 1번 출구 카페');
  assertEquals(body.start, {
    dateTime: '2026-05-30T11:00:00+00:00',
    timeZone: 'Asia/Seoul',
  });
  assertEquals(body.end, {
    dateTime: '2026-05-30T13:00:00+00:00',
    timeZone: 'Asia/Seoul',
  });
});

Deno.test('buildGoogleEventBody: locationName null → location 키 생략 (Google API spec)', () => {
  const body = buildGoogleEventBody({ ...basePayload, locationName: null });
  assertEquals(body.location, undefined);
  assert(!Object.prototype.hasOwnProperty.call(body, 'location'));
});

Deno.test('buildGoogleEventBody: title 빈 string → throw', () => {
  assertThrows(
    () => buildGoogleEventBody({ ...basePayload, title: '' }),
    Error,
    '이벤트 제목',
  );
});

Deno.test('buildGoogleEventBody: title whitespace only → throw', () => {
  assertThrows(
    () => buildGoogleEventBody({ ...basePayload, title: '   ' }),
    Error,
    '이벤트 제목',
  );
});

// ---------------------------------------------------------------------------
// isAccessTokenExpired
// ---------------------------------------------------------------------------

Deno.test('isAccessTokenExpired: now < expires - skew → false (만료 안 됨)', () => {
  // expires = 2026-05-26T11:00:00Z = 1779613200000 ms
  const expiresAtIso = '2026-05-26T11:00:00+00:00';
  const expiresMs = Date.parse(expiresAtIso);
  const nowMs = expiresMs - 120_000; // 2분 전
  assertEquals(isAccessTokenExpired(expiresAtIso, nowMs), false);
});

Deno.test('isAccessTokenExpired: now == expires - skew → true (skew 임계)', () => {
  const expiresAtIso = '2026-05-26T11:00:00+00:00';
  const expiresMs = Date.parse(expiresAtIso);
  const nowMs = expiresMs - 60_000; // 정확히 skew 경계
  assertEquals(isAccessTokenExpired(expiresAtIso, nowMs), true);
});

Deno.test('isAccessTokenExpired: now > expires → true (이미 만료)', () => {
  const expiresAtIso = '2026-05-26T11:00:00+00:00';
  const nowMs = Date.parse(expiresAtIso) + 1000;
  assertEquals(isAccessTokenExpired(expiresAtIso, nowMs), true);
});

Deno.test('isAccessTokenExpired: skewMs override → 짧은 skew로 만료 미적용', () => {
  const expiresAtIso = '2026-05-26T11:00:00+00:00';
  const expiresMs = Date.parse(expiresAtIso);
  // default skew(60s) 안에 들어가도 짧은 skew(1s)면 false
  assertEquals(isAccessTokenExpired(expiresAtIso, expiresMs - 30_000, 1_000), false);
});

Deno.test('isAccessTokenExpired: invalid ISO → throw', () => {
  assertThrows(
    () => isAccessTokenExpired('not-a-date', 0),
    Error,
    'expires_at parse 실패',
  );
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.test('refreshAccessToken: 200 응답 → access_token + expires_in 파싱', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: typeof fetch = (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(
      makeJsonResponse(200, {
        access_token: 'new-access',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        token_type: 'Bearer',
      }),
    );
  };

  const result = await refreshAccessToken({
    clientId: 'cid',
    clientSecret: 'csec',
    refreshToken: 'rtok',
    fetch: fetchFn,
  });

  assertEquals(result.accessToken, 'new-access');
  assertEquals(result.expiresInSeconds, 3600);
  assertEquals(result.refreshToken, undefined); // 회전 없을 때 undefined
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, 'https://oauth2.googleapis.com/token');
  assertEquals(calls[0].init.method, 'POST');
});

Deno.test('refreshAccessToken: 응답에 새 refresh_token 포함 → 회전된 refresh_token 반환', async () => {
  const fetchFn: typeof fetch = () =>
    Promise.resolve(
      makeJsonResponse(200, {
        access_token: 'new-access',
        expires_in: 3600,
        refresh_token: 'rotated-refresh',
        scope: 'scope',
        token_type: 'Bearer',
      }),
    );

  const result = await refreshAccessToken({
    clientId: 'cid',
    clientSecret: 'csec',
    refreshToken: 'rtok',
    fetch: fetchFn,
  });

  assertEquals(result.refreshToken, 'rotated-refresh');
});

Deno.test('refreshAccessToken: body는 form-urlencoded (Google spec)', async () => {
  let capturedBody = '';
  const fetchFn: typeof fetch = (_url, init) => {
    // supabase-js가 끌어오는 RequestInit 정의와 Deno 내장 정의가 유니온으로 충돌해
    // init.body 직접 접근이 타입 에러 — 테스트가 관심 있는 shape로만 좁혀 캡처.
    capturedBody = String((init as { body?: unknown } | undefined)?.body ?? '');
    return Promise.resolve(
      makeJsonResponse(200, { access_token: 'a', expires_in: 1, scope: 's' }),
    );
  };

  await refreshAccessToken({
    clientId: 'cid',
    clientSecret: 'csec',
    refreshToken: 'rtok',
    fetch: fetchFn,
  });

  // URLSearchParams 직렬화 — 키 4개 모두 포함
  assert(capturedBody.includes('grant_type=refresh_token'));
  assert(capturedBody.includes('client_id=cid'));
  assert(capturedBody.includes('client_secret=csec'));
  assert(capturedBody.includes('refresh_token=rtok'));
});

Deno.test('refreshAccessToken: 400 invalid_grant → GoogleApiError(token_expired)', async () => {
  const fetchFn: typeof fetch = () =>
    Promise.resolve(
      makeJsonResponse(400, {
        error: 'invalid_grant',
        error_description: 'Token has been expired or revoked.',
      }),
    );

  const err = await assertRejects(
    () =>
      refreshAccessToken({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'rtok',
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'token_expired');
});

Deno.test('refreshAccessToken: 500 → GoogleApiError(network)', async () => {
  const fetchFn: typeof fetch = () =>
    Promise.resolve(makeJsonResponse(500, { error: 'internal' }));

  const err = await assertRejects(
    () =>
      refreshAccessToken({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'rtok',
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'network');
});

Deno.test('refreshAccessToken: fetch reject → GoogleApiError(network)', async () => {
  const fetchFn: typeof fetch = () => Promise.reject(new Error('ECONNRESET'));

  const err = await assertRejects(
    () =>
      refreshAccessToken({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'rtok',
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'network');
});

Deno.test('refreshAccessToken: 200 응답에 access_token 누락 → GoogleApiError(unknown)', async () => {
  const fetchFn: typeof fetch = () =>
    Promise.resolve(makeJsonResponse(200, { expires_in: 3600 }));

  const err = await assertRejects(
    () =>
      refreshAccessToken({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'rtok',
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'unknown');
});

// ---------------------------------------------------------------------------
// insertCalendarEvent
// ---------------------------------------------------------------------------

const eventBody = buildGoogleEventBody(basePayload);

Deno.test('insertCalendarEvent: 200 + id → {eventId}', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: typeof fetch = (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(makeJsonResponse(200, { id: 'evt_abc123' }));
  };

  const result = await insertCalendarEvent({
    accessToken: 'atok',
    body: eventBody,
    fetch: fetchFn,
  });

  assertEquals(result.eventId, 'evt_abc123');
  assertEquals(
    calls[0].url,
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
  );
  assertEquals(calls[0].init.method, 'POST');
  assertObjectMatch(calls[0].init.headers as Record<string, string>, {
    Authorization: 'Bearer atok',
  });
});

Deno.test('insertCalendarEvent: 401 → GoogleApiError(unauthorized)', async () => {
  const fetchFn: typeof fetch = () =>
    Promise.resolve(makeJsonResponse(401, { error: { message: 'auth' } }));

  const err = await assertRejects(
    () =>
      insertCalendarEvent({
        accessToken: 'atok',
        body: eventBody,
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'unauthorized');
});

Deno.test('insertCalendarEvent: 429 → GoogleApiError(rate_limit)', async () => {
  const fetchFn: typeof fetch = () =>
    Promise.resolve(makeJsonResponse(429, { error: { message: 'rate' } }));

  const err = await assertRejects(
    () =>
      insertCalendarEvent({
        accessToken: 'atok',
        body: eventBody,
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'rate_limit');
});

Deno.test('insertCalendarEvent: 500 → GoogleApiError(unknown)', async () => {
  const fetchFn: typeof fetch = () =>
    Promise.resolve(makeJsonResponse(500, { error: { message: 'oops' } }));

  const err = await assertRejects(
    () =>
      insertCalendarEvent({
        accessToken: 'atok',
        body: eventBody,
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'unknown');
});

Deno.test('insertCalendarEvent: 200 응답에 id 누락 → GoogleApiError(unknown)', async () => {
  const fetchFn: typeof fetch = () =>
    Promise.resolve(makeJsonResponse(200, { kind: 'calendar#event' }));

  const err = await assertRejects(
    () =>
      insertCalendarEvent({
        accessToken: 'atok',
        body: eventBody,
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'unknown');
});

Deno.test('insertCalendarEvent: fetch reject → GoogleApiError(network)', async () => {
  const fetchFn: typeof fetch = () => Promise.reject(new Error('ETIMEDOUT'));

  const err = await assertRejects(
    () =>
      insertCalendarEvent({
        accessToken: 'atok',
        body: eventBody,
        fetch: fetchFn,
      }),
    GoogleApiError,
  );
  assertEquals(err.detail.kind, 'network');
});

Deno.test('insertCalendarEvent: request body는 JSON stringify된 events 본문', async () => {
  let capturedBody = '';
  const fetchFn: typeof fetch = (_url, init) => {
    // supabase-js가 끌어오는 RequestInit 정의와 Deno 내장 정의가 유니온으로 충돌해
    // init.body 직접 접근이 타입 에러 — 테스트가 관심 있는 shape로만 좁혀 캡처.
    capturedBody = String((init as { body?: unknown } | undefined)?.body ?? '');
    return Promise.resolve(makeJsonResponse(200, { id: 'evt_x' }));
  };

  await insertCalendarEvent({
    accessToken: 'atok',
    body: eventBody,
    fetch: fetchFn,
  });

  const parsed = JSON.parse(capturedBody);
  assertEquals(parsed.summary, '안암 저녁 모임');
  assertEquals(parsed.start.timeZone, 'Asia/Seoul');
});
