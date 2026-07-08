// S05-screen-confirm — 확정된 모임 시간·장소를 보여주는 read-only 카드.
//
// D13 KST 강제 — luxon으로 UTC ISO → KST 변환 후 표시. bare Date 0건.
// 포맷: "YYYY년 M월 D일 (요일) HH:mm ~ HH:mm"

import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { DateTime } from 'luxon';

import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

const KST_ZONE = 'Asia/Seoul';
const KO_WEEKDAY = ['월', '화', '수', '목', '금', '토', '일']; // luxon weekday 1..7

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
  const { colors, space, radius, duration } = useTheme();
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
        {
          backgroundColor: colors.brand[50],
          borderColor: colors.brand[200],
          borderRadius: radius.md,
          padding: space[4],
          gap: space[2],
          opacity: enter,
          transform: reduced ? [] : [{ translateY }],
        },
      ]}
    >
      <Caption color={colors.text.tertiary}>확정된 시간</Caption>
      <Body color={colors.text.primary} tabularNums style={{ fontWeight: '600' }}>
        {formatted}
      </Body>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
