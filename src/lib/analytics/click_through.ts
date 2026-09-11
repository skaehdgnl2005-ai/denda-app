// S08 — "예약하기" 클릭 로깅 클라이언트 wrapper (Edge Function `click_log`).
//
// Gate #2 single source of truth — 마커 바텀시트 "예약하기" 탭 시 호출.
// 서버는 event_id PK + ON CONFLICT DO NOTHING으로 더블 탭/재시도 idempotency 보장.
//
// 사용 패턴:
//   await logReservationClick({groupId, placeId, partnershipId});
//
//   // 더블 탭 보호 (네트워크 지연 중 같은 event_id 재시도):
//   const eventId = crypto.randomUUID();
//   await logReservationClick({groupId, placeId, eventId});
//   // 같은 eventId로 재호출 → duplicated:true (no-op)
//
// DI:
//   options.genEventId — 테스트에서 deterministic UUID 주입. production에서는
//   expo-crypto Crypto.randomUUID() 사용 권장 (caller가 wrap해서 주입).

import { supabase } from '@/lib/supabase/client';

export type SegmentLabel = 'P1' | 'P2';

export interface LogReservationClickInput {
  groupId: string;
  placeId: string;
  partnershipId?: string | null;
  segmentLabel?: SegmentLabel | null;
  /** 재시도 시 같은 event_id로 호출하면 idempotent (서버가 ON CONFLICT DO NOTHING). */
  eventId?: string;
}

export interface LogReservationClickResult {
  ok: true;
  eventId: string;
  duplicated: boolean;
}

export interface LogReservationClickOptions {
  /** 기본 UUID 생성기. 미지정 시 globalThis.crypto.randomUUID() 사용. */
  genEventId?: () => string;
}

interface ClickLogEdgeResponse {
  ok: true;
  event_id: string;
  duplicated: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function defaultGenEventId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  throw new Error(
    'crypto.randomUUID를 사용할 수 없어요. genEventId 옵션으로 UUID 생성기를 주입해 주세요.',
  );
}

export async function logReservationClick(
  input: LogReservationClickInput,
  options: LogReservationClickOptions = {},
): Promise<LogReservationClickResult> {
  if (!UUID_RE.test(input.groupId)) {
    throw new Error('group_id (UUID)가 올바르지 않아요.');
  }
  if (!UUID_RE.test(input.placeId)) {
    throw new Error('place_id (UUID)가 올바르지 않아요.');
  }
  if (
    input.partnershipId !== undefined &&
    input.partnershipId !== null &&
    !UUID_RE.test(input.partnershipId)
  ) {
    throw new Error('partnership_id (UUID)가 올바르지 않아요.');
  }
  if (
    input.segmentLabel !== undefined &&
    input.segmentLabel !== null &&
    input.segmentLabel !== 'P1' &&
    input.segmentLabel !== 'P2'
  ) {
    throw new Error("segment_label은 'P1' 또는 'P2'만 허용됩니다.");
  }

  const genEventId = options.genEventId ?? defaultGenEventId;
  const eventId = input.eventId ?? genEventId();

  const { data, error } = await supabase.functions.invoke<ClickLogEdgeResponse>('click_log', {
    body: {
      event_id: eventId,
      group_id: input.groupId,
      place_id: input.placeId,
      partnership_id: input.partnershipId ?? null,
      segment_label: input.segmentLabel ?? null,
    },
  });

  if (error) {
    const message = error.message ?? '';
    if (/인증/.test(message) || /401/.test(message)) {
      throw new Error('로그인이 필요해요.');
    }
    throw new Error('클릭을 기록하지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (!data) {
    throw new Error('클릭을 기록하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  return {
    ok: true,
    eventId: data.event_id,
    duplicated: data.duplicated,
  };
}
