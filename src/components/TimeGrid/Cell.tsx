import React from 'react';
import { Pressable, StyleSheet, View, GestureResponderEvent, ViewStyle } from 'react-native';
import { useTheme } from '../../design/theme';
import { Caption } from '../../design/typography';
import { Icon } from '../Icon';

export interface CellProps {
  state: 'empty' | 'self' | 'heat-0' | 'heat-1' | 'heat-2' | 'heat-3' | 'heat-4';
  count: number;
  isHeader: boolean;
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
  testID?: string;
}

const CellComponent: React.FC<CellProps> = ({ state, count, isHeader, label, onPress, testID }) => {
  const { colors } = useTheme();

  // Header cells rendering logic
  if (isHeader) {
    return (
      <View style={[styles.headerCell, { borderColor: colors.border.subtle }]} testID={testID}>
        <Caption variant="default" color={colors.text.secondary}>
          {label || ''}
        </Caption>
      </View>
    );
  }

  // Map state to background color
  let backgroundColor: string = colors.heat[0]; // default 'empty' or 'heat-0'
  // 격자 divider: 모든 cell의 right+bottom에 hairline (border.subtle). self는 4면 보라 2pt.
  let borderColor: string = colors.border.subtle;
  let borderRightWidth: number = StyleSheet.hairlineWidth;
  let borderBottomWidth: number = StyleSheet.hairlineWidth;
  let borderTopWidth = 0;
  let borderLeftWidth = 0;

  if (state === 'heat-1') {
    backgroundColor = colors.heat[1];
  } else if (state === 'heat-2') {
    backgroundColor = colors.heat[2];
  } else if (state === 'heat-3') {
    backgroundColor = colors.heat[3];
  } else if (state === 'heat-4') {
    backgroundColor = colors.heat[4];
  } else if (state === 'self') {
    backgroundColor = colors.brand[50];
    borderColor = colors.brand[500];
    borderTopWidth = 2;
    borderRightWidth = 2;
    borderBottomWidth = 2;
    borderLeftWidth = 2;
  }

  // Accessibility Label
  const getAccessibilityLabel = (): string => {
    if (state === 'self') {
      return `본인 선택됨, 투표 수 ${count}명`;
    }
    if (state === 'empty' || state === 'heat-0') {
      return '투표 없음';
    }
    return `투표 수 ${count}명`;
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 14, bottom: 14 }} // 16pt 높이 + 14+14 hitSlop = 44pt 터치 (D9)
      accessibilityRole="button"
      accessibilityLabel={getAccessibilityLabel()}
      testID={testID}
      style={({ pressed }): ViewStyle[] => [
        styles.cell,
        {
          backgroundColor,
          borderColor,
          borderTopWidth,
          borderRightWidth,
          borderBottomWidth,
          borderLeftWidth,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {state === 'self' && (
        <View style={styles.selfContent}>
          <Icon name="확정" size={10} color={colors.brand[500]} />
          <Caption variant="micro" tabularNums color={colors.brand[500]} style={styles.countText}>
            {count.toString()}
          </Caption>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cell: {
    // 2026-06-08: marginH/V:1 + borderRadius:2 조합이 sub-pixel rendering으로
    // row마다 cell 가장자리가 1px씩 어긋나 zigzag로 보이던 회귀 해소.
    // cells를 빼곡히 붙이고(margin 0) 직각으로(borderRadius 0) 그려 pixel-perfect.
    // 셀 구분은 backgroundColor heat 색 차이로만.
    height: 16,
    flex: 1,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible', // allow check icon and text to overflow if needed
  },
  headerCell: {
    height: 44,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  selfContent: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  countText: {
    marginLeft: 2,
    fontSize: 9,
    lineHeight: 12,
  },
});

export const Cell = React.memo(CellComponent);
