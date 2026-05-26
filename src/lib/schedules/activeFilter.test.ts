// S03b — 학기 종료 자동 만료 필터 (TEST_PLAN: "학기 종료일 도래 시 일정 자동 만료 UI에서 숨김")
// D13 KST 강제. `new Date()` 직접 금지 — luxon Asia/Seoul.

import { isScheduleActive, buildActiveScheduleFilter } from './activeFilter';

describe('isScheduleActive', () => {
  it('expires_at null → 항상 active', () => {
    expect(isScheduleActive({ expires_at: null }, '2026-05-26T00:00:00.000Z')).toBe(true);
  });

  it('expires_at undefined → 항상 active', () => {
    expect(isScheduleActive({}, '2026-05-26T00:00:00.000Z')).toBe(true);
  });

  it('expires_at > now → active', () => {
    expect(
      isScheduleActive({ expires_at: '2026-06-19T14:59:59.000Z' }, '2026-05-26T00:00:00.000Z'),
    ).toBe(true);
  });

  it('expires_at < now → 만료 (inactive)', () => {
    expect(
      isScheduleActive({ expires_at: '2026-04-01T00:00:00.000Z' }, '2026-05-26T00:00:00.000Z'),
    ).toBe(false);
  });

  it('expires_at == now → 만료 (inclusive on past)', () => {
    expect(
      isScheduleActive({ expires_at: '2026-05-26T00:00:00.000Z' }, '2026-05-26T00:00:00.000Z'),
    ).toBe(false);
  });
});

describe('buildActiveScheduleFilter', () => {
  it('PostgREST `.or` filter 문자열 생성 (expires_at null or > nowUtcIso)', () => {
    const f = buildActiveScheduleFilter('2026-05-26T00:00:00.000Z');
    expect(f).toBe('expires_at.is.null,expires_at.gt.2026-05-26T00:00:00.000Z');
  });
});
