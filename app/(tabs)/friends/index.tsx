import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  View,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { FriendCard } from '@/components/friends/FriendCard';
import { ReportBlockSheet } from '@/components/friends/ReportBlockSheet';
import { FriendUser, friendsApi } from '@/lib/friends/api';

export default function FriendsIndexScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [requestCount, setRequestCount] = useState<number>(0);

  // Sheet states
  const [selectedFriend, setSelectedFriend] = useState<FriendUser | null>(null);
  const [sheetVisible, setSheetVisible] = useState<boolean>(false);

  const fetchFriends = useCallback(async () => {
    try {
      const list = await friendsApi.list();
      const incoming = await friendsApi.listIncomingRequests();
      setFriends(list);
      setRequestCount(incoming.length);
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '친구 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFriends();
  };

  const handleMakeGroup = (friend: FriendUser) => {
    Alert.alert('모임 만들기', `${friend.nickname}님과 모임을 만듭니다.`);
  };

  const handleMore = (friend: FriendUser) => {
    setSelectedFriend(friend);
    setSheetVisible(true);
  };

  const handleBlock = async (userId: string) => {
    try {
      await friendsApi.blockUser(userId);
      Alert.alert('알림', '사용자가 차단되었습니다.');
      fetchFriends();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '차단에 실패했습니다.');
    }
  };

  const handleReport = async (userId: string, reason: string, description: string) => {
    try {
      await friendsApi.reportUser(userId, reason, description);
      Alert.alert('알림', '신고가 접수되었습니다.');
      fetchFriends();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '신고에 실패했습니다.');
    }
  };

  const handleKakaoInvite = () => {
    Alert.alert('카톡으로 초대', '카카오톡 공유 링크가 복사되었습니다.');
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer} testID="empty-state">
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface[2] }]}>
        <Icon name="친구" color={colors.text.tertiary} size={48} />
      </View>
      <Title level="h3" color={colors.text.primary} style={styles.emptyTitle}>
        친구를 초대해보세요
      </Title>
      <Body variant="sm" color={colors.text.secondary} style={styles.emptySubtitle}>
        친구들과 더 빠르고 편하게 시간을 맞출 수 있어요.
      </Body>
      <Pressable
        onPress={handleKakaoInvite}
        accessibilityRole="button"
        accessibilityLabel="카카오톡으로 초대"
        style={({ pressed }) => [
          styles.inviteButton,
          {
            backgroundColor: colors.brand[500],
            marginTop: space[6],
            paddingHorizontal: space[6],
            paddingVertical: space[3],
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Body variant="bold" color={colors.text['on-brand']}>
          카톡으로 초대
        </Body>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface[0] }]}>
      {/* Custom Navigation Top-Bar */}
      <View style={[styles.topBar, { paddingHorizontal: space[4], paddingVertical: space[3] }]}>
        <Title level="h1" color={colors.text.primary}>
          친구
        </Title>
        <View style={styles.topBarRight}>
          {/* Search Button */}
          <Pressable
            onPress={() => router.push('/friends/search')}
            accessibilityRole="button"
            accessibilityLabel="친구 검색으로 이동"
            style={({ pressed }) => [
              styles.iconButton,
              { marginRight: space[3], opacity: pressed ? 0.6 : 1 },
            ]}
            testID="search-nav-button"
          >
            <Icon name="검색" color={colors.text.primary} size={24} />
          </Pressable>

          {/* Requests Inbox Button */}
          <Pressable
            onPress={() => router.push('/friends/requests')}
            accessibilityRole="button"
            accessibilityLabel="친구 요청함으로 이동"
            style={({ pressed }) => [
              styles.iconButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            testID="requests-nav-button"
          >
            <Icon name="추가" color={colors.text.primary} size={24} />
            {requestCount > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.semantic.error.solid,
                  },
                ]}
                testID="requests-badge"
              >
                <Body variant="sm-bold" color={colors.text.inverse} style={styles.badgeText} tabularNums>
                  {requestCount}
                </Body>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Main Content List */}
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: space[4],
            paddingVertical: space[2],
            flexGrow: 1,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: space[3] }}>
            <FriendCard
              friend={item}
              onMakeGroup={handleMakeGroup}
              onMore={handleMore}
            />
          </View>
        )}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        testID="friends-flatlist"
      />

      {/* Bottom Sheet Modal */}
      <ReportBlockSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        targetUser={selectedFriend}
        onBlock={handleBlock}
        onReport={handleReport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inviteButton: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
