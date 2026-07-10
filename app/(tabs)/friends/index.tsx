import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { FriendCard } from '@/components/friends/FriendCard';
import { ReportBlockSheet } from '@/components/friends/ReportBlockSheet';
import { FriendUser, friendsApi } from '@/lib/friends/api';
import { invitationsApi } from '@/lib/groups/invitations';
import { submitReport } from '@/lib/reports/api';
import { type ReportReasonKey } from '@/lib/reports/reasons';
import { mapError, messages } from '@/lib/i18n/messages';
import { useAuth } from '@/lib/auth/setup';
import { useKakaoInvite } from '@/lib/share/useKakaoInvite';

export default function FriendsIndexScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const reporterId = useAuth((s) => s.session?.user.id ?? null);
  const handleKakaoInvite = useKakaoInvite();

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [requestCount, setRequestCount] = useState<number>(0);

  // Sheet states
  const [selectedFriend, setSelectedFriend] = useState<FriendUser | null>(null);
  const [sheetVisible, setSheetVisible] = useState<boolean>(false);

  const fetchFriends = useCallback(async () => {
    try {
      const [list, incoming] = await Promise.all([
        friendsApi.list(),
        friendsApi.listIncomingRequests(),
      ]);
      setFriends(list);
      // W2-10 — 배지 카운트 = 받은 친구 요청 + 대기중 모임 초대 합산. 단, 초대 조회 실패는
      // 부차 정보(배지)만 저하시키고 친구 목록(주 콘텐츠)을 에러로 가리지 않는다(리뷰 confirmed).
      let inviteCount = 0;
      try {
        inviteCount = (await invitationsApi.listMyInvitations()).length;
      } catch {
        // 배지만 요청 수로 저하 — 목록은 그대로 노출.
      }
      setRequestCount(incoming.length + inviteCount);
      setError(false);
    } catch (e) {
      // 에러를 빈 상태로 위장하지 않는다(W1-8) — error 분리 후 EmptyState error로 표출.
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // 데이터 fetch trigger — fetchFriends 내부 setLoading/setRefreshing 호출은 의도
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFriends();
  }, [fetchFriends]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFriends();
  };

  const onRetry = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchFriends();
  }, [fetchFriends]);

  // S18: 베타는 멤버 사전 선택 없이 생성 후 링크 공유. 친구 사전선택 초대는 S22.
  const handleMakeGroup = (_friend: FriendUser) => {
    router.push('/group/new');
  };

  const handleMore = (friend: FriendUser) => {
    setSelectedFriend(friend);
    setSheetVisible(true);
  };

  const handleBlock = async (userId: string) => {
    try {
      await friendsApi.blockUser(userId);
      setSheetVisible(false);
      fetchFriends();
      toast.show({ message: messages.success.blocked, variant: 'success' });
    } catch (e) {
      const { silent, message } = mapError(e);
      if (!silent) toast.show({ message, variant: 'error' });
    }
  };

  // S07-report: supabase reports INSERT (D32 베타 DB-only, 운영 통지는 deferred).
  const handleReport = async (targetUserId: string, reason: ReportReasonKey, detail: string) => {
    if (!reporterId) {
      toast.show({ message: '로그인이 필요해요.', variant: 'error' });
      return;
    }
    try {
      await submitReport({ reporterId, targetUserId, reason, detail });
      setSheetVisible(false);
      toast.show({ message: messages.success.reported, variant: 'success' });
    } catch (e) {
      const { silent, message } = mapError(e);
      if (!silent) toast.show({ message, variant: 'error' });
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer} testID="empty-state">
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.brand[50] }]}>
        <Icon name="친구" color={colors.brand[500]} size={36} />
      </View>
      <Title level="h3" color={colors.text.primary} style={styles.emptyTitle}>
        아직 친구가 없어요
      </Title>
      <Body variant="sm" color={colors.text.tertiary} style={styles.emptySubtitle}>
        카톡 친구를 초대하면{'\n'}함께 시간을 맞춰볼 수 있어요.
      </Body>
      <Pressable
        onPress={handleKakaoInvite}
        accessibilityRole="button"
        accessibilityLabel="카카오톡으로 초대"
        testID="kakao-invite-button"
        style={({ pressed }) => [
          styles.inviteButton,
          {
            backgroundColor: colors.brand[500],
            marginTop: space[6],
            paddingHorizontal: space[6],
            paddingVertical: space[3],
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Body variant="bold" color={colors.text['on-brand']}>
          카톡으로 초대하기
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
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
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
                <Body
                  variant="sm-bold"
                  color={colors.text.inverse}
                  style={styles.badgeText}
                  tabularNums
                >
                  {requestCount}
                </Body>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Main Content — 첫 로딩=Skeleton(빈 화면 아님), 에러=EmptyState error(빈 상태 위장 아님) */}
      {loading ? (
        <View
          testID="friends-loading"
          style={{ paddingHorizontal: space[4], paddingTop: space[2] }}
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={72} style={{ marginBottom: space[3] }} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          variant="error"
          title="친구 목록을 불러오지 못했어요"
          body="잠시 후 다시 시도해볼게요."
          cta={{ label: messages.action.retry, onPress: onRetry }}
          testID="friends-error"
        />
      ) : (
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={{ marginBottom: space[3] }}>
              <FriendCard friend={item} onMakeGroup={handleMakeGroup} onMore={handleMore} />
            </View>
          )}
          ListEmptyComponent={renderEmptyState}
          testID="friends-flatlist"
        />
      )}

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
