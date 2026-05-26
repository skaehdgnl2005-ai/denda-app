// voteKey — vote 슬롯 직렬화·diff 순수 함수.
//
// RN src/lib/votes/voteSet.ts와 정확히 동일 spec. S14↔S05 cross-platform 정합 (D23 Conflict flag).
//
// VoteSlot = (day, start_minute). end_minute은 항상 start_minute + 15 (D14 15분 슬롯).

export interface VoteSlot {
  day: string; // YYYY-MM-DD (D13 KST 기준 day)
  start_minute: number; // 540..1425 (09:00 ~ 23:45), 15분 단위
}

export type VoteKey = string; // `${day}:${start_minute}`

export function voteKey(slot: VoteSlot): VoteKey {
  return `${slot.day}:${slot.start_minute}`;
}

export function parseVoteKey(key: VoteKey): VoteSlot {
  const colonIdx = key.indexOf(':');
  if (colonIdx <= 0 || colonIdx === key.length - 1) {
    throw new Error(`잘못된 voteKey 형식: ${key}`);
  }
  const day = key.slice(0, colonIdx);
  const minutePart = key.slice(colonIdx + 1);
  const start_minute = Number(minutePart);
  if (!Number.isInteger(start_minute)) {
    throw new Error(`잘못된 voteKey start_minute: ${key}`);
  }
  return { day, start_minute };
}

export function voteSetFromSlots(slots: readonly VoteSlot[]): Set<VoteKey> {
  const set = new Set<VoteKey>();
  for (const slot of slots) {
    set.add(voteKey(slot));
  }
  return set;
}

export interface VoteDiff {
  added: VoteSlot[];
  removed: VoteSlot[];
}

export function diffVoteSets(prev: ReadonlySet<VoteKey>, next: ReadonlySet<VoteKey>): VoteDiff {
  const added: VoteSlot[] = [];
  const removed: VoteSlot[] = [];

  for (const key of next) {
    if (!prev.has(key)) added.push(parseVoteKey(key));
  }
  for (const key of prev) {
    if (!next.has(key)) removed.push(parseVoteKey(key));
  }

  const cmp = (a: VoteSlot, b: VoteSlot): number =>
    a.day === b.day ? a.start_minute - b.start_minute : a.day < b.day ? -1 : 1;

  added.sort(cmp);
  removed.sort(cmp);
  return { added, removed };
}
