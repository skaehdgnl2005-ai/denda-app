// 모임 확정 추천 시트 — 호스트가 "모임 확정"을 누르면 히트맵 집계 기준 1~3순위 시간을
// 보여주고 하나를 골라 확정한다. 투표(여러 날짜)와 확정(단일 날짜 구간)을 분리하는 surface.
//
// D13 KST — 날짜 라벨은 luxon Asia/Seoul (bare Date 금지). 시간은 분 단위 산술 포맷(24:00 유지).
// §17 anti-AI-feel: brand fill은 1순위 rank 뱃지에만 (D5 — 모임 확정 = 보라 허용 맥락).
// 색 단독 의존 금지 — 인원수 라벨("N명 가능") 동반.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DateTime } from 'luxon';

import { Icon } from '@/components/Icon';
import { rowPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import type { RecommendedSlot } from '@/lib/groups/recommendSlots';

const KST_ZONE = 'Asia/Seoul';
const KO_WEEKDAY = ['월', '화', '수', '목', '금', '토', '일']; // luxon weekday 1..7

function formatDate(day: string): string {
  const dt = DateTime.fromISO(day, { zone: KST_ZONE });
  if (!dt.isValid) return day;
  const weekday = KO_WEEKDAY[dt.weekday - 1] ?? '';
  return `${dt.month}/${dt.day} (${weekday})`;
}

function formatMinute(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface ConfirmSlotSheetProps {
  visible: boolean;
  recommendations: RecommendedSlot[];
  onSelect: (rec: RecommendedSlot) => void;
  onClose: () => void;
  /** 확정 진행 중 — 중복 탭 방어 */
  inflight?: boolean;
  testID?: string;
}

export const ConfirmSlotSheet: React.FC<ConfirmSlotSheetProps> = ({
  visible,
  recommendations,
  onSelect,
  onClose,
  inflight = false,
  testID,
}) => {
  const { colors, space, radius } = useTheme();

  if (!visible) return null;

  const id = testID ?? 'confirm-slot-sheet';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={id}>
      <View
        style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}
        accessibilityViewIsModal
      >
        <View
          testID={`${id}-container`}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface[1],
              borderTopLeftRadius: radius['2xl'],
              borderTopRightRadius: radius['2xl'],
              paddingHorizontal: space[5],
              paddingTop: space[5],
              paddingBottom: space[6],
            },
          ]}
        >
          <View
            testID={`${id}-grabber`}
            style={[
              styles.grabber,
              {
                backgroundColor: colors.surface[3],
                borderRadius: radius.full,
                marginTop: space[2],
              },
            ]}
          />

          <Title level="h2" color={colors.text.primary}>
            이 시간 어때요?
          </Title>
          <Body variant="sm" color={colors.text.secondary} style={{ marginTop: space[2] }}>
            가장 많은 인원이 가능한 시간이에요. 하나를 골라 확정하세요.
          </Body>

          {recommendations.length === 0 ? (
            <View style={{ paddingVertical: space[6] }}>
              <Body color={colors.text.secondary} style={{ textAlign: 'center' }}>
                아직 추천할 시간이 없어요.
              </Body>
              <Caption
                color={colors.text.tertiary}
                style={{ textAlign: 'center', marginTop: space[2] }}
              >
                멤버들이 투표하면 가장 인기 있는 시간을 추천해 드려요.
              </Caption>
            </View>
          ) : (
            <ScrollView style={{ marginTop: space[4] }} bounces={false}>
              {recommendations.map((rec, index) => {
                const isTop = index === 0;
                const dateLabel = formatDate(rec.day);
                const timeLabel = `${formatMinute(rec.startMinute)} ~ ${formatMinute(rec.endMinute)}`;
                return (
                  <Pressable
                    key={`${rec.dayIndex}:${rec.startMinute}`}
                    testID={`${id}-slot-${index}`}
                    onPress={() => {
                      if (inflight) return;
                      onSelect(rec);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${dateLabel} ${timeLabel}, ${rec.count}명 가능, 이 시간으로 확정`}
                    accessibilityState={{ disabled: inflight }}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: isTop ? colors.border.focus : colors.border.subtle,
                        backgroundColor: isTop ? colors.brand[50] : colors.surface[1],
                        paddingVertical: space[3],
                        paddingHorizontal: space[3],
                        marginBottom: space[2],
                        opacity: pressed && !inflight ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.rankBadge,
                        {
                          borderRadius: radius.full,
                          backgroundColor: isTop ? colors.brand[500] : colors.surface[2],
                        },
                      ]}
                    >
                      <Caption
                        variant="default"
                        color={isTop ? colors.text['on-brand'] : colors.text.secondary}
                        tabularNums
                        style={{ fontWeight: '700' }}
                      >
                        {rec.rank}
                      </Caption>
                    </View>

                    <View style={styles.rowBody}>
                      <View style={styles.rowHeadline}>
                        <Body variant="bold" color={colors.text.primary}>
                          {dateLabel}
                        </Body>
                        <Body
                          color={colors.text.primary}
                          tabularNums
                          style={{ marginLeft: space[2] }}
                        >
                          {timeLabel}
                        </Body>
                      </View>
                      <Caption
                        color={colors.text.tertiary}
                        tabularNums
                        style={{ marginTop: space['0.5'] }}
                      >
                        {rec.count}명 가능
                      </Caption>
                    </View>

                    <Icon name="화살표" color={colors.text.tertiary} size={20} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            onPress={onClose}
            disabled={inflight}
            accessibilityRole="button"
            accessibilityLabel="취소"
            testID={`${id}-cancel`}
            style={({ pressed }) => [
              styles.cancel,
              {
                borderRadius: radius.md,
                paddingVertical: space[3],
                marginTop: space[3],
                backgroundColor: rowPressBg(pressed && !inflight, colors, colors.surface[2]),
              },
            ]}
          >
            <Body variant="bold" color={colors.text.secondary}>
              {inflight ? '확정 중...' : '취소'}
            </Body>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '80%',
  },
  grabber: {
    width: 36,
    height: 4,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  rankBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowHeadline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});
