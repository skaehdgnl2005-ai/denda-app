// S25 — 홈의 읽기 전용 월간 캘린더.
//
// CalendarDatePicker(모임 후보일 다중선택)와 분리한다: 여기는 과거도 볼 수 있고, 단일 선택이며,
// 월 이동 범위 제한이 없다. 공유 단위는 monthMatrix 순수 로직.
//
// §17.1/D5 — 선택 셀에 보라 fill을 쓰지 않는다. 이 화면에서 보라는 '모임 확정' 신호 전용이고,
// 선택은 surface-3로 표현한다. 오늘은 brand 링 + brand 텍스트.
// §12.6 — 마커는 색 단독 의존 금지 → 셀 accessibilityLabel이 건수·확정 여부를 말한다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import type { DayMarker } from '@/lib/calendar/agenda';
import {
  buildMonthMatrix,
  monthTitle,
  shiftMonth,
  WEEKDAY_LABELS,
  type DayCell,
} from '@/lib/calendar/monthMatrix';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

export interface MonthCalendarProps {
  /** 표시 중인 달 (yyyy-MM-dd) — 부모 소유 */
  anchorIso: string;
  onAnchorChange: (iso: string) => void;
  /** 선택된 날짜 (yyyy-MM-dd) */
  selectedIso: string;
  onSelect: (iso: string) => void;
  /** KST 오늘 — 주입으로 결정적 테스트 */
  todayIso: string;
  /** 날짜별 마커 (수업 제외 — agenda.monthMarkers) */
  markers: Record<string, DayMarker>;
  testID?: string;
}

const CELL_HEIGHT = 44; // 터치 타깃 (§12.1)
const CIRCLE = 36;
const DOT = 4; // 4pt 그리드 정합 (§5)
const DOT_GAP = 4;
const MAX_DOTS = 3;

/** 확정 → 투표 중 → 개인 순으로 최대 3개. 색은 렌더에서 토큰으로 매핑. */
function dotKinds(marker: DayMarker): ('confirmed' | 'muted')[] {
  const kinds: ('confirmed' | 'muted')[] = [];
  if (marker.confirmed) kinds.push('confirmed');
  if (marker.voting) kinds.push('muted');
  if (marker.personal) kinds.push('muted');
  return kinds.slice(0, MAX_DOTS);
}

function accessibilityLabelFor(cell: DayCell, marker: DayMarker | undefined, isToday: boolean) {
  const parts = cell.iso.split('-');
  const base = `${Number(parts[1])}월 ${Number(parts[2])}일 ${WEEKDAY_LABELS[cell.weekday]}요일`;
  const today = isToday ? ', 오늘' : '';
  if (marker === undefined) return `${base}${today}, 일정 없음`;
  const confirmed = marker.confirmed ? ', 확정 모임 있음' : '';
  return `${base}${today}, 일정 ${marker.total}건${confirmed}`;
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  anchorIso,
  onAnchorChange,
  selectedIso,
  onSelect,
  todayIso,
  markers,
  testID,
}) => {
  const { colors, space, radius, duration } = useTheme();
  const reduced = useReducedMotion();

  const weeks = useMemo(() => buildMonthMatrix(anchorIso), [anchorIso]);

  // 월 전환 fade-in (§6.5) — 타이틀은 즉시, 그리드만 부드럽게. reduce-motion=정적(§6.4).
  const [gridFade] = useState(() => new Animated.Value(1));
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (reduced) {
      gridFade.setValue(1);
      return;
    }
    gridFade.setValue(0);
    Animated.timing(gridFade, {
      toValue: 1,
      duration: duration.short,
      easing: motionEasing.enter,
      useNativeDriver: true,
    }).start();
  }, [anchorIso, reduced, gridFade, duration.short]);

  const renderCell = (cell: DayCell): React.JSX.Element => {
    if (!cell.inMonth) {
      return <View key={cell.iso} style={styles.cell} />;
    }
    const isToday = cell.iso === todayIso;
    const isSelected = cell.iso === selectedIso;
    const marker = markers[cell.iso];

    return (
      <Pressable
        key={cell.iso}
        onPress={() => onSelect(cell.iso)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabelFor(cell, marker, isToday)}
        accessibilityState={{ selected: isSelected }}
        testID={`month-day-${cell.iso}`}
        style={styles.cell}
      >
        {({ pressed }) => (
          <>
            <View
              style={[
                styles.circle,
                {
                  borderRadius: radius.full,
                  backgroundColor: isSelected
                    ? colors.surface[3]
                    : pressed
                      ? colors.surface[2]
                      : 'transparent',
                  borderColor: isToday ? colors.brand[500] : 'transparent',
                  borderWidth: isToday ? 1 : 0,
                },
              ]}
            >
              <Body
                variant={isSelected || isToday ? 'bold' : 'primary'}
                color={isToday ? colors.text.brand : colors.text.primary}
                tabularNums
              >
                {String(cell.day)}
              </Body>
            </View>
            {/* 마커 — 자리를 항상 비워둬 날짜 원이 위아래로 흔들리지 않게 한다 */}
            <View
              testID={marker === undefined ? undefined : `month-marker-${cell.iso}`}
              style={[styles.dotRow, { height: DOT, gap: DOT_GAP }]}
            >
              {marker === undefined
                ? null
                : dotKinds(marker).map((kind, i) => (
                    <View
                      key={`${cell.iso}-dot-${i}`}
                      testID={`month-marker-dot-${cell.iso}-${i}`}
                      style={{
                        width: DOT,
                        height: DOT,
                        borderRadius: radius.full,
                        backgroundColor:
                          kind === 'confirmed' ? colors.brand[500] : colors.text.tertiary,
                      }}
                    />
                  ))}
            </View>
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View testID={testID}>
      {/* 월 네비게이션 — 범위 제한 없음(지난 일정도 되돌아본다) */}
      <View style={styles.navRow}>
        <Pressable
          onPress={() => onAnchorChange(shiftMonth(anchorIso, -1))}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          testID="month-calendar-prev"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="뒤로" size={22} color={colors.text.primary} />
        </Pressable>
        <Body variant="bold" color={colors.text.primary} testID="month-calendar-title">
          {monthTitle(anchorIso)}
        </Body>
        <Pressable
          onPress={() => onAnchorChange(shiftMonth(anchorIso, 1))}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          testID="month-calendar-next"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="화살표" size={22} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* 요일 헤더 */}
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((w) => (
          <View key={w} style={styles.weekdayHead}>
            <Caption variant="micro" color={colors.text.tertiary}>
              {w}
            </Caption>
          </View>
        ))}
      </View>

      <Animated.View style={{ opacity: gridFade, marginBottom: space[1] }}>
        {weeks.map((week, wi) => (
          <View key={`week-${wi}`} style={styles.weekRow}>
            {week.map(renderCell)}
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekdayHead: {
    flex: 1,
    alignItems: 'center',
    // 4pt 그리드 정합 (StyleSheet은 hook 미접근 → 정수 유지)
    paddingVertical: 8,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
});
