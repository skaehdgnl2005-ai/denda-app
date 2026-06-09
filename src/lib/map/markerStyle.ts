// 마커 시각 메트릭 (S-MAP M4, DESIGN §10.2 / §12.6).
//
// 제휴(강조) 마커의 "시각 capability"를 순수 데이터로 산출한다. 색은 여기 없음 —
// 렌더러(NaverMapScene)가 DESIGN 토큰(강조=brand-500, 비강조=brand-600)으로 칠한다.
// §12.6 "색 단독 의존 금지" 3중 신호 = 색(렌더러) + 크기(sizeScale) + inner stroke.
//
// ② 제휴 = Phase 3(D3) 데이터 경계 — 본 함수는 marker.emphasized 플래그만 보고 시각을
// 결정한다. 강조 여부의 "데이터 소스"는 호출자(stub) 책임이라 여기에 partnership 연동 없음.

import type { MapMarker } from './mapScene';

/** DESIGN §10.2 — 제휴(강조) 마커는 비제휴의 1.4배 (1.5배는 너무 큼). */
export const PARTNER_SIZE_SCALE = 1.4;
/** DESIGN §10.2 — selected 상태 scale (medium duration, emphasized easing). */
export const SELECTED_SIZE_SCALE = 1.15;

export interface MarkerVisual {
  /** 강조(제휴/확정) 여부. 색은 렌더러가 brand-500 / 비강조 brand-600 으로 결정. */
  emphasized: boolean;
  /** 기본 1.0 · 제휴 1.4 · selected면 ×1.15 (§10.2). */
  sizeScale: number;
  /** 제휴 마커 2pt inner stroke (§12.6 3중 신호). PNG 에셋(Q-B13) 점등 대상. */
  innerStroke: boolean;
  /** 스크린리더 라벨 (§12.3 — 색 단독 의존 금지). */
  accessibilityLabel: string;
}

interface MarkerVisualOptions {
  /** 사용자가 선택한 마커 (native 점등 시 강조 scale). */
  selected?: boolean;
}

function accessibilityLabel(marker: MapMarker): string {
  const label = marker.label ?? '';
  if (marker.emphasized === true) {
    // §12.3: "제휴 식당, 또띠아, ..., 더블탭으로 정보 보기" (평점은 Phase 3 데이터라 생략).
    return label ? `제휴 식당 ${label}, 더블탭으로 정보 보기` : '제휴 식당, 더블탭으로 정보 보기';
  }
  if (marker.kind === 'order') {
    const order = marker.order ?? '';
    return label ? `${order}번째 일정 ${label}` : `${order}번째 일정`;
  }
  return label ? `${label}, 더블탭으로 선택` : '장소, 더블탭으로 선택';
}

/** 마커 한 개 → 시각 메트릭. 색 외 모든 강조 신호(크기·stroke·a11y)를 산출. */
export function markerVisual(marker: MapMarker, options: MarkerVisualOptions = {}): MarkerVisual {
  const emphasized = marker.emphasized === true;
  const base = emphasized ? PARTNER_SIZE_SCALE : 1;
  const sizeScale = options.selected === true ? base * SELECTED_SIZE_SCALE : base;
  return {
    emphasized,
    sizeScale,
    innerStroke: emphasized,
    accessibilityLabel: accessibilityLabel(marker),
  };
}
