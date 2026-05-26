// S04 — 모임 확정 클라이언트 wrapper (Edge Function `group_confirm`).
// 서버가 모임 시간·장소 확정 + 호스트 RLS 검증 + idempotency (D17 mirror) + F5 push
// dispatcher fan-out (D33)을 atomic 처리.

import { supabase } from '@/lib/supabase/client';
import { type ConfirmGroupInput, validateConfirmGroupInput } from './validation';

export interface ConfirmGroupResult {
  ok: true;
  confirmedAt: string; // KST ISO
  alreadyConfirmed: boolean;
  f5Dispatch: { fulfilled: number; rejected: number };
}

interface ConfirmEdgeResponse {
  ok: true;
  confirmed_at: string;
  already_confirmed?: boolean;
  f5_dispatch: { fulfilled: number; rejected: number };
}

export async function confirmGroup(input: ConfirmGroupInput): Promise<ConfirmGroupResult> {
  const validation = validateConfirmGroupInput(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { data, error } = await supabase.functions.invoke<ConfirmEdgeResponse>('group_confirm', {
    body: {
      group_id: input.groupId,
      day_index: input.dayIndex,
      start_minute: input.startMinute,
      end_minute: input.endMinute,
      confirmed_place_id: input.confirmedPlaceId,
    },
  });

  if (error) {
    const message = error.message ?? '';
    if (/호스트만/.test(message) || /403/.test(message)) {
      throw new Error('호스트만 모임을 확정할 수 있어요.');
    }
    if (/인증/.test(message) || /401/.test(message)) {
      throw new Error('로그인이 필요해요.');
    }
    throw new Error('모임을 확정하지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (!data) {
    throw new Error('모임을 확정하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  return {
    ok: true,
    confirmedAt: data.confirmed_at,
    alreadyConfirmed: data.already_confirmed ?? false,
    f5Dispatch: data.f5_dispatch,
  };
}
