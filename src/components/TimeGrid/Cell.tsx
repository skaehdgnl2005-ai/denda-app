import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  GestureResponderEvent,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../design/theme';
import { Caption } from '../../design/typography';
import { motionEasing } from '../../lib/motion/easing';
import { useReducedMotion } from '../../lib/motion/useReducedMotion';
import { Icon } from '../Icon';

export type CellStateValue =
  | 'empty'
  | 'self'
  | 'heat-0'
  | 'heat-1'
  | 'heat-2'
  | 'heat-3'
  | 'heat-4';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

/** state → 배경색 (heat ramp / self=brand-50). 모션·테스트 공용 순수 함수. */
export function cellBackgroundColor(state: CellStateValue, colors: ThemeColors): string {
  switch (state) {
    case 'heat-1':
      return colors.heat[1];
    case 'heat-2':
      return colors.heat[2];
    case 'heat-3':
      return colors.heat[3];
    case 'heat-4':
      return colors.heat[4];
    case 'self':
      return colors.brand[50];
    default:
      return colors.heat[0]; // empty / heat-0 = 중립 그레이
  }
}

export interface CellProps {
  state: CellStateValue;
  count: number;
  isHeader: boolean;
  label?: string;
  onPress?: (event: GestureResponderEvent) => void;
  testID?: string;
  /** a11y 라벨용 시간 슬롯 인덱스(0=09:00, 15분 단위). Grid가 주입. */
  slotIndex?: number;
  /** a11y 라벨용 날짜 라벨(예: '7/8'). Grid가 주입. */
  dayLabel?: string;
}

const CellComponent: React.FC<CellProps> = ({
  state,
  count,
  isHeader,
  label,
  onPress,
  testID,
  slotIndex,
  dayLabel,
}) => {
  const { colors, duration } = useTheme();
  const reduced = useReducedMotion();

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

  return (
    <BodyCell
      state={state}
      count={count}
      onPress={onPress}
      testID={testID}
      slotIndex={slotIndex}
      dayLabel={dayLabel}
      colors={colors}
      duration={duration}
      reduced={reduced}
    />
  );
};

interface BodyCellProps {
  state: CellStateValue;
  count: number;
  onPress?: (event: GestureResponderEvent) => void;
  testID?: string;
  slotIndex?: number;
  dayLabel?: string;
  colors: ThemeColors;
  duration: ReturnType<typeof useTheme>['duration'];
  reduced: boolean;
}

const BodyCell: React.FC<BodyCellProps> = ({
  state,
  count,
  onPress,
  testID,
  slotIndex,
  dayLabel,
  colors,
  duration,
  reduced,
}) => {
  const targetColor = cellBackgroundColor(state, colors);

  // W2-6 — broadcast 수신(JS state) 경로에만 색 전환 모션. 드래그 worklet(SelectionOverlay/
  // useSweepGesture/Grid GestureDetector)은 무접촉(D12). heat-4 진입만 xLong+emphasized 축하.
  const [bgAnim] = useState(() => new Animated.Value(1));
  const [pair, setPair] = useState<{ from: string; to: string }>({
    from: targetColor,
    to: targetColor,
  });
  const prevStateRef = useRef<CellStateValue>(state);
  const prevColorRef = useRef<string>(targetColor);

  useEffect(() => {
    const to = cellBackgroundColor(state, colors);
    if (prevColorRef.current === to) return; // 색 변화 없음 (동일 state 리렌더)
    const from = prevColorRef.current;
    const stateChanged = prevStateRef.current !== state;
    const heat4Entry = prevStateRef.current !== 'heat-4' && state === 'heat-4';
    prevStateRef.current = state;
    prevColorRef.current = to;

    // 다크 토글(state 동일, 색만 변경) 또는 reduce-motion → 즉시 스냅(축하 없음, §6.4).
    if (reduced || !stateChanged) {
      setPair({ from: to, to });
      bgAnim.setValue(1);
      return;
    }
    setPair({ from, to });
    bgAnim.setValue(0);
    Animated.timing(bgAnim, {
      toValue: 1,
      duration: heat4Entry ? duration.xLong : duration.short,
      easing: heat4Entry ? motionEasing.emphasized : motionEasing.standard,
      useNativeDriver: false, // backgroundColor는 native driver 비호환
    }).start();
  }, [state, reduced, colors, duration, bgAnim]);

  const animatedBg =
    pair.from === pair.to
      ? pair.to
      : bgAnim.interpolate({ inputRange: [0, 1], outputRange: [pair.from, pair.to] });

  const getAccessibilityLabel = (): string => {
    const prefix =
      slotIndex !== undefined && dayLabel !== undefined
        ? `${dayLabel} ${slotTime(slotIndex)}, `
        : '';
    if (state === 'self') {
      return `${prefix}본인 선택, ${count}명 가능`;
    }
    if (state === 'empty' || state === 'heat-0') {
      return `${prefix}투표 없음`;
    }
    return `${prefix}${count}명 가능`;
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
          borderColor: colors.border.strong,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Animated.View
        testID={testID ? `${testID}-bg` : undefined}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: animatedBg }]}
      />
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

/** 슬롯 인덱스(0=09:00, 15분 단위) → a11y 시간 문자열 "19시 30분". */
function slotTime(slotIndex: number): string {
  const hour = 9 + Math.floor(slotIndex / 4);
  const minute = (slotIndex % 4) * 15;
  return minute === 0 ? `${hour}시` : `${hour}시 ${minute}분`;
}

const styles = StyleSheet.create({
  cell: {
    // 2026-06-08: 모든 cells가 동일한 outer box layout — height 16 + right/bottom
    // hairline divider만. self 강조는 inner selfRing absolute View로 옮겨
    // outer borderWidth가 cells마다 다르지 않도록 (정렬 회귀 해소).
    height: 16,
    flex: 1,
    borderRadius: 0,
    // hairlineWidth(~0.5dp) + subtle 색은 너무 흐려서 격자 부재로 보임 — 1pt + strong으로 강화.
    borderRightWidth: 1,
    borderBottomWidth: 1,
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
