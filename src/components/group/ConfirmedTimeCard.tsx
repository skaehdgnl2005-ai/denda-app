// S05-screen-confirm — 확정된 모임 시간·장소를 보여주는 read-only 카드.
//
// D13 KST 강제 — luxon으로 UTC ISO → KST 변환 후 표시. bare Date 0건.
// 포맷: "YYYY년 M월 D일 (요일) HH:mm ~ HH:mm"

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DateTime } from 'luxon';

import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';

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
  const { colors, space, radius } = useTheme();
  const formatted = formatRange(startAtUtc, endAtUtc);

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.brand[50],
          borderColor: colors.brand[200],
          borderRadius: radius.md,
          padding: space[4],
          gap: space[2],
        },
      ]}
    >
      <Caption color={colors.text.tertiary}>확정된 시간</Caption>
      <Body color={colors.text.primary} tabularNums style={{ fontWeight: '600' }}>
        {formatted}
      </Body>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
