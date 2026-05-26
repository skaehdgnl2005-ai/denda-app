// group_confirm — 모임 시간·장소 확정 (S04)
//
// 호스트가 시간 그리드에서 슬롯을 골라 "확정" 액션 trigger. 본 Edge가:
//   1) 입력 검증 (D14 15분 슬롯, 09:00~24:00 범위)
//   2) groups SELECT (dates · host_id · confirmed_at)
//   3) 호스트 권한 = 사용자 JWT의 anon client UPDATE (RLS groups_update_host가 자연 차단)
//   4) idempotent UPDATE WHERE confirmed_at IS NULL (D17 mirror — 더블 탭 안전)
//   5) 성공 시 dispatcher.dispatch({type:'group_confirmed'}) → in-process fan-out (D33)
//   6) notify_f5 handler가 dispatcher에 register되어 있어 F5 push 자동 발송
//
// Request: POST {
//   group_id: uuid,
//   day_index: number  (groups.dates의 0-based offset, Q-B21 close),
//   start_minute: number (KST minute-of-day, %15=0, 540~<1440),
//   end_minute: number   (KST minute-of-day, %15=0, >start, ≤1440),
//   confirmed_place_id: uuid | null
// }
// Response: {
//   ok: true,
//   confirmed_at: string (KST ISO),
//   already_confirmed?: boolean,
//   f5_dispatch: { fulfilled: number, rejected: number }
// }
//
// 환경변수:
//   SUPABASE_URL                — 자동
//   SUPABASE_SERVICE_ROLE_KEY   — 자동
//   SUPABASE_ANON_KEY           — 자동 (host JWT UPDATE 용)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { DateTime } from 'npm:luxon@3.4.4';

import { getAnonClient, getServiceRoleClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import { nowKst } from '../_lib/kst.ts';
import {
  clearHandlers,
  dispatch,
  register,
  type DispatchEvent,
} from '../_lib/dispatcher.ts';
import { handler as notifyF5Handler } from '../notify_f5/index.ts';

const KST_ZONE = 'Asia/Seoul';

// ---------------------------------------------------------------------------
// 순수 함수: 입력 파싱 / 검증 / KST→UTC 변환
// ---------------------------------------------------------------------------

export interface ConfirmRequestRaw {
  group_id?: unknown;
  day_index?: unknown;
  start_minute?: unknown;
  end_minute?: unknown;
  confirmed_place_id?: unknown;
}

export interface ConfirmRequest {
  groupId: string;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  confirmedPlaceId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

export function parseConfirmRequest(body: ConfirmRequestRaw): ConfirmRequest {
  if (!isUuid(body.group_id)) {
    throw new Error('group_id (UUID)가 필요합니다.');
  }
  if (!isNonNegativeInt(body.day_index)) {
    throw new Error('day_index는 0 이상 정수여야 합니다.');
  }
  if (!isNonNegativeInt(body.start_minute)) {
    throw new Error('start_minute는 0 이상 정수여야 합니다.');
  }
  if (!isNonNegativeInt(body.end_minute)) {
    throw new Error('end_minute는 0 이상 정수여야 합니다.');
  }
  let confirmedPlaceId: string | null = null;
  if (body.confirmed_place_id !== null && body.confirmed_place_id !== undefined) {
    if (!isUuid(body.confirmed_place_id)) {
      throw new Error('confirmed_place_id가 UUID 형식이 아닙니다.');
    }
    confirmedPlaceId = body.confirmed_place_id;
  }
  return {
    groupId: body.group_id,
    dayIndex: body.day_index,
    startMinute: body.start_minute,
    endMinute: body.end_minute,
    confirmedPlaceId,
  };
}

export interface ValidateInputArgs {
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  datesCount: number;
}

/**
 * D14 (15분 슬롯) + 09:00~24:00 범위 + start < end + day_index 범위.
 * DB CHECK constraint가 1차 방어선이지만 즉시 친절한 메시지 위해 application 검증.
 */
export function validateConfirmInput(args: ValidateInputArgs): void {
  if (args.datesCount === 0 || args.dayIndex >= args.datesCount) {
    throw new Error('day_index가 모임의 날짜 범위를 벗어났습니다.');
  }
  if (args.startMinute % 15 !== 0 || args.endMinute % 15 !== 0) {
    throw new Error('시간은 15분 단위로 선택해야 합니다.');
  }
  if (args.startMinute < 540 || args.startMinute >= 1440) {
    throw new Error('시작 시간은 09:00 ~ 23:45 사이여야 합니다.');
  }
  if (args.endMinute <= args.startMinute || args.endMinute > 1440) {
    throw new Error('종료 시간은 시작 시간보다 늦고 24:00 이하여야 합니다.');
  }
}

export interface BuildTimestampsArgs {
  dayIsoDate: string; // 'YYYY-MM-DD'
  startMinute: number;
  endMinute: number;
}

export interface ConfirmedTimestamps {
  startUtcIso: string;
  endUtcIso: string;
}

/**
 * KST day + minute-of-day → UTC ISO (D13).
 * end_minute=1440 (24:00)은 다음날 00:00 KST.
 */
export function buildConfirmedTimestamps(
  args: BuildTimestampsArgs,
): ConfirmedTimestamps {
  const base = DateTime.fromISO(args.dayIsoDate, { zone: KST_ZONE });
  if (!base.isValid) {
    throw new Error(`dayIsoDate parse 실패: ${args.dayIsoDate}`);
  }
  const start = base.plus({ minutes: args.startMinute });
  const end = base.plus({ minutes: args.endMinute });
  const startUtc = start.toUTC().toISO();
  const endUtc = end.toUTC().toISO();
  if (!startUtc || !endUtc) {
    throw new Error('UTC ISO 변환 실패');
  }
  return { startUtcIso: startUtc, endUtcIso: endUtc };
}

// ---------------------------------------------------------------------------
// Dispatcher handler 등록 — 모듈 import 시 1회
// ---------------------------------------------------------------------------
// notify_f5의 handler를 dispatcher에 register. group_confirmed event를 받으면
// notify_f5 handler가 group_id로 push 발송 (in-process, D33).
//
// 테스트 환경에서는 dispatcher_test.ts가 `clearHandlers()`로 reset하므로 충돌 X.

let f5HandlerRegistered = false;

function registerF5Handler(): void {
  if (f5HandlerRegistered) return;
  register('group_confirmed', async (event: DispatchEvent) => {
    if (event.type !== 'group_confirmed') return;
    // notify_f5 handler를 직접 호출 (HTTP overhead 회피, in-process).
    // Request 형태로 body 전달.
    const fakeReq = new Request('http://internal/notify_f5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: event.groupId }),
    });
    await notifyF5Handler(fakeReq);
  });
  f5HandlerRegistered = true;
}

// 테스트가 dispatcher state를 reset할 때 다시 register할 수 있도록 export
export function _resetDispatcherRegistration(): void {
  clearHandlers();
  f5HandlerRegistered = false;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  registerF5Handler();

  let rawBody: ConfirmRequestRaw;
  try {
    rawBody = (await req.json()) as ConfirmRequestRaw;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  let parsed: ConfirmRequest;
  try {
    parsed = parseConfirmRequest(rawBody);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('인증이 필요합니다.', 401);
  }

  const anon = getAnonClient(authHeader);
  const service = getServiceRoleClient();

  // 1) groups 조회 (service_role — dates · host_id · confirmed_at 모두 필요)
  const { data: group, error: groupError } = await service
    .from('groups')
    .select('id, host_id, name, dates, confirmed_at')
    .eq('id', parsed.groupId)
    .single();

  if (groupError) {
    return errorResponse(`groups 조회 실패: ${groupError.message}`, 500);
  }
  if (!group) {
    return errorResponse(`group_id=${parsed.groupId} not found`, 404);
  }

  const g = group as {
    id: string;
    host_id: string;
    name: string;
    dates: string[];
    confirmed_at: string | null;
  };

  try {
    validateConfirmInput({
      dayIndex: parsed.dayIndex,
      startMinute: parsed.startMinute,
      endMinute: parsed.endMinute,
      datesCount: g.dates?.length ?? 0,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 400);
  }

  // 이미 확정된 모임 — idempotent 200 OK (더블 탭 안전)
  if (g.confirmed_at) {
    return jsonResponse({
      ok: true,
      confirmed_at: g.confirmed_at,
      already_confirmed: true,
      f5_dispatch: { fulfilled: 0, rejected: 0 },
    });
  }

  const dayIsoDate = g.dates[parsed.dayIndex];
  const timestamps = buildConfirmedTimestamps({
    dayIsoDate,
    startMinute: parsed.startMinute,
    endMinute: parsed.endMinute,
  });

  const confirmedAtKst = nowKst().toISO() ?? '';

  // 2) UPDATE WHERE confirmed_at IS NULL via anon client (RLS가 호스트만 허용)
  //    .select()로 변경된 row 받아 0 rows 시 race 또는 권한 부족 식별.
  const { data: updatedRows, error: updateError } = await anon
    .from('groups')
    .update({
      confirmed_at: confirmedAtKst,
      confirmed_start_at: timestamps.startUtcIso,
      confirmed_end_at: timestamps.endUtcIso,
      confirmed_place_id: parsed.confirmedPlaceId,
    })
    .eq('id', parsed.groupId)
    .is('confirmed_at', null)
    .select('id, confirmed_at');

  if (updateError) {
    return errorResponse(`확정 실패: ${updateError.message}`, 500);
  }

  if (!updatedRows || updatedRows.length === 0) {
    // RLS 차단(호스트 아님) 또는 race(다른 호스트 디바이스가 먼저 확정)
    // 다시 조회해서 race인지 권한 부족인지 구분
    const { data: recheck } = await service
      .from('groups')
      .select('confirmed_at, host_id')
      .eq('id', parsed.groupId)
      .single();
    if (recheck && (recheck as { confirmed_at: string | null }).confirmed_at) {
      return jsonResponse({
        ok: true,
        confirmed_at: (recheck as { confirmed_at: string }).confirmed_at,
        already_confirmed: true,
        f5_dispatch: { fulfilled: 0, rejected: 0 },
      });
    }
    return errorResponse('호스트만 모임을 확정할 수 있습니다.', 403);
  }

  // 3) dispatcher publish — F5 push fan-out (D33). Promise.allSettled로 격리.
  const dispatchResults = await dispatch({
    type: 'group_confirmed',
    groupId: parsed.groupId,
    hostId: g.host_id,
    confirmedAt: confirmedAtKst,
  });
  const rejected = dispatchResults.filter((r) => r.status === 'rejected').length;
  const fulfilled = dispatchResults.filter((r) => r.status === 'fulfilled').length;

  return jsonResponse({
    ok: true,
    confirmed_at: confirmedAtKst,
    f5_dispatch: { fulfilled, rejected },
  });
}

if (import.meta.main) {
  serve(handler);
}

export { handler };
