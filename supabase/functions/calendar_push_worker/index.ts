// calendar_push_worker — S06 D20 background queue worker
//
// pg_cron이 매 1분 호출 (migration 0010). 동작:
//   1. SELECT pending groups (LIMIT QUEUE_BATCH_SIZE) — partial index `groups_calendar_push_pending_idx` 활용
//   2. selectPendingFromRows로 application level 한 번 더 필터 (race 안전망)
//   3. 각 group: group_members fetch + buildCalendarEventPayload + 멤버 iterate push
//   4. decideGroupPushOutcome으로 DB UPDATE 의사결정 (순수)
//   5. 모두 성공 → calendar_pushed_at SET. 일부 실패 → partial_fail_list append + retry_count++
//
// ⚠️ 본 sub-task(S06-worker-integration)는 외부 push를 stub으로 처리:
//   pushToMemberCalendar 가 CalendarPushUnimplementedError throw.
//   → 모든 멤버 outcomes = { reason: 'UNIMPLEMENTED' }로 분류되어 retry_count 누적이 검증됨.
//   다음 sub-task(S06-google-oauth + S06-apple-expo-calendar)에서 실 구현으로 교체.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

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

const QUEUE_BATCH_SIZE = 50;

const PENDING_SELECT_COLUMNS =
  'id, name, host_id, confirmed_at, confirmed_start_at, confirmed_end_at, calendar_pushed_at, calendar_retry_count, partial_fail_list';

// ---------------------------------------------------------------------------
// Stub push — S06-google-oauth + S06-apple-expo-calendar에서 실 구현으로 교체
// ---------------------------------------------------------------------------

export class CalendarPushUnimplementedError extends Error {
  constructor(public memberId: string) {
    super(`pushToMemberCalendar UNIMPLEMENTED for member ${memberId}`);
    this.name = 'CalendarPushUnimplementedError';
  }
}

/**
 * 본 sub-task의 stub. throws CalendarPushUnimplementedError.
 * 다음 sub-task에서:
 *   - users.calendar_preference 조회 ('google' | 'apple_ios' | 'both' | null)
 *   - Google: OAuth token + events.insert
 *   - Apple: 클라이언트 측 expo-calendar (worker가 push 못함 → 별도 mechanism 필요)
 *     → Apple은 client-side만 가능. worker는 Google + push notification(F5와 별도) 패턴 검토.
 */
export async function pushToMemberCalendar(
  memberId: string,
  _payload: CalendarEventPayload,
): Promise<void> {
  // S06-worker-integration: 모두 fail로 분류되어 retry_count 누적 검증
  throw new CalendarPushUnimplementedError(memberId);
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
  service: ReturnType<typeof getServiceRoleClient>;
  push?: (memberId: string, payload: CalendarEventPayload) => Promise<void>;
  occurredAtKstIso?: string;
  batchSize?: number;
}

export async function processCalendarPushQueue(
  deps: ProcessQueueDeps,
): Promise<WorkerSummary> {
  const service = deps.service;
  const push = deps.push ?? pushToMemberCalendar;
  const occurredAtKstIso = deps.occurredAtKstIso ?? (nowKst().toISO() ?? '');
  const batchSize = deps.batchSize ?? QUEUE_BATCH_SIZE;

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
    const decision = await processOneGroup({
      service,
      group,
      push,
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
  service: ReturnType<typeof getServiceRoleClient>;
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
