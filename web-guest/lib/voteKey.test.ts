import {
  voteKey,
  parseVoteKey,
  voteSetFromSlots,
  diffVoteSets,
  type VoteSlot,
} from './voteKey';

describe('voteKey — slot 직렬화 (RN src/lib/votes/voteSet.ts mirror)', () => {
  it('day:start_minute 형식', () => {
    expect(voteKey({ day: '2026-05-26', start_minute: 540 })).toBe('2026-05-26:540');
  });

  it('자정 직전 1425', () => {
    expect(voteKey({ day: '2026-05-26', start_minute: 1425 })).toBe('2026-05-26:1425');
  });
});

describe('parseVoteKey — 역변환', () => {
  it('정상 round-trip', () => {
    const slot: VoteSlot = { day: '2026-05-26', start_minute: 540 };
    expect(parseVoteKey(voteKey(slot))).toEqual(slot);
  });

  it('start_minute = 0 (이론적 — 시간 그리드 범위 밖이지만 함수는 유효)', () => {
    expect(parseVoteKey('2026-05-26:0')).toEqual({ day: '2026-05-26', start_minute: 0 });
  });

  it('잘못된 형식 throw', () => {
    expect(() => parseVoteKey('no-colon')).toThrow(/voteKey 형식/);
    expect(() => parseVoteKey(':540')).toThrow(/voteKey 형식/);
    expect(() => parseVoteKey('2026-05-26:')).toThrow(/voteKey 형식/);
  });

  it('start_minute 비정수 throw', () => {
    expect(() => parseVoteKey('2026-05-26:abc')).toThrow(/voteKey start_minute/);
    expect(() => parseVoteKey('2026-05-26:1.5')).toThrow(/voteKey start_minute/);
  });
});

describe('voteSetFromSlots — slot[] → Set<VoteKey> 중복 제거', () => {
  it('빈 배열 → 빈 Set', () => {
    expect(voteSetFromSlots([])).toEqual(new Set());
  });

  it('중복 제거', () => {
    const slots: VoteSlot[] = [
      { day: '2026-05-26', start_minute: 540 },
      { day: '2026-05-26', start_minute: 540 },
      { day: '2026-05-26', start_minute: 555 },
    ];
    const set = voteSetFromSlots(slots);
    expect(set.size).toBe(2);
    expect(set.has('2026-05-26:540')).toBe(true);
    expect(set.has('2026-05-26:555')).toBe(true);
  });
});

describe('diffVoteSets — prev/next 비교 → added/removed 정렬', () => {
  it('next에만 있는 슬롯 → added', () => {
    const prev = new Set<string>();
    const next = voteSetFromSlots([{ day: '2026-05-26', start_minute: 540 }]);
    const diff = diffVoteSets(prev, next);
    expect(diff.added).toEqual([{ day: '2026-05-26', start_minute: 540 }]);
    expect(diff.removed).toEqual([]);
  });

  it('prev에만 있는 슬롯 → removed', () => {
    const prev = voteSetFromSlots([{ day: '2026-05-26', start_minute: 540 }]);
    const next = new Set<string>();
    const diff = diffVoteSets(prev, next);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([{ day: '2026-05-26', start_minute: 540 }]);
  });

  it('교집합 → 양쪽에서 제외', () => {
    const prev = voteSetFromSlots([
      { day: '2026-05-26', start_minute: 540 },
      { day: '2026-05-26', start_minute: 555 },
    ]);
    const next = voteSetFromSlots([
      { day: '2026-05-26', start_minute: 555 },
      { day: '2026-05-26', start_minute: 570 },
    ]);
    const diff = diffVoteSets(prev, next);
    expect(diff.added).toEqual([{ day: '2026-05-26', start_minute: 570 }]);
    expect(diff.removed).toEqual([{ day: '2026-05-26', start_minute: 540 }]);
  });

  it('day asc → start_minute asc 정렬 (안정성)', () => {
    const prev = new Set<string>();
    const next = voteSetFromSlots([
      { day: '2026-05-27', start_minute: 555 },
      { day: '2026-05-26', start_minute: 600 },
      { day: '2026-05-26', start_minute: 540 },
    ]);
    const diff = diffVoteSets(prev, next);
    expect(diff.added).toEqual([
      { day: '2026-05-26', start_minute: 540 },
      { day: '2026-05-26', start_minute: 600 },
      { day: '2026-05-27', start_minute: 555 },
    ]);
  });

  it('완전 동일 → 양쪽 empty', () => {
    const slots: VoteSlot[] = [{ day: '2026-05-26', start_minute: 540 }];
    const set = voteSetFromSlots(slots);
    const diff = diffVoteSets(set, set);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });
});
