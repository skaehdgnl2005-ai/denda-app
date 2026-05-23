import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DateTime } from 'luxon';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import { FriendRequest } from '@/lib/friends/api';

export interface FriendRequestCardProps {
  request: FriendRequest;
  type: 'incoming' | 'outgoing';
  onAccept?: (request: FriendRequest) => void;
  onReject?: (request: FriendRequest) => void;
  onCancel?: (request: FriendRequest) => void;
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

  // KST Time Formatting
  const formattedTime = DateTime.fromISO(request.created_at)
    .setZone('Asia/Seoul')
    .toFormat('yyyy.MM.dd HH:mm');

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: colors.border.subtle,
          borderRadius: radius.md,
          padding: space[4],
          backgroundColor: colors.surface[1],
        },
      ]}
      testID="friend-request-card"
    >
      <View style={styles.topRow}>
        {/* Avatar */}
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colors.surface[3],
              borderRadius: radius.full,
            },
          ]}
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
          <Caption variant="default" color={colors.text.tertiary} tabularNums>
            {formattedTime}
          </Caption>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={[styles.actionsContainer, { marginTop: space[3] }]}>
        {type === 'incoming' ? (
          <>
            <Pressable
              onPress={() => onReject?.(request)}
              accessibilityRole="button"
              accessibilityLabel="친구 요청 거절"
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: colors.surface[3],
                  borderRadius: radius.md,
                  marginRight: space[2],
                  opacity: pressed ? 0.8 : 1,
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
                {
                  backgroundColor: colors.brand[500],
                  borderRadius: radius.md,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              testID="accept-button"
            >
              <Body variant="sm-bold" color={colors.text['on-brand']}>
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
                backgroundColor: colors.surface[3],
                borderRadius: radius.md,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            testID="cancel-button"
          >
            <Body variant="sm-bold" color={colors.text.secondary}>
              취소
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
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
