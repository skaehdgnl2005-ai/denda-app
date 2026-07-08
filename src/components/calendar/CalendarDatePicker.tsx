// 모임 후보 날짜용 월간 캘린더 다중선택 피커.
// 칩 나열 대신 실제 달력 그리드 — 사용자가 요일·주 구조를 보고 고른다.
// §17.1/D5: 선택(보라 fill)은 "확정 의도" = 의미 있는 보라. 장식 아님.
// KST(monthMatrix, luxon) · 한국어 only · 토큰만 사용 (hex 금지).
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import {
  buildMonthMatrix,
  monthTitle,
  shiftMonth,
  WEEKDAY_LABELS,
  type DayCell,
} from '@/lib/calendar/monthMatrix';

export interface CalendarDatePickerProps {
  /** 선택된 yyyy-MM-dd 집합 (부모 소유) */
  selected: Set<string>;
  /** 날짜 토글 — 부모가 최대 개수 enforce */
  onToggle: (iso: string) => void;
  /** KST 오늘 (yyyy-MM-dd). 주입으로 결정적 테스트 */
  todayIso: string;
  /** 최대 선택 가능 일수 (힌트 표시용) */
  maxSelectable?: number;
  /** 오늘 달부터 앞으로 몇 달까지 이동 허용 */
  monthsAhead?: number;
  testID?: string;
}

const CELL_HEIGHT = 44; // 터치 타깃
const CIRCLE = 40;

export const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  selected,
  onToggle,
  todayIso,
  maxSelectable = 7,
  monthsAhead = 3,
  testID,
}) => {
  const { colors, space, radius } = useTheme();
  const [anchorIso, setAnchorIso] = useState(todayIso);

  const weeks = useMemo(() => buildMonthMatrix(anchorIso), [anchorIso]);

  const todayFirst = shiftMonth(todayIso, 0);
  const maxFirst = shiftMonth(todayIso, monthsAhead);
  const anchorFirst = shiftMonth(anchorIso, 0);
  const canPrev = anchorFirst > todayFirst;
  const canNext = anchorFirst < maxFirst;

  const goPrev = (): void => {
    if (canPrev) setAnchorIso(shiftMonth(anchorIso, -1));
  };
  const goNext = (): void => {
    if (canNext) setAnchorIso(shiftMonth(anchorIso, 1));
  };

  const count = selected.size;
  const atMax = count >= maxSelectable;

  const renderCell = (cell: DayCell): React.JSX.Element => {
    if (!cell.inMonth) {
      return <View key={cell.iso} style={styles.cell} />;
    }
    const isPast = cell.iso < todayIso;
    const isToday = cell.iso === todayIso;
    const isSelected = selected.has(cell.iso);
    const cellTestID = isToday ? 'calendar-today' : `calendar-day-${cell.iso}`;

    const parts = cell.iso.split('-');
    const label =
      `${Number(parts[1])}월 ${Number(parts[2])}일 ${WEEKDAY_LABELS[cell.weekday]}요일` +
      `${isToday ? ', 오늘' : ''}${isSelected ? ', 선택됨' : ''}`;

    if (isPast) {
      return (
        <View
          key={cell.iso}
          style={styles.cell}
          testID={cellTestID}
          accessibilityState={{ disabled: true }}
        >
          <Body variant="primary" color={colors.text.disabled} tabularNums>
            {String(cell.day)}
          </Body>
        </View>
      );
    }

    const circleBg = isSelected ? colors.brand[500] : isToday ? colors.brand[50] : 'transparent';
    const textColor = isSelected
      ? colors.text['on-brand']
      : isToday
        ? colors.text.brand
        : colors.text.primary;

    return (
      <Pressable
        key={cell.iso}
        onPress={() => onToggle(cell.iso)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: isSelected }}
        testID={cellTestID}
        style={styles.cell}
      >
        {({ pressed }) => (
          <View
            style={[
              styles.circle,
              {
                borderRadius: radius.full,
                backgroundColor: circleBg,
                borderColor: isToday && !isSelected ? colors.brand[500] : 'transparent',
                borderWidth: isToday && !isSelected ? 1 : 0,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Body variant={isSelected ? 'bold' : 'primary'} color={textColor} tabularNums>
              {String(cell.day)}
            </Body>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View testID={testID}>
      {/* 월 네비게이션 */}
      <View style={[styles.navRow, { marginBottom: space[2] }]}>
        <Pressable
          onPress={goPrev}
          disabled={!canPrev}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          accessibilityState={{ disabled: !canPrev }}
          testID="calendar-prev"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.navButton, { opacity: pressed && canPrev ? 0.6 : 1 }]}
        >
          <Icon
            name="뒤로"
            size={22}
            color={canPrev ? colors.text.primary : colors.text.disabled}
          />
        </Pressable>
        <Body variant="bold" color={colors.text.primary} testID="calendar-title">
          {monthTitle(anchorIso)}
        </Body>
        <Pressable
          onPress={goNext}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          accessibilityState={{ disabled: !canNext }}
          testID="calendar-next"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.navButton, { opacity: pressed && canNext ? 0.6 : 1 }]}
        >
          <Icon
            name="화살표"
            size={22}
            color={canNext ? colors.text.primary : colors.text.disabled}
          />
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

      {/* 주 단위 그리드 */}
      {weeks.map((week, wi) => (
        <View key={`week-${wi}`} style={styles.weekRow}>
          {week.map(renderCell)}
        </View>
      ))}

      {/* 힌트 */}
      <Caption
        variant="default"
        color={atMax ? colors.semantic.warning.fg : colors.text.tertiary}
        style={{ marginTop: space[3], textAlign: 'center' }}
      >
        {atMax
          ? `최대 ${maxSelectable}일을 모두 골랐어요`
          : `최대 ${maxSelectable}일까지 고를 수 있어요`}
        {count > 0 ? ` · ${count}일 선택` : ''}
      </Caption>
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
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
