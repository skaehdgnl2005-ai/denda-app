// applePending — calendar_push_apple_pending 클라이언트 polling 처리.
//
// 책임 ([D34](../../../docs/DECISIONS.md#d34--apple-calendar-sync--클라-polling-패턴-q-b22-close)):
//   1. fetch pending rows (RLS 본인 행만 자동 격리)
//   2. 각 row: AppleCalendarProvider.insertEvent → completed_at UPDATE
//   3. permission 거부 시 전 row skip
//
// hook으로 wire-up은 별도 (S06-ui-first-time-modal 또는 S06-ui-reauth-modal과 묶음).
// 본 lib는 순수 + DI — supabase·apple 어댑터·now 모두 주입.

import { SupabaseClient } from '@supabase/supabase-js';

import { type AppleCalendarProvider } from './apple';
import { CalendarProviderError, type CalendarEventPayload } from './google';

const TABLE = 'calendar_push_apple_pending';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplePendingRow {
  id: string;
  groupId: string;
  userId: string;
  payload: CalendarEventPayload;
  createdAt: string;
}

export interface ApplePendingDeps {
  supabase: SupabaseClient;
  apple: AppleCalendarProvider;
  /** UPDATE completed_at에 set할 ISO 시각 (DI). */
  now: () => string;
}

export interface ApplePendingSummary {
  completed: number;
  failed: number;
  /** apple.isAuthorized()가 false라 전체 skip된 경우. UI에서 재인증 모달 trigger 후보. */
  skippedUnauthorized: boolean;
}

export type ProcessOneResult = { ok: true } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// parsePendingRow — DB row → ApplePendingRow (방어적)
// ---------------------------------------------------------------------------

function isCalendarEventPayload(value: unknown): value is CalendarEventPayload {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.title === 'string' &&
    typeof obj.startUtcIso === 'string' &&
    typeof obj.endUtcIso === 'string' &&
    typeof obj.descriptionKo === 'string' &&
    (obj.locationName === null || typeof obj.locationName === 'string')
  );
}

export function parsePendingRow(raw: unknown): ApplePendingRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || obj.id.length === 0) return null;
  if (typeof obj.group_id !== 'string' || obj.group_id.length === 0) return null;
  if (typeof obj.user_id !== 'string' || obj.user_id.length === 0) return null;
  if (typeof obj.created_at !== 'string') return null;
  if (!isCalendarEventPayload(obj.payload)) return null;

  return {
    id: obj.id,
    groupId: obj.group_id,
    userId: obj.user_id,
    payload: obj.payload,
    createdAt: obj.created_at,
  };
}

// ---------------------------------------------------------------------------
// processOneRow — 단일 row 처리 (insertEvent + UPDATE)
// ---------------------------------------------------------------------------

export async function processOneRow(
  deps: ApplePendingDeps,
  row: ApplePendingRow,
): Promise<ProcessOneResult> {
  try {
    await deps.apple.insertEvent(row.payload);
  } catch (error) {
    if (error instanceof CalendarProviderError) {
      return { ok: false, reason: error.detail.kind };
    }
    return { ok: false, reason: 'unknown' };
  }

  const { error: updErr } = await deps.supabase
    .from(TABLE)
    .update({ completed_at: deps.now() })
    .eq('id', row.id);

  if (updErr) {
    return { ok: false, reason: 'update_failed' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// processApplePendingPushes — entry point (foreground 진입 시 hook 호출)
// ---------------------------------------------------------------------------

export async function processApplePendingPushes(
  deps: ApplePendingDeps,
): Promise<ApplePendingSummary> {
  const summary: ApplePendingSummary = {
    completed: 0,
    failed: 0,
    skippedUnauthorized: false,
  };

  // 1) RLS로 본인 행만 자동 격리. completed_at IS NULL 미완료만.
  const { data, error } = await deps.supabase
    .from(TABLE)
    .select('id, group_id, user_id, payload, created_at, completed_at')
    .is('completed_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  const rawRows = data ?? [];
  if (rawRows.length === 0) return summary;

  // 2) permission check 1회 (rows 많아도 호출 1번)
  const authorized = await deps.apple.isAuthorized();
  if (!authorized) {
    summary.skippedUnauthorized = true;
    return summary;
  }

  // 3) 각 row 처리 — sequential (디바이스 expo-calendar API는 동시 호출 안전 보장 X)
  for (const raw of rawRows) {
    const row = parsePendingRow(raw);
    if (!row) {
      summary.failed++;
      continue;
    }
    const result = await processOneRow(deps, row);
    if (result.ok) {
      summary.completed++;
    } else {
      summary.failed++;
    }
  }

  return summary;
}
