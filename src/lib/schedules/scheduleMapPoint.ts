// S15-mapmode-logic — schedule mode 좌표 점 builder.
//
// confirmed 모임 + place lat/lng 입력 → chronological 정렬 + ①②③ order index 출력.
// D18: 좌표는 normalizeWgs84 통과 (invalid 범위는 throw).
// D13: confirmedStartAt은 UTC ISO (lexicographic 비교로 chronological 정렬).

import { normalizeWgs84, type Wgs84Coord } from '@/lib/coords/normalize';

export interface ConfirmedGroupScheduleInput {
  groupId: string;
  groupName: string;
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  /** UTC ISO (D13). */
  confirmedStartAt: string;
}

export interface ScheduleMapPoint {
  groupId: string;
  groupName: string;
  placeId: string;
  placeName: string;
  coord: Wgs84Coord;
  /** UTC ISO (D13). */
  confirmedStartAt: string;
  /** 시간순 1-based index — ①②③ 숫자 배지(DESIGN §10.5)용. */
  order: number;
}

export function toScheduleMapPoints(input: ConfirmedGroupScheduleInput[]): ScheduleMapPoint[] {
  if (input.length === 0) return [];

  // stable sort: 입력 인덱스를 tiebreaker로 — Array.prototype.sort는 V8/Hermes 모두 stable이지만
  // 명시적으로 보장한다.
  const indexed = input.map((row, idx) => ({ row, idx }));
  indexed.sort((a, b) => {
    if (a.row.confirmedStartAt < b.row.confirmedStartAt) return -1;
    if (a.row.confirmedStartAt > b.row.confirmedStartAt) return 1;
    return a.idx - b.idx;
  });

  return indexed.map(({ row }, i) => ({
    groupId: row.groupId,
    groupName: row.groupName,
    placeId: row.placeId,
    placeName: row.placeName,
    coord: normalizeWgs84(row.lat, row.lng),
    confirmedStartAt: row.confirmedStartAt,
    order: i + 1,
  }));
}
