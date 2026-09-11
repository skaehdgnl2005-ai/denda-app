// S15-mapmode-logic — schedule mode 좌표 점 builder.
//
// 입력: confirmed 모임 + place lat/lng. 출력: chronological 정렬 + ①②③ order index.
// D13 KST와 무관 (UTC ISO 비교는 lexicographic으로 정확) — sort는 string 비교.
// D18: 좌표는 normalizeWgs84 통과 (invalid 범위는 throw).

import { toScheduleMapPoints, type ConfirmedGroupScheduleInput } from './scheduleMapPoint';

const base: ConfirmedGroupScheduleInput = {
  groupId: 'g1',
  groupName: '저녁',
  placeId: 'p1',
  placeName: '광장시장',
  lat: 37.5704,
  lng: 126.9999,
  confirmedStartAt: '2026-05-30T10:00:00.000Z',
};

describe('toScheduleMapPoints', () => {
  test('빈 입력 → 빈 배열', () => {
    expect(toScheduleMapPoints([])).toEqual([]);
  });

  test('chronological 입력 → order 1·2·3 부여 + 좌표 정규화', () => {
    const input: ConfirmedGroupScheduleInput[] = [
      { ...base, groupId: 'g1', placeId: 'p1', confirmedStartAt: '2026-05-30T10:00:00.000Z' },
      {
        ...base,
        groupId: 'g2',
        placeId: 'p2',
        lat: 37.5,
        lng: 127.0,
        confirmedStartAt: '2026-05-31T11:00:00.000Z',
      },
      {
        ...base,
        groupId: 'g3',
        placeId: 'p3',
        lat: 37.55,
        lng: 126.97,
        confirmedStartAt: '2026-06-01T12:00:00.000Z',
      },
    ];
    const out = toScheduleMapPoints(input);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({
      groupId: 'g1',
      order: 1,
      coord: { lat: 37.5704, lng: 126.9999 },
    });
    expect(out[1]).toMatchObject({ groupId: 'g2', order: 2 });
    expect(out[2]).toMatchObject({ groupId: 'g3', order: 3 });
  });

  test('unordered 입력 → confirmedStartAt 기준 정렬 후 order 부여', () => {
    const input: ConfirmedGroupScheduleInput[] = [
      { ...base, groupId: 'late', confirmedStartAt: '2026-06-01T12:00:00.000Z' },
      { ...base, groupId: 'early', confirmedStartAt: '2026-05-30T10:00:00.000Z' },
      { ...base, groupId: 'mid', confirmedStartAt: '2026-05-31T11:00:00.000Z' },
    ];
    const out = toScheduleMapPoints(input);
    expect(out.map((p) => p.groupId)).toEqual(['early', 'mid', 'late']);
    expect(out.map((p) => p.order)).toEqual([1, 2, 3]);
  });

  test('동일 timestamp → 입력 순서 유지 (stable sort)', () => {
    const ts = '2026-05-30T10:00:00.000Z';
    const input: ConfirmedGroupScheduleInput[] = [
      { ...base, groupId: 'a', confirmedStartAt: ts },
      { ...base, groupId: 'b', confirmedStartAt: ts },
      { ...base, groupId: 'c', confirmedStartAt: ts },
    ];
    expect(toScheduleMapPoints(input).map((p) => p.groupId)).toEqual(['a', 'b', 'c']);
  });

  test('invalid 좌표 → 한국어 throw (D18 normalize 전파)', () => {
    const input: ConfirmedGroupScheduleInput[] = [{ ...base, lat: 999, lng: 999 }];
    expect(() => toScheduleMapPoints(input)).toThrow('좌표를 해석할 수 없어요');
  });
});
