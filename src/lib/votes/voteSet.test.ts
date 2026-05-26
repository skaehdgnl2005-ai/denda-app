import { voteKey, parseVoteKey, voteSetFromSlots, diffVoteSets, type VoteSlot } from './voteSet';

describe('voteKey / parseVoteKey', () => {
  test('voteKey: day + start_minute을 안정적 문자열로 직렬화', () => {
    expect(voteKey({ day: '2026-05-30', start_minute: 540 })).toBe('2026-05-30:540');
  });

  test('parseVoteKey: 직렬화 라운드트립 무손실', () => {
    const slot: VoteSlot = { day: '2026-05-30', start_minute: 1095 };
    expect(parseVoteKey(voteKey(slot))).toEqual(slot);
  });

  test('parseVoteKey: 잘못된 형식이면 에러', () => {
    expect(() => parseVoteKey('bad')).toThrow();
    expect(() => parseVoteKey('2026-05-30:abc')).toThrow();
  });
});

describe('voteSetFromSlots', () => {
  test('빈 배열 → 빈 Set', () => {
    expect(voteSetFromSlots([]).size).toBe(0);
  });

  test('중복 슬롯 제거', () => {
    const set = voteSetFromSlots([
      { day: '2026-05-30', start_minute: 540 },
      { day: '2026-05-30', start_minute: 540 },
      { day: '2026-05-30', start_minute: 555 },
    ]);
    expect(set.size).toBe(2);
    expect(set.has('2026-05-30:540')).toBe(true);
    expect(set.has('2026-05-30:555')).toBe(true);
  });
});

describe('diffVoteSets', () => {
  test('이전·다음 동일 → 변경 없음', () => {
    const prev = voteSetFromSlots([{ day: '2026-05-30', start_minute: 540 }]);
    const next = voteSetFromSlots([{ day: '2026-05-30', start_minute: 540 }]);
    expect(diffVoteSets(prev, next)).toEqual({ added: [], removed: [] });
  });

  test('새 슬롯만 → added', () => {
    const prev = voteSetFromSlots([]);
    const next = voteSetFromSlots([
      { day: '2026-05-30', start_minute: 540 },
      { day: '2026-05-31', start_minute: 600 },
    ]);
    const diff = diffVoteSets(prev, next);
    expect(diff.removed).toEqual([]);
    // 정렬: day asc, start_minute asc로 안정적
    expect(diff.added).toEqual([
      { day: '2026-05-30', start_minute: 540 },
      { day: '2026-05-31', start_minute: 600 },
    ]);
  });

  test('제거된 슬롯만 → removed', () => {
    const prev = voteSetFromSlots([
      { day: '2026-05-30', start_minute: 540 },
      { day: '2026-05-30', start_minute: 555 },
    ]);
    const next = voteSetFromSlots([{ day: '2026-05-30', start_minute: 540 }]);
    expect(diffVoteSets(prev, next)).toEqual({
      added: [],
      removed: [{ day: '2026-05-30', start_minute: 555 }],
    });
  });

  test('added · removed 동시 발생 (다른 day)', () => {
    const prev = voteSetFromSlots([{ day: '2026-05-30', start_minute: 540 }]);
    const next = voteSetFromSlots([{ day: '2026-05-31', start_minute: 600 }]);
    expect(diffVoteSets(prev, next)).toEqual({
      added: [{ day: '2026-05-31', start_minute: 600 }],
      removed: [{ day: '2026-05-30', start_minute: 540 }],
    });
  });

  test('added 정렬: day asc → start_minute asc', () => {
    const prev = voteSetFromSlots([]);
    const next = voteSetFromSlots([
      { day: '2026-05-31', start_minute: 600 },
      { day: '2026-05-30', start_minute: 555 },
      { day: '2026-05-30', start_minute: 540 },
    ]);
    const diff = diffVoteSets(prev, next);
    expect(diff.added).toEqual([
      { day: '2026-05-30', start_minute: 540 },
      { day: '2026-05-30', start_minute: 555 },
      { day: '2026-05-31', start_minute: 600 },
    ]);
  });
});
