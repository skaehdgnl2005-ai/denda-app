// 네이티브 지도 렌더 (D38, D25 lazy).
//
// MapHost가 isMapAvailable()===true 일 때만 lazy 로드 → 이 파일이 유일하게
// @mj-studio/react-native-naver-map(네이티브 모듈)을 import한다. MapScene → NaverMapView
// 매핑만 담당. 색은 DESIGN 토큰만(brand-500/600). 실 렌더·60fps 검증은 EAS 운영 트랙.
//
// ② 마커 비주얼(D40): 네이버 기본 symbol(green)/tintColor 대신 MapMarkerView를 children으로
//    넘겨 브랜드 보라톤 마커를 직접 렌더(§10.2 1.4× 강조 + 흰 inner stroke + §10.5 order 숫자).
//    PNG 에셋(Q-B13) 불필요. order 마커는 숫자를 원 안에, place/제휴는 장소명을 caption으로.
// TODO(EAS): 폴리라인 dashed 패턴(DESIGN §10.5)은 patternImage 에셋 필요 — 현재 solid 2pt.

import {
  NaverMapMarkerOverlay,
  NaverMapPathOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';

import { MapMarkerView } from './MapMarkerView';
import { useTheme } from '@/design/theme';
import type { MapScene } from '@/lib/map/mapScene';

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
        // order 마커는 숫자를 원 안에 표시 → caption 중복 생략. place/제휴는 장소명을 caption으로.
        const showCaption = m.kind !== 'order' && m.label !== undefined;
        return (
          <NaverMapMarkerOverlay
            key={m.id}
            latitude={m.coord.lat}
            longitude={m.coord.lng}
            anchor={{ x: 0.5, y: 0.5 }}
            caption={
              showCaption ? { text: m.label as string, color: colors.text.primary } : undefined
            }
            onTap={actionId !== undefined ? () => onMarkerPress?.(actionId) : undefined}
          >
            <MapMarkerView marker={m} />
          </NaverMapMarkerOverlay>
        );
      })}
    </NaverMapView>
  );
}
