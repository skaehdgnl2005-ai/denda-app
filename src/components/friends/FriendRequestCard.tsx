// 친구 요청 카드 — 피드백 P0 5 (시간 의미 명확화) + P1 10 (pill contrast).
//   - 시간: 절대시각 대신 상대 시간 "방금 전 / N분 전 / N일 전"
//   - "요청 시각" 라벨 명시
//   - 받은 요청: 좌측 brand 스트라이프 + 거절(ghost)/수락(brand) 페어
//   - 보낸 요청 pill: brand-100 + brand-700 + 시계 아이콘
// testID 보존.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DateTime } from 'luxon';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { FriendRequest } from '@/lib/friends/api';

export interface FriendRequestCardProps {
  request: FriendRequest;
  type: 'incoming' | 'outgoing';
  onAccept?: (request: FriendRequest) => void;
  onReject?: (request: FriendRequest) => void;
  onCancel?: (request: FriendRequest) => void;
}

function formatRelative(iso: string): string {
  const now = DateTime.now().setZone('Asia/Seoul');
  const then = DateTime.fromISO(iso).setZone('Asia/Seoul');
  const diff = now.diff(then, ['days', 'hours', 'minutes']);
  const days = Math.floor(diff.days);
  const hours = Math.floor(diff.hours);
  const minutes = Math.floor(diff.minutes);

  if (days >= 7) {
    return then.toFormat('yyyy.MM.dd');
  }
  if (days >= 1) {
    return `${days}일 전`;
  }
  if (hours >= 1) {
    return `${hours}시간 전`;
  }
  if (minutes >= 1) {
    return `${minutes}분 전`;
  }
  return '방금 전';
}

export const FriendRequestCard: React.FC<FriendRequestCardProps> = ({
  request,
  type,
  onAccept,
  onReject,
  onCancel,
}) => {
  const { colors, space, radius } = useTheme();

  const user = type === 'incoming' ? request.sender : request.receiver;
  const nickname = user?.nickname ?? '알 수 없는 사용자';
  const initial = nickname.charAt(0);

  // 베타: 상대 시간 + "요청" 라벨. 절대 시각은 long-press 시 노출(후속 sprint).
  const relativeTime = formatRelative(request.created_at);

  const isIncoming = type === 'incoming';

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: colors.border.subtle,
          borderRadius: radius.lg,
          paddingHorizontal: space[4],
          paddingVertical: space[4],
          backgroundColor: colors.surface[1],
        },
      ]}
      testID="friend-request-card"
    >
      {isIncoming ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: space[4],
            bottom: space[4],
            width: 3,
            borderTopRightRadius: 2,
            borderBottomRightRadius: 2,
            backgroundColor: colors.brand[500],
          }}
        />
      ) : null}

      <View style={styles.topRow}>
        {/* Avatar — 통일된 회색 (피드백 P0 4와 같은 원칙) */}
        <View
          style={[styles.avatar, { backgroundColor: colors.surface[2], borderRadius: radius.full }]}
        >
          <Body variant="bold" color={colors.text.primary}>
            {initial}
          </Body>
        </View>

        {/* Text Details */}
        <View style={styles.textContainer}>
          <Body variant="bold" color={colors.text.primary}>
            {nickname}
          </Body>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Caption variant="micro" color={colors.text.tertiary}>
              요청 ·{' '}
            </Caption>
            <Caption variant="default" color={colors.text.secondary} tabularNums>
              {relativeTime}
            </Caption>
          </View>
        </View>

        {/* 보낸 요청 상태 칩 — brand-100 + brand-700 + 시계 아이콘 (P1 10) */}
        {!isIncoming ? (
          <View
            style={[
              styles.statusChip,
              {
                backgroundColor: colors.brand[100],
                borderRadius: radius.pill,
                paddingHorizontal: space[3],
                paddingVertical: 5,
              },
            ]}
          >
            <Icon name="시간" color={colors.brand[700]} size={11} />
            <Caption
              variant="micro"
              color={colors.brand[700]}
              style={{ marginLeft: 4, fontWeight: '700' }}
            >
              응답 대기
            </Caption>
          </View>
        ) : null}
      </View>

      <View style={[styles.actionsContainer, { marginTop: space[3] }]}>
        {isIncoming ? (
          <>
            <Pressable
              onPress={() => onReject?.(request)}
              accessibilityRole="button"
              accessibilityLabel="친구 요청 거절"
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: colors.surface[2],
                  borderColor: colors.border.subtle,
                  borderRadius: radius.md,
                  marginRight: space[2],
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              testID="reject-button"
            >
              <Body variant="sm-bold" color={colors.text.secondary}>
                거절
              </Body>
            </Pressable>

            <Pressable
              onPress={() => onAccept?.(request)}
              accessibilityRole="button"
              accessibilityLabel="친구 요청 수락"
              style={({ pressed }) => [
                styles.actionButton,
                styles.acceptButton,
                {
                  backgroundColor: colors.brand[500],
                  borderRadius: radius.md,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              testID="accept-button"
            >
              <Icon name="확정" color={colors.text['on-brand']} size={16} />
              <Body
                variant="sm-bold"
                color={colors.text['on-brand']}
                style={{ marginLeft: space[1] }}
              >
                수락
              </Body>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={() => onCancel?.(request)}
            accessibilityRole="button"
            accessibilityLabel="보낸 친구 요청 취소"
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: colors.surface[2],
                borderColor: colors.border.subtle,
                borderRadius: radius.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="cancel-button"
          >
            <Body variant="sm-bold" color={colors.text.secondary}>
              요청 취소
            </Body>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    position: 'relative',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  acceptButton: {
    flexDirection: 'row',
  },
});
