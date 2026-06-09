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

  // Map state to background color.
  // 모든 cell의 outer box layout은 동일 (height 16 + right/bottom hairline divider만).
  // self 강조는 inner absolute View ring으로 — outer box layout을 깨지 않아 정렬 유지.
  let backgroundColor: string = colors.heat[0]; // default 'empty' or 'heat-0'

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
          borderColor: colors.border.subtle,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {state === 'self' && (
        <>
          <View
            style={[styles.selfRing, { borderColor: colors.brand[500] }]}
            pointerEvents="none"
          />
          <View style={styles.selfContent}>
            <Icon name="확정" size={10} color={colors.brand[500]} />
            <Caption variant="micro" tabularNums color={colors.brand[500]} style={styles.countText}>
              {count.toString()}
            </Caption>
          </View>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cell: {
    // 2026-06-08: 모든 cells가 동일한 outer box layout — height 16 + right/bottom
    // hairline divider만. self 강조는 inner selfRing absolute View로 옮겨
    // outer borderWidth가 cells마다 다르지 않도록 (정렬 회귀 해소).
    height: 16,
    flex: 1,
    borderRadius: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  selfRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
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
