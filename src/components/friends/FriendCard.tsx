// 친구 카드 — §17.1 (반복 CTA) + §17.3 (위계) + 피드백 P0 4 (아바타 통일).
// 활성도 시각 차이 제거 — 한국 정서상 친구 등급화 부적절.
// testID는 보존 (friend-card, make-group-button, more-button).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { FriendUser } from '@/lib/friends/api';

export interface FriendCardProps {
  friend: FriendUser;
  onMakeGroup: (friend: FriendUser) => void;
  onMore: (friend: FriendUser) => void;
}

export const FriendCard: React.FC<FriendCardProps> = ({ friend, onMakeGroup, onMore }) => {
  const { colors, space, radius } = useTheme();

  const initial = friend.nickname ? friend.nickname.charAt(0) : '?';
  const meetingCount = friend.recent_meetings_count ?? 0;

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: colors.border.subtle,
          borderRadius: radius.lg,
          backgroundColor: colors.surface[1],
        },
      ]}
      testID="friend-card"
    >
      <Pressable
        onPress={() => onMakeGroup(friend)}
        accessibilityRole="button"
        accessibilityLabel={`${friend.nickname}님과 모임 만들기`}
        style={({ pressed }) => [
          styles.pressableRow,
          {
            paddingLeft: space[4],
            paddingRight: space[2],
            paddingVertical: space[3],
            borderRadius: radius.lg,
            backgroundColor: pressed ? colors.brand[50] : 'transparent',
          },
        ]}
        testID="make-group-button"
      >
        {/* Avatar — 모든 친구 동일 surface-2 + text-primary (피드백 P0 4) */}
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colors.surface[2],
              borderRadius: radius.full,
            },
          ]}
          testID="friend-avatar"
        >
          <Body variant="bold" color={colors.text.primary}>
            {initial}
          </Body>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Body variant="bold" color={colors.text.primary}>
            {friend.nickname}
          </Body>
          <Caption variant="default" color={colors.text.tertiary} tabularNums>
            최근 모임 {meetingCount}회
          </Caption>
        </View>

        {/* Chevron — 카드가 액션이라는 affordance */}
        <View style={styles.chevron}>
          <Icon name="화살표" color={colors.text.tertiary} size={20} />
        </View>
      </Pressable>

      {/* More — hitSlop 44pt까지 확장 (피드백 P2) */}
      <Pressable
        onPress={() => onMore(friend)}
        accessibilityRole="button"
        accessibilityLabel="친구 메뉴 더보기"
        hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
        style={({ pressed }) => [
          styles.moreButton,
          {
            marginRight: space[3],
            opacity: pressed ? 0.5 : 1,
          },
        ]}
        testID="more-button"
      >
        <Icon name="더보기" color={colors.text.tertiary} size={18} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 64,
  },
  pressableRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  chevron: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  moreButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
