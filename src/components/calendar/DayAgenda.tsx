// S25 — 선택한 날의 일정 목록.
//
// 모임(확정/투표 중) · 수업(에브리타임) · 내 일정(수동)을 한 줄씩 보여준다.
// 종류는 색이 아니라 텍스트 칩으로 구분한다(§12.6 색 단독 의존 금지) — 아이콘을 늘리지 않는 선택.
// 보라는 '확정' 신호에만 (D5).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { rowPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import {
  formatKstDayLabel,
  formatKstMinute,
  type CalendarItem,
  type CalendarItemKind,
} from '@/lib/calendar/agenda';

export interface DayAgendaProps {
  /** KST yyyy-MM-dd */
  dateIso: string;
  /** 이 날의 항목 (agenda.groupByDate 결과 — 이미 정렬됨) */
  items: CalendarItem[];
  onPressItem: (item: CalendarItem) => void;
  onAddPress: () => void;
  testID?: string;
}

const KIND_LABEL: Record<CalendarItemKind, string> = {
  'group-confirmed': '모임 · 확정',
  'group-voting': '모임 · 투표 중',
  class: '수업',
  personal: '내 일정',
};

const TIME_COLUMN = 52;
const UNSET_TIME_LABEL = '시간 미정';

function timeAccessibilityPhrase(item: CalendarItem): string {
  if (item.startMinute === null) return UNSET_TIME_LABEL;
  const start = formatKstMinute(item.startMinute);
  if (item.endMinute === null) return `${start}부터`;
  return `${start}부터 ${formatKstMinute(item.endMinute)}까지`;
}

export const DayAgenda: React.FC<DayAgendaProps> = ({
  dateIso,
  items,
  onPressItem,
  onAddPress,
  testID,
}) => {
  const { colors, space, radius } = useTheme();

  return (
    <View testID={testID}>
      <View style={[styles.headerRow, { marginBottom: space[2] }]}>
        <Body variant="bold" color={colors.text.primary} testID="day-agenda-header">
          {formatKstDayLabel(dateIso)}
        </Body>
        <Pressable
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel="이 날에 일정 추가"
          testID="day-agenda-add"
          // 캡션 1줄(~20pt) → hitSlop으로 44pt 확보 (§12.1)
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="더하기" size={16} color={colors.text.secondary} />
          <Caption variant="default" color={colors.text.secondary}>
            일정 추가
          </Caption>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View
          style={[
            styles.emptyBox,
            {
              backgroundColor: colors.surface[2],
              borderColor: colors.border.subtle,
              borderRadius: radius.lg,
              paddingVertical: space[6],
              paddingHorizontal: space[4],
            },
          ]}
        >
          <Body variant="primary" color={colors.text.secondary}>
            이 날은 일정이 없어요
          </Body>
          <Pressable
            onPress={onAddPress}
            accessibilityRole="button"
            accessibilityLabel="일정 추가하기"
            testID="day-agenda-empty-cta"
            // 캡션 1줄(~18pt) → 44pt 확보 (§12.1)
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            style={({ pressed }) => [{ marginTop: space[2], opacity: pressed ? 0.6 : 1 }]}
          >
            <Caption variant="default" color={colors.text.brand}>
              일정 추가하기
            </Caption>
          </Pressable>
        </View>
      ) : (
        items.map((item) => {
          const isConfirmed = item.kind === 'group-confirmed';
          return (
            <Pressable
              key={item.key}
              onPress={() => onPressItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`${timeAccessibilityPhrase(item)}, ${item.title}, ${KIND_LABEL[item.kind]}`}
              testID={`agenda-item-${item.key}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: rowPressBg(pressed, colors),
                  borderRadius: radius.md,
                  paddingVertical: space[3],
                  paddingHorizontal: space[2],
                },
              ]}
            >
              {/* 시간 열 — tabular-nums로 자릿수 흔들림 방지 (§2.3) */}
              <View style={{ width: TIME_COLUMN }}>
                {item.startMinute === null ? (
                  <Caption variant="default" color={colors.text.tertiary}>
                    {UNSET_TIME_LABEL}
                  </Caption>
                ) : (
                  <>
                    <Body
                      variant="primary"
                      color={colors.text.primary}
                      tabularNums
                      testID={`agenda-time-${item.key}`}
                    >
                      {formatKstMinute(item.startMinute)}
                    </Body>
                    {item.endMinute === null ? null : (
                      <Caption
                        variant="micro"
                        color={colors.text.tertiary}
                        tabularNums
                        testID={`agenda-time-${item.key}-end`}
                      >
                        {formatKstMinute(item.endMinute)}
                      </Caption>
                    )}
                  </>
                )}
              </View>

              {/* 좌측 세로 바 — 확정만 brand (D5). 종류 텍스트가 항상 동반되므로 색 단독 아님 */}
              <View
                style={{
                  width: 2,
                  alignSelf: 'stretch',
                  borderRadius: radius.full,
                  backgroundColor: isConfirmed ? colors.brand[500] : colors.border.subtle,
                  marginRight: space[3],
                }}
              />

              <View style={{ flex: 1 }}>
                <Body variant="bold" color={colors.text.primary}>
                  {item.title}
                </Body>
                <View style={[styles.metaRow, { gap: space[1], marginTop: space['0.5'] }]}>
                  {item.subtitle === null ? null : (
                    <>
                      <Caption variant="micro" color={colors.text.secondary}>
                        {item.subtitle}
                      </Caption>
                      <Caption variant="micro" color={colors.text.tertiary}>
                        ·
                      </Caption>
                    </>
                  )}
                  <Caption variant="micro" color={colors.text.tertiary}>
                    {KIND_LABEL[item.kind]}
                  </Caption>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  emptyBox: {
    borderWidth: 1,
    alignItems: 'center',
  },
});
