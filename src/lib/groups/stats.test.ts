// W2-9 — 홈 스탯 순수 함수 단위 테스트. now 주입으로 결정적(D13 KST).
import { countGroupsThisMonthKst } from './stats';

const NOW = '2026-07-10'; // KST 2026년 7월

describe('countGroupsThisMonthKst', () => {
  test('빈 목록 → 0', () => {
    expect(countGroupsThisMonthKst([], NOW)).toBe(0);
  });

  test('후보 날짜가 없는 모임 → 미포함', () => {
    expect(countGroupsThisMonthKst([{ dates: [] }], NOW)).toBe(0);
  });

  test('이번 달 후보 날짜 1개 → 포함', () => {
    expect(countGroupsThisMonthKst([{ dates: ['2026-07-15'] }], NOW)).toBe(1);
  });

  test('지난 달 후보만 → 미포함', () => {
    expect(countGroupsThisMonthKst([{ dates: ['2026-06-30'] }], NOW)).toBe(0);
  });

  test('다음 달 후보만 → 미포함', () => {
    expect(countGroupsThisMonthKst([{ dates: ['2026-08-01'] }], NOW)).toBe(0);
  });

  test('이번 달 경계(말일 7/31 포함, 지난달 6/30·다음달 8/1 제외)', () => {
    expect(countGroupsThisMonthKst([{ dates: ['2026-07-31'] }], NOW)).toBe(1);
    expect(countGroupsThisMonthKst([{ dates: ['2026-06-30'] }], NOW)).toBe(0);
    expect(countGroupsThisMonthKst([{ dates: ['2026-08-01'] }], NOW)).toBe(0);
  });

  test('한 모임에 이번 달 여러 날짜 → 중복 없이 1회만', () => {
    expect(countGroupsThisMonthKst([{ dates: ['2026-07-15', '2026-07-16'] }], NOW)).toBe(1);
  });

  test('이번 달 + 다음 달 섞인 모임 → 이번 달 날짜가 하나라도 있으면 1회', () => {
    expect(countGroupsThisMonthKst([{ dates: ['2026-07-31', '2026-08-01'] }], NOW)).toBe(1);
  });

  test('여러 모임 혼합 → 이번 달 후보 있는 모임 수만 합산', () => {
    const groups = [
      { dates: ['2026-07-15'] }, // this
      { dates: ['2026-06-15'] }, // last
      { dates: ['2026-07-01', '2026-09-01'] }, // this (하나라도)
      { dates: [] }, // none
    ];
    expect(countGroupsThisMonthKst(groups, NOW)).toBe(2);
  });

  test('연도 경계 — 다른 해 같은 월은 미포함', () => {
    expect(countGroupsThisMonthKst([{ dates: ['2025-07-15'] }], NOW)).toBe(0);
  });

  test('잘못된 now → 0 (방어)', () => {
    expect(countGroupsThisMonthKst([{ dates: ['2026-07-15'] }], 'not-a-date')).toBe(0);
  });

  test('잘못된 날짜 문자열은 무시', () => {
    expect(countGroupsThisMonthKst([{ dates: ['garbage', '2026-07-15'] }], NOW)).toBe(1);
    expect(countGroupsThisMonthKst([{ dates: ['garbage'] }], NOW)).toBe(0);
  });
});
