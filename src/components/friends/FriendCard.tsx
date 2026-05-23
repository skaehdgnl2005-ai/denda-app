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

export const FriendCard: React.FC<FriendCardProps> = ({
  friend,
  onMakeGroup,
  onMore,
}) => {
  const { colors, space, radius } = useTheme();

  const initial = friend.nickname ? friend.nickname.charAt(0) : '?';
  const meetingCount = friend.recent_meetings_count ?? 0;

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
      testID="friend-card"
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: colors.surface[3],
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
        <Body variant="bold" color={colors.text.primary} style={styles.nickname}>
          {friend.nickname}
        </Body>
        <Caption variant="default" color={colors.text.tertiary} tabularNums>
          최근 모임 {meetingCount}회
        </Caption>
      </View>

      {/* CTA Button */}
      <Pressable
        onPress={() => onMakeGroup(friend)}
        accessibilityRole="button"
        accessibilityLabel={`${friend.nickname}님과 모임 만들기`}
        style={({ pressed }) => [
          styles.ctaButton,
          {
            backgroundColor: colors.brand[500],
            borderRadius: radius.md,
            paddingVertical: space[2],
            paddingHorizontal: space[3],
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        testID="make-group-button"
      >
        <Body variant="sm-bold" color={colors.text['on-brand']}>
          모임 만들기
        </Body>
      </Pressable>

      {/* More Button */}
      <Pressable
        onPress={() => onMore(friend)}
        accessibilityRole="button"
        accessibilityLabel="친구 메뉴 더보기"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={({ pressed }) => [
          styles.moreButton,
          {
            marginLeft: space[2],
            opacity: pressed ? 0.6 : 1,
          },
        ]}
        testID="more-button"
      >
        <Icon name="더보기" color={colors.text.secondary} size={20} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
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
  nickname: {
    marginBottom: 2,
  },
  ctaButton: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 36,
  },
  moreButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
