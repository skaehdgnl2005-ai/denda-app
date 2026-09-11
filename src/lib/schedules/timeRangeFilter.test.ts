// S15-mapmode-logic — 시간 범위 필터 (acceptance: "시간 범위 선택").
//
// 입력 KST date range → 점 confirmedStartAt(UTC ISO)이 [from, to] 범위 내인 것만.
// D13 KST 강제 — luxon Asia/Seoul로 KST → UTC ISO 산출 후 lexicographic 비교.
// 경계 inclusive (사용자가 "5월 30일 ~ 5월 31일" 선택 시 5월 31일 23:59까지 포함).

import { filterByKstDateRange, kstDateRangeToUtcWindow } from './timeRangeFilter';
import type { ScheduleMapPoint } from './scheduleMapPoint';

function pt(id: string, utcIso: string): ScheduleMapPoint {
  return {
    groupId: id,
    groupName: id,
    placeId: id,
    placeName: id,
    coord: { lat: 37.5, lng: 127.0 },
    confirmedStartAt: utcIso,
    order: 1,
  };
}

describe('kstDateRangeToUtcWindow', () => {
  test('KST 2026-05-30 ~ 5-31 → UTC [5-29T15:00, 5-31T14:59:59.999]', () => {
    const { fromUtcIso, toUtcIso } = kstDateRangeToUtcWindow('2026-05-30', '2026-05-31');
    // KST 2026-05-30 00:00 = UTC 2026-05-29 15:00 (KST=UTC+9)
    expect(fromUtcIso).toBe('2026-05-29T15:00:00.000Z');
    // KST 2026-05-31 23:59:59.999 = UTC 2026-05-31 14:59:59.999
    expect(toUtcIso).toBe('2026-05-31T14:59:59.999Z');
  });

  test('단일 일자 (from == to) → KST 그날 00:00 ~ 23:59:59.999', () => {
    const { fromUtcIso, toUtcIso } = kstDateRangeToUtcWindow('2026-05-30', '2026-05-30');
    expect(fromUtcIso).toBe('2026-05-29T15:00:00.000Z');
    expect(toUtcIso).toBe('2026-05-30T14:59:59.999Z');
  });

  test('from > to → 한국어 throw', () => {
    expect(() => kstDateRangeToUtcWindow('2026-05-31', '2026-05-30')).toThrow(
      '시간 범위가 올바르지 않아요',
    );
  });

  test('잘못된 형식 → 한국어 throw', () => {
    expect(() => kstDateRangeToUtcWindow('not-a-date', '2026-05-30')).toThrow(
      '날짜 형식이 올바르지 않아요',
    );
  });
});

describe('filterByKstDateRange', () => {
  const points: ScheduleMapPoint[] = [
    pt('before', '2026-05-29T14:59:59.000Z'), // KST 5/29 23:59:59
    pt('at-start', '2026-05-29T15:00:00.000Z'), // KST 5/30 00:00 (경계)
    pt('mid', '2026-05-30T03:00:00.000Z'), // KST 5/30 12:00
    pt('at-end', '2026-05-31T14:59:59.999Z'), // KST 5/31 23:59:59.999 (경계)
    pt('after', '2026-05-31T15:00:00.000Z'), // KST 6/1 00:00
  ];

  test('KST 2026-05-30 ~ 5-31 → 경계 inclusive 3개', () => {
    const out = filterByKstDateRange(points, '2026-05-30', '2026-05-31');
    expect(out.map((p) => p.groupId)).toEqual(['at-start', 'mid', 'at-end']);
  });

  test('빈 입력 → 빈 배열', () => {
    expect(filterByKstDateRange([], '2026-05-30', '2026-05-31')).toEqual([]);
  });

  test('범위 밖만 → 빈 배열', () => {
    const outside = [points[0], points[4]].filter((p): p is ScheduleMapPoint => p !== undefined);
    expect(filterByKstDateRange(outside, '2026-05-30', '2026-05-30')).toEqual([]);
  });
});
