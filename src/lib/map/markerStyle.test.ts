import {
  markerVisual,
  PARTNER_SIZE_SCALE,
  SELECTED_SIZE_SCALE,
  type MarkerVisual,
} from './markerStyle';
import type { MapMarker } from './mapScene';

function marker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 'm1',
    coord: { lat: 37.57, lng: 127.0 },
    kind: 'place',
    label: '한솥도시락',
    ...overrides,
  };
}

describe('markerVisual — 제휴(강조) 마커 시각 capability (DESIGN §10.2 / §12.6)', () => {
  test('비강조 place 마커 → emphasized=false, sizeScale=1, innerStroke 없음', () => {
    const v: MarkerVisual = markerVisual(marker());
    expect(v.emphasized).toBe(false);
    expect(v.sizeScale).toBe(1);
    expect(v.innerStroke).toBe(false);
  });

  test('emphasized=true(제휴) → sizeScale 1.4배 + inner stroke (§10.2: 비제휴의 1.4배, §12.6 3중 신호)', () => {
    const v = markerVisual(marker({ kind: 'partner', emphasized: true }));
    expect(v.emphasized).toBe(true);
    expect(v.sizeScale).toBe(PARTNER_SIZE_SCALE);
    expect(PARTNER_SIZE_SCALE).toBe(1.4);
    expect(v.innerStroke).toBe(true);
  });

  test('selected → 기본 scale에 ×1.15 (§10.2 state-selected)', () => {
    const plain = markerVisual(marker(), { selected: true });
    expect(plain.sizeScale).toBeCloseTo(SELECTED_SIZE_SCALE, 5);
    expect(SELECTED_SIZE_SCALE).toBe(1.15);

    const partner = markerVisual(marker({ emphasized: true }), { selected: true });
    expect(partner.sizeScale).toBeCloseTo(PARTNER_SIZE_SCALE * SELECTED_SIZE_SCALE, 5);
  });

  test('제휴 마커 accessibilityLabel = "제휴 식당" + 장소명 (§12.3 색 단독 의존 금지)', () => {
    const v = markerVisual(marker({ emphasized: true, label: '또띠아' }));
    expect(v.accessibilityLabel).toContain('제휴 식당');
    expect(v.accessibilityLabel).toContain('또띠아');
  });

  test('비강조 place 마커 accessibilityLabel = 장소명 (제휴 표기 없음)', () => {
    const v = markerVisual(marker({ label: '김밥천국' }));
    expect(v.accessibilityLabel).toContain('김밥천국');
    expect(v.accessibilityLabel).not.toContain('제휴');
  });

  test('order 마커 → 일정 순번 라벨 (① 동선·일정과 호환)', () => {
    const v = markerVisual(marker({ kind: 'order', order: 2, label: '2' }));
    expect(v.emphasized).toBe(false);
    expect(v.accessibilityLabel).toContain('2');
  });
});
