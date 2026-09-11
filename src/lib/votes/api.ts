// S05c — vote diff commit (INSERT 추가 / DELETE 제거).
//
// votes 스키마 (migration 0001:284):
//   group_id, user_id, day, start_minute, end_minute (15분 단위 — D14)
// RLS (0002): votes_insert_self / votes_delete_self는 user_id = auth.uid() 검증.
// best-effort: INSERT + DELETE atomicity 없음. 베타에서 수용 — Edge Function 합산은 멱등(D11).
//
// 호출 패턴: createCommitDebouncer(onCommit=commitVoteDiff)와 결합.

import { supabase } from '@/lib/supabase/client';

import type { VoteSlot } from './voteSet';

const SLOT_DURATION_MINUTES = 15; // D14

export interface CommitVoteDiffInput {
  groupId: string;
  userId: string;
  added: VoteSlot[];
  removed: VoteSlot[];
}

export async function commitVoteDiff(input: CommitVoteDiffInput): Promise<void> {
  const { groupId, userId, added, removed } = input;

  if (added.length === 0 && removed.length === 0) {
    return;
  }

  if (added.length > 0) {
    const rows = added.map((slot) => ({
      group_id: groupId,
      user_id: userId,
      day: slot.day,
      start_minute: slot.start_minute,
      end_minute: slot.start_minute + SLOT_DURATION_MINUTES,
    }));
    const { error } = await supabase.from('votes').insert(rows);
    // 0014 unique index: race / 더블 commit 시 unique_violation(23505) 발생 — silent skip
    if (error && error.code !== '23505') {
      throw new Error('투표를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }

  if (removed.length > 0) {
    const byDay = new Map<string, number[]>();
    for (const slot of removed) {
      const list = byDay.get(slot.day) ?? [];
      list.push(slot.start_minute);
      byDay.set(slot.day, list);
    }

    for (const [day, minutes] of byDay) {
      const { error } = await supabase
        .from('votes')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('day', day)
        .in('start_minute', minutes);
      if (error) {
        throw new Error('투표를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      }
    }
  }
}
