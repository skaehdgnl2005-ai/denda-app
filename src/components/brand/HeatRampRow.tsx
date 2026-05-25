// 히트맵 ramp 5칸 미니 시각.
// 로그인 hero · 온보딩 슬라이드 1에서 사용 (§17.4).
// `showLabel` 옵션으로 양 끝 "적음 → 많음" 라벨 노출 (피드백 P2).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/design/theme';
import { Caption } from '@/design/typography';

export interface HeatRampRowProps {
  cellSize?: number;
  cellGap?: number;
  /** 0~4까지 fill될 만큼만 채색. 미지정 시 전체 5칸 */
  highlightUpTo?: number;
  /** 양 끝 라벨 표시 ("적음 → 많음" 또는 사용자 정의) */
  showLabel?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  testID?: string;
}

export const HeatRampRow: React.FC<HeatRampRowProps> = ({
  cellSize = 32,
  cellGap = 4,
  highlightUpTo = 4,
  showLabel = false,
  leftLabel = '적음',
  rightLabel = '많음',
  testID,
}) => {
  const { colors, radius, space } = useTheme();

  return (
    <View style={styles.container} testID={testID ?? 'heat-ramp-row'}>
      <View style={styles.row}>
        {colors.heat.map((color, i) => {
          const active = i <= highlightUpTo;
          return (
            <View
              key={i}
              style={{
                width: cellSize,
                height: cellSize,
                marginRight: i < colors.heat.length - 1 ? cellGap : 0,
                borderRadius: radius.sm,
                backgroundColor: active ? color : colors.surface[3],
                opacity: active ? 1 : 0.3,
              }}
              accessibilityElementsHidden
            />
          );
        })}
      </View>
      {showLabel ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: cellSize * colors.heat.length + cellGap * (colors.heat.length - 1),
            marginTop: space[2],
          }}
        >
          <Caption variant="micro" color={colors.text.tertiary}>
            {leftLabel}
          </Caption>
          <Caption variant="micro" color={colors.text.tertiary}>
            {rightLabel}
          </Caption>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
