// S05-screen-confirm — 확정된 모임 시간·장소를 보여주는 read-only 카드.
//
// D13 KST 강제 — luxon으로 UTC ISO → KST 변환 후 표시. bare Date 0건.
// 포맷: "YYYY년 M월 D일 (요일) HH:mm ~ HH:mm"
// W2-7: 위계 3단계(check 아이콘 + '확정된 시간' 캡션 + 시간 title-3 tabular-nums) +
// 다크 배경 보정(brand-50=6% 알파라 다크에서 투명 → surface-2).

import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { DateTime } from 'luxon';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Caption, Title } from '@/design/typography';
import { KO_WEEKDAY } from '@/lib/datetime/dayHeader';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

const KST_ZONE = 'Asia/Seoul';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

/**
 * 확정 카드 배경/보더. 다크에서 brand-50(6% 알파)은 사실상 투명이라 surface-2로 대체(§0.3).
 * 순수 함수로 분리해 두 모드 색 계약을 단위 검증.
 */
export function confirmedCardSurface(
  isDark: boolean,
  colors: ThemeColors,
): { backgroundColor: string; borderColor: string } {
  return isDark
    ? { backgroundColor: colors.surface[2], borderColor: colors.border.subtle }
    : { backgroundColor: colors.brand[50], borderColor: colors.brand[200] };
}

function formatRange(startUtcIso: string, endUtcIso: string): string {
  const start = DateTime.fromISO(startUtcIso, { zone: 'utc' }).setZone(KST_ZONE);
  const end = DateTime.fromISO(endUtcIso, { zone: 'utc' }).setZone(KST_ZONE);
  const weekday = KO_WEEKDAY[start.weekday - 1] ?? '';
  const dateLabel = `${start.year}년 ${start.month}월 ${start.day}일 (${weekday})`;
  const timeLabel = `${start.toFormat('HH:mm')} ~ ${end.toFormat('HH:mm')}`;
  return `${dateLabel} ${timeLabel}`;
}

export interface ConfirmedTimeCardProps {
  startAtUtc: string;
  endAtUtc: string;
  testID?: string;
}

export const ConfirmedTimeCard: React.FC<ConfirmedTimeCardProps> = ({
  startAtUtc,
  endAtUtc,
  testID,
}) => {
  const { colors, space, radius, duration, isDark } = useTheme();
  const reduced = useReducedMotion();
  const formatted = formatRange(startAtUtc, endAtUtc);
  // 확정 카드의 등장 자체가 클라이맥스 피드백 (§6.5 시간 확정 카드 등장 = long + emphasized).
  const [enter] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    if (reduced) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: duration.long,
      easing: motionEasing.emphasized,
      useNativeDriver: true,
    }).start();
  }, [enter, reduced, duration.long]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.card,
        confirmedCardSurface(isDark, colors),
        {
          borderRadius: radius.md,
          padding: space[4],
          gap: space[2],
          opacity: enter,
          transform: reduced ? [] : [{ translateY }],
        },
      ]}
    >
      <View style={[styles.labelRow, { gap: space[1] }]}>
        <Icon name="성공" size={16} color={colors.brand[500]} />
        <Caption color={colors.text.tertiary}>확정된 시간</Caption>
      </View>
      <Title level="h3" color={colors.text.primary} tabularNums>
        {formatted}
      </Title>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
