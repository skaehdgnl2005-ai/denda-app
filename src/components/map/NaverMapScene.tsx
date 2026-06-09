// 네이티브 지도 렌더 (D38, D25 lazy).
//
// MapHost가 isMapAvailable()===true 일 때만 lazy 로드 → 이 파일이 유일하게
// @mj-studio/react-native-naver-map(네이티브 모듈)을 import한다. MapScene → NaverMapView
// 매핑만 담당. 색은 DESIGN 토큰만(brand-500/600). 실 렌더·60fps 검증은 EAS 운영 트랙.
//
// ② 제휴(강조) 마커(M4): markerVisual(§10.2)로 크기 1.4×(brand-500) 분기 — 색 단독 의존 금지
//    3중 신호 중 색·크기. inner stroke(2pt 흰선)는 PNG 에셋(Q-B13) 필요 → 점등 시 보강(TODO).
// TODO(EAS): 폴리라인 dashed 패턴(DESIGN §10.5)은 patternImage 에셋 필요 — 현재 solid 2pt.
//            order 마커 32pt brand-500 fill 배지 + 제휴 inner stroke는 custom marker PNG로 점등 시 보강.

import {
  NaverMapMarkerOverlay,
  NaverMapPathOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';

import { useTheme } from '@/design/theme';
import type { MapScene } from '@/lib/map/mapScene';
import { markerVisual } from '@/lib/map/markerStyle';

/** 비강조 마커 기준 px. 제휴 마커는 markerVisual.sizeScale(1.4×)로 확대. */
const BASE_MARKER_SIZE = 28;

interface NaverMapSceneProps {
  scene: MapScene;
  /** 마커 onPress → actionId로 화면이 확정/상세 라우팅 (③ 검색→확정 통일, 리스트 탭과 동일 액션). */
  onMarkerPress?: (actionId: string) => void;
}

export default function NaverMapScene({
  scene,
  onMarkerPress,
}: NaverMapSceneProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <NaverMapView style={{ flex: 1 }} testID="naver-map-scene" isExtentBoundedInKorea>
      {scene.polylines.map((pl, pi) =>
        pl.segments.map((seg, si) => (
          <NaverMapPathOverlay
            key={`path-${pi}-${si}`}
            coords={[
              { latitude: seg.from.lat, longitude: seg.from.lng },
              { latitude: seg.to.lat, longitude: seg.to.lng },
            ]}
            width={2}
            color={colors.brand[500]}
          />
        )),
      )}
      {scene.markers.map((m) => {
        const { actionId } = m;
        const visual = markerVisual(m);
        const size = visual.emphasized
          ? Math.round(BASE_MARKER_SIZE * visual.sizeScale)
          : undefined;
        return (
          <NaverMapMarkerOverlay
            key={m.id}
            latitude={m.coord.lat}
            longitude={m.coord.lng}
            width={size}
            height={size}
            caption={
              m.label !== undefined ? { text: m.label, color: colors.text.primary } : undefined
            }
            tintColor={visual.emphasized ? colors.brand[500] : colors.brand[600]}
            onTap={actionId !== undefined ? () => onMarkerPress?.(actionId) : undefined}
          />
        );
      })}
    </NaverMapView>
  );
}
