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
  let borderColor = 'transparent';
  let borderWidth = 0;

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
    borderWidth = 2;
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
      hitSlop={{ top: 18, bottom: 18 }} // expands 8pt height to 44pt touch target
      accessibilityRole="button"
      accessibilityLabel={getAccessibilityLabel()}
      testID={testID}
      style={({ pressed }): ViewStyle[] => [
        styles.cell,
        {
          backgroundColor,
          borderColor,
          borderWidth,
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
    height: 8,
    flex: 1,
    marginHorizontal: 1,
    marginVertical: 1,
    borderRadius: 2, // smooth subtle corner
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
