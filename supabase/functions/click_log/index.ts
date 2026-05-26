// click_log — "예약하기" 버튼 click event 기록 (S08, Gate #2 single source of truth)
//
// 마커 바텀시트 "예약하기" 버튼 tap → 클라가 event_id (UUID) 생성 + POST.
// 본 Edge가:
//   1) 입력 검증 (event_id/group_id/place_id UUID + partnership_id?/segment_label? 옵션)
//   2) Anon client (header passthrough) → auth.getUser()로 사용자 식별
//   3) click_events INSERT — event_id PK 충돌 시 ON CONFLICT DO NOTHING으로 idempotency
//      (acceptance "더블 탭 1 event" — Idempotency-Key pattern)
//
// Request: POST {
//   event_id: uuid           — 클라가 발급 (crypto.randomUUID()). 재시도 시 같은 값 유지
//   group_id: uuid           — Gate #1 → #2 funnel context
//   place_id: uuid           — click 대상 장소
//   partnership_id?: uuid|null — 제휴 여부 snapshot (places.partnership_id를 클라가 함께 보냄)
//   segment_label?: 'P1'|'P2'|null — Q-A4 closure 시 채움
// }
// Response: {
//   ok: true,
//   event_id: string,
//   duplicated: boolean       — true면 이미 같은 event_id 존재 (no-op idempotent)
// }
//
// 환경변수:
//   SUPABASE_URL                — 자동
//   SUPABASE_ANON_KEY           — 자동 (auth.getUser + RLS INSERT 통과)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getAnonClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import { nowKst } from '../_lib/kst.ts';

// ---------------------------------------------------------------------------
// 순수 함수: 입력 파싱 / row 구성
// ---------------------------------------------------------------------------

export type SegmentLabel = 'P1' | 'P2';

export interface ClickLogRequestRaw {
  event_id?: unknown;
  group_id?: unknown;
  place_id?: unknown;
  partnership_id?: unknown;
  segment_label?: unknown;
}

export interface ClickLogRequest {
  eventId: string;
  groupId: string;
  placeId: string;
  partnershipId: string | null;
  segmentLabel: SegmentLabel | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function isSegmentLabel(v: unknown): v is SegmentLabel {
  return v === 'P1' || v === 'P2';
}

export function parseClickLogRequest(body: ClickLogRequestRaw): ClickLogRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('요청 본문이 필요합니다.');
  }
  if (!isUuid(body.event_id)) {
    throw new Error('event_id (UUID)가 필요합니다.');
  }
  if (!isUuid(body.group_id)) {
    throw new Error('group_id (UUID)가 필요합니다.');
  }
  if (!isUuid(body.place_id)) {
    throw new Error('place_id (UUID)가 필요합니다.');
  }

  let partnershipId: string | null = null;
  if (body.partnership_id !== null && body.partnership_id !== undefined) {
    if (!isUuid(body.partnership_id)) {
      throw new Error('partnership_id가 UUID 형식이 아닙니다.');
    }
    partnershipId = body.partnership_id;
  }

  let segmentLabel: SegmentLabel | null = null;
  if (body.segment_label !== null && body.segment_label !== undefined) {
    if (!isSegmentLabel(body.segment_label)) {
      throw new Error("segment_label은 'P1' 또는 'P2'만 허용됩니다.");
    }
    segmentLabel = body.segment_label;
  }

  return {
    eventId: body.event_id,
    groupId: body.group_id,
    placeId: body.place_id,
    partnershipId,
    segmentLabel,
  };
}

export interface BuildClickEventRowArgs {
  eventId: string;
  userId: string;
  groupId: string;
  placeId: string;
  partnershipId: string | null;
  segmentLabel: SegmentLabel | null;
  clickedAtIso: string;
}

export interface ClickEventRow {
  event_id: string;
  user_id: string;
  group_id: string;
  place_id: string;
  partnership_id: string | null;
  segment_label: SegmentLabel | null;
  clicked_at: string;
}

export function buildClickEventRow(args: BuildClickEventRowArgs): ClickEventRow {
  return {
    event_id: args.eventId,
    user_id: args.userId,
    group_id: args.groupId,
    place_id: args.placeId,
    partnership_id: args.partnershipId,
    segment_label: args.segmentLabel,
    clicked_at: args.clickedAtIso,
  };
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

  let rawBody: ClickLogRequestRaw;
  try {
    rawBody = (await req.json()) as ClickLogRequestRaw;
  } catch {
    return errorResponse('요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  let parsed: ClickLogRequest;
  try {
    parsed = parseClickLogRequest(rawBody);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('인증이 필요합니다.', 401);
  }

  const anon = getAnonClient(authHeader);

  // 사용자 식별 — anon client + JWT
  const { data: userData, error: userError } = await anon.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse('인증이 만료되었어요. 다시 로그인해주세요.', 401);
  }

  const clickedAtIso = nowKst().toUTC().toISO() ?? new Date().toISOString();

  const row = buildClickEventRow({
    eventId: parsed.eventId,
    userId: userData.user.id,
    groupId: parsed.groupId,
    placeId: parsed.placeId,
    partnershipId: parsed.partnershipId,
    segmentLabel: parsed.segmentLabel,
    clickedAtIso,
  });

  // INSERT — ON CONFLICT (event_id PK) DO NOTHING으로 idempotency.
  // supabase-js upsert + ignoreDuplicates: 충돌 시 0 rows 반환.
  const { data: inserted, error: insertError } = await anon
    .from('click_events')
    .upsert(row, { onConflict: 'event_id', ignoreDuplicates: true })
    .select('event_id');

  if (insertError) {
    // RLS 위반 (auth.uid() != user_id) — 코드 path 사실상 불가 (위에서 userId set)
    // FK 위반 — group_id/place_id/partnership_id 미존재 row
    return errorResponse(`click_log 실패: ${insertError.message}`, 500);
  }

  const duplicated = !inserted || inserted.length === 0;

  return jsonResponse({
    ok: true,
    event_id: parsed.eventId,
    duplicated,
  });
}

if (import.meta.main) {
  serve(handler);
}

export { handler };
