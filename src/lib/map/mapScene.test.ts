import { toScheduleScene, toSearchScene } from './mapScene';
import type { ScheduleMapPoint } from '@/lib/schedules/scheduleMapPoint';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';

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

function result(name: string, lat: number, lng: number): PlaceSearchResult {
  return {
    providerPlaceId: `naver:${name}:${lat}:${lng}`,
    name,
    category: '한식',
    address: `서울 ${name}`,
    lat,
    lng,
    phone: null,
    source: 'naver',
  };
}

describe('toSearchScene (③ 검색→확정 마커 actionId 계약)', () => {
  test('mode=search + 결과마다 place 마커(label=name, actionId=providerPlaceId, coord)', () => {
    const scene = toSearchScene([result('한솥', 37.58, 127.03), result('김밥천국', 37.59, 127.02)]);
    expect(scene.mode).toBe('search');
    expect(scene.markers).toHaveLength(2);
    expect(scene.markers[0]).toMatchObject({
      id: 'naver:한솥:37.58:127.03',
      kind: 'place',
      label: '한솥',
      actionId: 'naver:한솥:37.58:127.03',
    });
    expect(scene.markers[0]?.coord).toEqual({ lat: 37.58, lng: 127.03 });
  });

  test('actionId === providerPlaceId (리스트 keyExtractor·마커 onPress 단일 식별자)', () => {
    const r = result('스타벅스', 37.5, 127.0);
    const scene = toSearchScene([r]);
    expect(scene.markers[0]?.actionId).toBe(r.providerPlaceId);
  });

  test('검색 마커는 폴리라인 없음 (동선 아님)', () => {
    const scene = toSearchScene([result('한솥', 37.58, 127.03), result('김밥천국', 37.59, 127.02)]);
    expect(scene.polylines).toHaveLength(0);
  });

  test('기본(데이터 stub) → emphasized 미설정 — ② 제휴 데이터 연동은 Phase 3(D3) 경계', () => {
    const scene = toSearchScene([result('한솥', 37.58, 127.03)]);
    expect(scene.markers[0]?.emphasized).toBeUndefined();
    expect(scene.markers[0]?.kind).toBe('place');
  });

  test('isPartner 예측 주입(M4 시각 capability) → 해당 마커만 kind=partner + emphasized=true', () => {
    // 데이터 소스가 아니라 "강조 capability" — 호출자가 제휴 판정을 주입한다.
    // Phase 1+2 화면은 stub(항상 false)을 주입하므로 경계 유지, 시각 분기만 검증.
    const scene = toSearchScene([result('또띠아', 37.58, 127.03), result('김밥천국', 37.59, 127.02)], {
      isPartner: (r) => r.name === '또띠아',
    });
    expect(scene.markers[0]).toMatchObject({ kind: 'partner', emphasized: true });
    expect(scene.markers[1]?.kind).toBe('place');
    expect(scene.markers[1]?.emphasized).toBeUndefined();
  });

  test('isPartner 주입해도 actionId=providerPlaceId 계약 유지 (마커 onPress 통일)', () => {
    const r = result('또띠아', 37.58, 127.03);
    const scene = toSearchScene([r], { isPartner: () => true });
    expect(scene.markers[0]?.actionId).toBe(r.providerPlaceId);
  });

  test('빈 결과 → 빈 scene', () => {
    const scene = toSearchScene([]);
    expect(scene.mode).toBe('search');
    expect(scene.markers).toHaveLength(0);
    expect(scene.polylines).toHaveLength(0);
  });
});
