// calendar_push_worker — S06 D20 background queue worker
//
// pg_cron이 매 1분 호출 (migration 0010). 동작:
//   1. SELECT pending groups (LIMIT QUEUE_BATCH_SIZE) — partial index `groups_calendar_push_pending_idx` 활용
//   2. selectPendingFromRows로 application level 한 번 더 필터 (race 안전망)
//   3. 각 group: group_members fetch + buildCalendarEventPayload + 멤버 iterate push
//   4. decideGroupPushOutcome으로 DB UPDATE 의사결정 (순수)
//   5. 모두 성공 → calendar_pushed_at SET. 일부 실패 → partial_fail_list append + retry_count++
//
// S06-worker-google-integration (2026-05-26 본 sub-task):
//   - pushToMemberCalendar는 users.calendar_preference 분기 처리:
//     · 'google' / 'both' → _lib/google_calendar.ts로 events.insert (D35: user_oauth_tokens SELECT/UPDATE)
//     · 'apple_ios' → silent ok (S06-worker-apple-trigger에서 calendar_push_apple_pending INSERT로 교체 — D34)
//     · 'none' / NULL → silent ok (사용자가 캘린더 거부 또는 첫 모달 미진행)
//   - Google 에러 → partial_fail_list reason: 'no_token' / 'token_expired' / 'unauthorized' / 'rate_limit' / 'network' / 'unknown'

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getServiceRoleClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import { nowKst } from '../_lib/kst.ts';
import {
  appendPartialFailEntries,
  buildCalendarEventPayload,
  type CalendarEventPayload,
  type CalendarQueueGroup,
  decideGroupPushOutcome,
  type GroupPushDecision,
  type MemberPushOutcome,
  type PartialFailEntry,
  selectPendingFromRows,
} from '../_lib/calendar_queue.ts';
import {
  buildGoogleEventBody,
  GoogleApiError,
  insertCalendarEvent,
  isAccessTokenExpired,
  refreshAccessToken,
} from '../_lib/google_calendar.ts';

const QUEUE_BATCH_SIZE = 50;
const GOOGLE_PROVIDER = 'google_calendar';

const PENDING_SELECT_COLUMNS =
  'id, name, host_id, confirmed_at, confirmed_start_at, confirmed_end_at, calendar_pushed_at, calendar_retry_count, partial_fail_list';

// ---------------------------------------------------------------------------
// Push reason codes — partial_fail_list reason 값 (운영 통계 + 호스트 알림 분기 시 사용)
// ---------------------------------------------------------------------------

export const PUSH_FAIL_REASONS = {
  noToken: 'no_token',
  tokenExpired: 'token_expired',
  unauthorized: 'unauthorized',
  rateLimit: 'rate_limit',
  network: 'network',
  unknown: 'unknown',
  appleEnqueueFailed: 'apple_enqueue_failed',
} as const;

// ---------------------------------------------------------------------------
// Push context — defaultPushToMember가 사용할 의존성 묶음 (DI)
// ---------------------------------------------------------------------------

export interface PushContext {
  service: SupabaseClient;
  fetch: typeof globalThis.fetch;
  googleClientId: string;
  googleClientSecret: string;
  /** Token 만료 비교 + 새 만료 시각 계산용 unix ms. */
  nowMs: () => number;
  /**
   * 현재 push 처리 중인 group id (apple_pending INSERT용). worker가 group iterate 시 ctx에 주입.
   * Apple/both 분기에서만 필요 — google-only는 무관.
   */
  currentGroupId?: string;
}

/**
 * 멤버 캘린더 push — calendar_preference 분기.
 * - 'google'/'both' → Google API events.insert (S06-worker-google-integration)
 * - 'apple_ios'/'both' → calendar_push_apple_pending row INSERT (S06-worker-apple-trigger, D34)
 *   클라이언트(useApplePendingSync hook)가 foreground 진입 시 SELECT → expo-calendar insert → completed_at UPDATE
 * - 'none'/NULL → silent ok (F5 알림만으로 충분)
 *
 * 'both' 케이스: Google + Apple 모두 처리. Promise.all로 fail-first — 한쪽 실패 시 throw로
 * decideGroupPushOutcome이 retry 처리. apple_pending INSERT는 ON CONFLICT DO NOTHING으로
 * idempotent, Google insert는 retry max 3 회복.
 */
export async function pushToMemberCalendar(
  ctx: PushContext,
  memberId: string,
  payload: CalendarEventPayload,
): Promise<void> {
  const pref = await fetchCalendarPreference(ctx.service, memberId);

  if (pref === null || pref === 'none') {
    return;
  }

  const tasks: Promise<void>[] = [];
  if (pref === 'google' || pref === 'both') {
    tasks.push(pushGoogleForUser(ctx, memberId, payload));
  }
  if (pref === 'apple_ios' || pref === 'both') {
    tasks.push(enqueueApplePending(ctx, memberId, payload));
  }
  if (tasks.length === 0) {
    // 알 수 없는 preference 값 (CHECK constraint에 막혀야 하지만 방어적)
    return;
  }
  await Promise.all(tasks);
}

async function fetchCalendarPreference(
  service: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await service
    .from('users')
    .select('calendar_preference')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(`calendar_preference SELECT 실패 (user=${userId}): ${error.message}`);
  }
  const pref = (data as { calendar_preference?: string | null } | null)?.calendar_preference;
  return pref ?? null;
}

interface GoogleTokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
}

async function pushGoogleForUser(
  ctx: PushContext,
  userId: string,
  payload: CalendarEventPayload,
): Promise<void> {
  // 1) user_oauth_tokens SELECT
  const { data: tokenData, error: tokenError } = await ctx.service
    .from('user_oauth_tokens')
    .select('access_token, refresh_token, expires_at, scope')
    .eq('user_id', userId)
    .eq('provider', GOOGLE_PROVIDER)
    .maybeSingle();

  if (tokenError) {
    throw new Error(
      `user_oauth_tokens SELECT 실패 (user=${userId}): ${tokenError.message}`,
    );
  }
  if (!tokenData) {
    // 사용자가 'google'/'both' 선호지만 OAuth 미진행 — 재인증 모달 trigger 후보
    throw memberFailureReason(PUSH_FAIL_REASONS.noToken);
  }

  let { access_token, refresh_token, expires_at } = tokenData as GoogleTokenRow;

  // 2) 만료 검사 + refresh
  if (isAccessTokenExpired(expires_at, ctx.nowMs())) {
    try {
      const refreshed = await refreshAccessToken({
        clientId: ctx.googleClientId,
        clientSecret: ctx.googleClientSecret,
        refreshToken: refresh_token,
        fetch: ctx.fetch,
      });
      access_token = refreshed.accessToken;
      const newExpiresAt = new Date(
        ctx.nowMs() + refreshed.expiresInSeconds * 1000,
      ).toISOString();
      const nextRefreshToken = refreshed.refreshToken ?? refresh_token;

      const { error: updErr } = await ctx.service
        .from('user_oauth_tokens')
        .update({
          access_token,
          refresh_token: nextRefreshToken,
          expires_at: newExpiresAt,
        })
        .eq('user_id', userId)
        .eq('provider', GOOGLE_PROVIDER);
      if (updErr) {
        console.error(
          `user_oauth_tokens UPDATE 실패 (user=${userId}): ${updErr.message}`,
        );
      }
    } catch (error) {
      if (error instanceof GoogleApiError) {
        if (error.detail.kind === 'token_expired') {
          // refresh_token 만료/revoke → row 삭제 → 사용자 재인증 필요 (모달 trigger)
          await deleteGoogleToken(ctx.service, userId);
          throw memberFailureReason(PUSH_FAIL_REASONS.tokenExpired);
        }
        if (error.detail.kind === 'network') {
          throw memberFailureReason(PUSH_FAIL_REASONS.network);
        }
        throw memberFailureReason(PUSH_FAIL_REASONS.unknown);
      }
      throw error;
    }
  }

  // 3) events.insert
  const body = buildGoogleEventBody(payload);
  try {
    await insertCalendarEvent({
      accessToken: access_token,
      body,
      fetch: ctx.fetch,
    });
  } catch (error) {
    if (error instanceof GoogleApiError) {
      if (error.detail.kind === 'unauthorized') {
        // access_token revoke됨 — 다음 retry에서 refresh 시도 가능하지만 본 회는 fail
        throw memberFailureReason(PUSH_FAIL_REASONS.unauthorized);
      }
      if (error.detail.kind === 'rate_limit') {
        throw memberFailureReason(PUSH_FAIL_REASONS.rateLimit);
      }
      if (error.detail.kind === 'network') {
        throw memberFailureReason(PUSH_FAIL_REASONS.network);
      }
      throw memberFailureReason(PUSH_FAIL_REASONS.unknown);
    }
    throw error;
  }
}

async function deleteGoogleToken(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await service
    .from('user_oauth_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('provider', GOOGLE_PROVIDER);
  if (error) {
    console.error(
      `user_oauth_tokens DELETE 실패 (user=${userId}): ${error.message}`,
    );
  }
}

/**
 * Promise.allSettled reason으로 잡힐 Error 인스턴스 — message가 reason code.
 * decideGroupPushOutcome가 result.reason으로 추출 → partial_fail_list에 누적.
 */
function memberFailureReason(reason: string): Error {
  return new Error(reason);
}

// ---------------------------------------------------------------------------
// Apple pending — D34 클라 polling 패턴
// ---------------------------------------------------------------------------

/**
 * calendar_push_apple_pending에 row INSERT (멤버별 pending).
 * (group_id, user_id) UNIQUE → ON CONFLICT DO NOTHING으로 idempotent (worker가 retry 시 안전).
 * INSERT 실패는 reason='apple_enqueue_failed'로 throw → partial_fail_list 누적.
 *
 * 클라이언트(`src/lib/calendar/applePending.ts`)가 본 row를 SELECT → 처리 → completed_at UPDATE.
 * worker는 INSERT만 책임 — 실제 expo-calendar 호출은 클라 디바이스에서.
 */
async function enqueueApplePending(
  ctx: PushContext,
  userId: string,
  payload: CalendarEventPayload,
): Promise<void> {
  // CalendarEventPayload → group_id 추출은 worker 측에서 별도 전달 필요.
  // 본 함수 signature는 멤버 push와 일관 (memberId, payload)만 받음.
  // group_id는 payload.title이 아닌 별도 필드가 필요 — 임시: payload 안에 안 들어있으므로
  // worker가 enqueue 함수 직접 호출 시점에 ctx에 group_id 주입할 수도 있음.
  //
  // 본 함수는 ctx에 currentGroupId가 없으므로 _enqueueApplePendingRow로 우회 — pushToMemberCalendar
  // 호출 측에서 group_id를 ctx로 묶어 전달해야 함.
  //
  // 단순화: payload에 (Google body와 무관한) groupId 필드를 추가하는 대신, ctx.currentGroupId로 전달.
  const groupId = ctx.currentGroupId;
  if (!groupId) {
    throw new Error('enqueueApplePending: ctx.currentGroupId가 필요합니다.');
  }

  // payload는 plain object (CalendarEventPayload). JSONB로 직렬화는 supabase client가 자동.
  const { error } = await ctx.service
    .from('calendar_push_apple_pending')
    .upsert(
      [
        {
          group_id: groupId,
          user_id: userId,
          payload,
        },
      ],
      { onConflict: 'group_id,user_id', ignoreDuplicates: true },
    );

  if (error) {
    console.error(
      `calendar_push_apple_pending INSERT 실패 (group=${groupId}, user=${userId}): ${error.message}`,
    );
    throw memberFailureReason(PUSH_FAIL_REASONS.appleEnqueueFailed);
  }
}

// ---------------------------------------------------------------------------
// Worker entry — processCalendarPushQueue (export for test + manual invoke)
// ---------------------------------------------------------------------------

export interface WorkerSummary {
  scanned: number;
  pushedComplete: number;
  pushedPartialFail: number;
  retryStopped: number;
  skipped: number;
}

export interface ProcessQueueDeps {
  service: SupabaseClient;
  /**
   * 멤버별 push 함수 (DI). 기본은 본 모듈의 pushToMemberCalendar(google_calendar 통합).
   * 테스트 또는 dry-run 시 override 가능.
   */
  push?: (memberId: string, payload: CalendarEventPayload) => Promise<void>;
  /** Google API fetch DI. default = globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  /** 본 worker 호출 시점의 KST ISO. default = nowKst().toISO(). */
  occurredAtKstIso?: string;
  batchSize?: number;
  /** Google OAuth client id (Supabase secret env GOOGLE_CLIENT_ID). */
  googleClientId?: string;
  /** Google OAuth client secret (Supabase secret env GOOGLE_CLIENT_SECRET). */
  googleClientSecret?: string;
  /** Token 만료 비교용 unix ms. default = Date.now. */
  nowMs?: () => number;
}

export async function processCalendarPushQueue(
  deps: ProcessQueueDeps,
): Promise<WorkerSummary> {
  const service = deps.service;
  const fetchFn = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const occurredAtKstIso = deps.occurredAtKstIso ?? (nowKst().toISO() ?? '');
  const batchSize = deps.batchSize ?? QUEUE_BATCH_SIZE;
  const googleClientId = deps.googleClientId ?? Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
  const googleClientSecret =
    deps.googleClientSecret ?? Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
  const nowMs = deps.nowMs ?? (() => Date.now());

  const ctxBase: Omit<PushContext, 'currentGroupId'> = {
    service,
    fetch: fetchFn,
    googleClientId,
    googleClientSecret,
    nowMs,
  };

  const summary: WorkerSummary = {
    scanned: 0,
    pushedComplete: 0,
    pushedPartialFail: 0,
    retryStopped: 0,
    skipped: 0,
  };

  // 1) Pending SELECT — partial index 활용
  const { data: rawRows, error } = await service
    .from('groups')
    .select(PENDING_SELECT_COLUMNS)
    .not('confirmed_at', 'is', null)
    .is('calendar_pushed_at', null)
    .lt('calendar_retry_count', 3)
    .limit(batchSize);

  if (error) {
    throw new Error(`pending groups SELECT 실패: ${error.message}`);
  }
  if (!rawRows || rawRows.length === 0) return summary;

  // 2) Application 안전망 필터 (race window)
  const pending = selectPendingFromRows(rawRows as CalendarQueueGroup[]);
  summary.scanned = pending.length;

  for (const group of pending) {
    // group마다 ctx에 currentGroupId 주입 (apple_pending INSERT에 필요)
    const ctxForGroup: PushContext = { ...ctxBase, currentGroupId: group.id };
    const groupPush =
      deps.push ??
      ((memberId, payload) => pushToMemberCalendar(ctxForGroup, memberId, payload));
    const decision = await processOneGroup({
      service,
      group,
      push: groupPush,
      occurredAtKstIso,
    });
    if (decision === null) {
      summary.skipped++;
      continue;
    }
    if (decision.shouldSetPushedAt) {
      summary.pushedComplete++;
    } else if (decision.shouldStop) {
      summary.retryStopped++;
    } else {
      summary.pushedPartialFail++;
    }
  }

  return summary;
}

interface ProcessOneArgs {
  service: SupabaseClient;
  group: CalendarQueueGroup;
  push: (memberId: string, payload: CalendarEventPayload) => Promise<void>;
  occurredAtKstIso: string;
}

async function processOneGroup(
  args: ProcessOneArgs,
): Promise<GroupPushDecision | null> {
  const { service, group, push, occurredAtKstIso } = args;

  // 2-1) 멤버 list fetch
  const { data: membersData, error: memberError } = await service
    .from('group_members')
    .select('user_id')
    .eq('group_id', group.id);

  if (memberError) {
    console.error(
      `group ${group.id} members fetch 실패: ${memberError.message}`,
    );
    return null;
  }
  const memberIds: string[] = (membersData ?? []).map(
    (m) => (m as { user_id: string }).user_id,
  );

  // 2-2) payload build (confirmed_start_at / end_at은 isCalendarPushPending 통과 시점에 NOT NULL 보장)
  let payload: CalendarEventPayload;
  try {
    payload = buildCalendarEventPayload({
      id: group.id,
      name: group.name,
      confirmed_start_at: group.confirmed_start_at!,
      confirmed_end_at: group.confirmed_end_at!,
    });
  } catch (err) {
    console.error(
      `group ${group.id} payload build 실패: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }

  // 2-3) 멤버 iterate push (Promise.allSettled 격리 — 한 멤버 실패가 다른 멤버 차단 X)
  const settled = await Promise.allSettled(
    memberIds.map((id) => push(id, payload)),
  );
  const memberOutcomes: MemberPushOutcome[] = memberIds.map((id, idx) => {
    const s = settled[idx];
    if (s.status === 'fulfilled') return { userId: id, result: 'ok' };
    const reason = s.reason instanceof Error ? s.reason.message : String(s.reason);
    return { userId: id, result: { reason } };
  });

  // 2-4) DB UPDATE 의사결정 (순수)
  const decision = decideGroupPushOutcome({
    group,
    memberOutcomes,
    occurredAtKstIso,
  });

  // 2-5) DB UPDATE 실행
  if (decision.shouldSetPushedAt) {
    const { error: updErr } = await service
      .from('groups')
      .update({ calendar_pushed_at: occurredAtKstIso })
      .eq('id', group.id);
    if (updErr) {
      console.error(`group ${group.id} pushed_at UPDATE 실패: ${updErr.message}`);
    }
  } else {
    const existing = (group.partial_fail_list ?? []) as PartialFailEntry[];
    const newList = appendPartialFailEntries(
      existing,
      decision.newPartialFailEntries,
    );
    const { error: updErr } = await service
      .from('groups')
      .update({
        calendar_retry_count: decision.newRetryCount,
        partial_fail_list: newList,
      })
      .eq('id', group.id);
    if (updErr) {
      console.error(
        `group ${group.id} partial_fail UPDATE 실패: ${updErr.message}`,
      );
    }
  }

  return decision;
}

// ---------------------------------------------------------------------------
// HTTP handler — pg_cron 또는 manual invoke
// ---------------------------------------------------------------------------

async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  const service = getServiceRoleClient();
  try {
    const summary = await processCalendarPushQueue({ service });
    return jsonResponse({ ok: true, summary });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : String(err),
      500,
    );
  }
}

if (import.meta.main) {
  serve(handler);
}

export { handler };

// ---------------------------------------------------------------------------
// 그룹 partial_fail_list 컬럼 type에 대해 calendar_queue.ts CalendarQueueGroup 는
// `partial_fail_list?` 컬럼이 없음 — SELECT statement에서 가져오지만 타입은 동적 확장.
// CalendarQueueGroup 타입을 확장하면 application 의존 늘어남. 현재는 group 객체에 직접 접근.
// ---------------------------------------------------------------------------
