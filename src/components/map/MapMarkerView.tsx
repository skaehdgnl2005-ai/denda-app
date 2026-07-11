// 지도 마커 커스텀 뷰 (D40 — NaverMapMarkerOverlay children, PNG 래스터 대체).
//
// 네이버 SDK 기본 마커는 `image={{symbol:'green'}}` 프리셋이라 브랜드 보라톤과 안 맞는다
// (tintColor도 symbol엔 잘 안 먹음). children으로 RN 뷰를 넘기면 네이티브가 래스터화해 마커
// 아이콘으로 쓴다 → 색·크기·stroke를 DESIGN 토큰으로 직접 제어. PNG 에셋(Q-B13) 불필요.
//
// DESIGN: §10.5(order = brand fill + 흰 숫자) · §10.2(제휴 = 1.4× + 2pt 흰 inner stroke,
// 다크는 0F0F12 stroke) · §12.6(색 단독 의존 금지 → 색 + 크기 + stroke 3중 신호).
// 색은 토큰만 (brand-500 강조 / brand-600 기본, surface-0 = 라이트 흰/다크 0F0F12 stroke).

import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/design/theme';
import { Title } from '@/design/typography';
import type { MapMarker } from '@/lib/map/mapScene';
import { markerVisual } from '@/lib/map/markerStyle';

/** 비강조 기준 지름(pt) — §10.5 order 배지 32pt. 제휴(emphasized)는 sizeScale(1.4×)로 확대. */
const BASE_DIAMETER = 32;

interface MapMarkerViewProps {
  marker: MapMarker;
}

export function MapMarkerView({ marker }: MapMarkerViewProps): React.JSX.Element {
  const { colors, shadow } = useTheme();
  const visual = markerVisual(marker);
  const diameter = Math.round(BASE_DIAMETER * visual.sizeScale);
  // DESIGN §10.5(order)·§10.2(제휴) 모두 brand-500(메인 브랜드 보라, heat ramp와 동일).
  // 강조(제휴)는 색이 아니라 크기(1.4×)·inner stroke로 구분(§12.6 색 단독 의존 금지).
  const fill = colors.brand[500];
  const showNumber = marker.kind === 'order' && marker.order !== undefined;

  return (
    <View
      testID="map-marker-view"
      accessibilityLabel={visual.accessibilityLabel}
      style={[
        styles.marker,
        shadow.e2,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: fill,
          borderColor: colors.surface[0],
        },
      ]}
    >
      {showNumber ? (
        // §10.5 order 숫자 = title-3 weight 700, tabular-nums (배지 정렬)
        <Title level="h3" color={colors.text['on-brand']} tabularNums style={styles.orderNumber}>
          {String(marker.order)}
        </Title>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // §10.5 order 배지 숫자 — title-3 weight 700, 원 안 중앙 정렬 (Android 폰트 패딩 제거)
  orderNumber: {
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
