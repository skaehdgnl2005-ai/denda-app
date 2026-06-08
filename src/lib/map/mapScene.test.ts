import { toScheduleScene } from './mapScene';
import type { ScheduleMapPoint } from '@/lib/schedules/scheduleMapPoint';

function pt(order: number, lat: number, lng: number): ScheduleMapPoint {
  return {
    groupId: `g${order}`,
    groupName: `모임${order}`,
    placeId: `p${order}`,
    placeName: `장소${order}`,
    coord: { lat, lng },
    confirmedStartAt: `2026-06-0${order}T10:00:00.000Z`,
    order,
  };
}

describe('toScheduleScene', () => {
  test('mode=schedule + 점마다 order 마커(label=order, actionId=groupId)', () => {
    const scene = toScheduleScene([pt(1, 37.57, 127.0), pt(2, 37.56, 127.01)]);
    expect(scene.mode).toBe('schedule');
    expect(scene.markers).toHaveLength(2);
    expect(scene.markers[0]).toMatchObject({
      id: 'g1',
      kind: 'order',
      order: 1,
      label: '1',
      actionId: 'g1',
    });
    expect(scene.markers[0]?.coord).toEqual({ lat: 37.57, lng: 127.0 });
  });

  test('점 2개 이상 → dashed-brand 폴리라인 1개 (segment 보유)', () => {
    const scene = toScheduleScene([pt(1, 37.57, 127.0), pt(2, 37.56, 127.01)]);
    expect(scene.polylines).toHaveLength(1);
    expect(scene.polylines[0]?.style).toBe('dashed-brand');
    expect(scene.polylines[0]?.segments.length).toBeGreaterThan(0);
  });

  test('점 1개 → 폴리라인 없음', () => {
    const scene = toScheduleScene([pt(1, 37.57, 127.0)]);
    expect(scene.markers).toHaveLength(1);
    expect(scene.polylines).toHaveLength(0);
  });

  test('빈 입력 → 빈 scene', () => {
    const scene = toScheduleScene([]);
    expect(scene.markers).toHaveLength(0);
    expect(scene.polylines).toHaveLength(0);
  });
});
