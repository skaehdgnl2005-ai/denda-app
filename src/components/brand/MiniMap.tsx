// 지도 mini 데모 (회색 배경 + brand-500 마커 + 점선 폴리라인).
// 온보딩 슬라이드 2에 사용 — "장소도 같이 정해요" 가치 prop 시각화.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/design/theme';

export interface MiniMapProps {
  width?: number;
  height?: number;
  testID?: string;
}

const MARKERS: Array<{ x: number; y: number; partner?: boolean }> = [
  { x: 0.22, y: 0.32, partner: true },
  { x: 0.52, y: 0.5 },
  { x: 0.78, y: 0.66, partner: true },
];

export const MiniMap: React.FC<MiniMapProps> = ({
  width = 200,
  height = 140,
  testID,
}) => {
  const { colors, radius } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: radius.lg,
          backgroundColor: colors.surface[2],
          borderColor: colors.border.subtle,
        },
      ]}
      testID={testID ?? 'mini-map'}
    >
      {/* 격자 hint (지도 느낌) */}
      {[0.25, 0.5, 0.75].map((p) => (
        <View
          key={`h-${p}`}
          style={{
            position: 'absolute',
            top: height * p,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: colors.border.subtle,
          }}
        />
      ))}
      {[0.25, 0.5, 0.75].map((p) => (
        <View
          key={`v-${p}`}
          style={{
            position: 'absolute',
            left: width * p,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: colors.border.subtle,
          }}
        />
      ))}

      {/* 마커 */}
      {MARKERS.map((m, i) => {
        const size = m.partner ? 18 : 12;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: width * m.x - size / 2,
              top: height * m.y - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: m.partner ? colors.brand[500] : colors.text.tertiary,
              borderWidth: 2,
              borderColor: colors.surface[0],
            }}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
