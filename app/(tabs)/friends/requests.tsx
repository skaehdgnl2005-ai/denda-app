import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Animated, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { rowPressBg, ctaPressBg } from '@/design/press';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { Body, Caption, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { FriendRequestCard } from '@/components/friends/FriendRequestCard';
import { FriendRequest, friendsApi } from '@/lib/friends/api';
import { invitationsApi, type GroupInvitation } from '@/lib/groups/invitations';
import { mapError, messages } from '@/lib/i18n/messages';

type RequestTab = 'incoming' | 'outgoing' | 'invitations';

const TAB_ORDER: RequestTab[] = ['incoming', 'outgoing', 'invitations'];

export default function FriendsRequestsScreen() {
  const { colors, space, radius, duration } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [activeTab, setActiveTab] = useState<RequestTab>('incoming');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  // W3-5 탭 인디케이터 — 단일 밑줄이 활성 탭으로 translateX 슬라이드(§6.5, reduce-motion=스냅).
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [indicatorX] = useState(() => new Animated.Value(0));
  const activeIndex = TAB_ORDER.indexOf(activeTab);
  const tabWidth = tabBarWidth / TAB_ORDER.length;
  useEffect(() => {
    const to = activeIndex * tabWidth;
    if (reduced || tabBarWidth === 0) {
      indicatorX.setValue(to);
      return;
    }
    Animated.timing(indicatorX, {
      toValue: to,
      duration: duration.short,
      easing: motionEasing.standard,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, tabWidth, reduced, tabBarWidth, indicatorX, duration.short]);

  // W2-10 in-flight 잠금 — 요청/초대 id별 액션 진행 표시.
  //   pendingRef: 같은 tick 더블탭 즉시 차단(동기). pendingIds: 카드 회색 비활성 시각(리렌더).
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const pendingRef = useRef<Set<string>>(new Set());

  // 데이터 로드 본체 — loading 토글 없음. pull-to-refresh·액션 후 조용한 refetch에 재사용
  // (스켈레톤 점멸 없이 목록 유지).
  const loadData = useCallback(async () => {
    setError(false);
    try {
      if (activeTab === 'incoming') {
        setRequests(await friendsApi.listIncomingRequests());
      } else if (activeTab === 'outgoing') {
        setRequests(await friendsApi.listOutgoingRequests());
      } else {
        setInvitations(await invitationsApi.listMyInvitations());
      }
    } catch (e) {
      // 로드 실패를 빈 상태로 위장하지 않는다 — error 분리 후 EmptyState error로.
      console.error(e);
      setError(true);
    }
  }, [activeTab]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await loadData();
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    // 데이터 fetch trigger — fetchData 내부 setLoading 호출은 의도
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // 액션 진행 가드 헬퍼 — 동기 ref로 더블탭 차단 + pendingIds 시각 토글.
  const withPending = useCallback(async (id: string, run: () => Promise<void>): Promise<void> => {
    if (pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    setPendingIds((prev) => [...prev, id]);
    try {
      await run();
    } finally {
      pendingRef.current.delete(id);
      setPendingIds((prev) => prev.filter((x) => x !== id));
    }
  }, []);

  const handleAccept = (req: FriendRequest): Promise<void> =>
    withPending(req.id, async () => {
      try {
        // S23: sender_id 전달 → F2 push 대상 식별 (수락된 사실을 원래 요청 보낸 사람에게 알림)
        await friendsApi.acceptRequest(req.id, req.sender_id);
        toast.show({ message: '친구 요청을 수락했어요.', variant: 'success' });
        await loadData();
      } catch (e) {
        console.error(e);
        const { silent, message } = mapError(e);
        if (!silent) toast.show({ message, variant: 'error' });
      }
    });

  const handleReject = (req: FriendRequest): Promise<void> =>
    withPending(req.id, async () => {
      try {
        await friendsApi.rejectRequest(req.id);
        toast.show({ message: '친구 요청을 거절했어요.' });
        await loadData();
      } catch (e) {
        console.error(e);
        const { silent, message } = mapError(e);
        if (!silent) toast.show({ message, variant: 'error' });
      }
    });

  const handleCancel = (req: FriendRequest): Promise<void> =>
    withPending(req.id, async () => {
      try {
        await friendsApi.cancelRequest(req.id);
        toast.show({ message: '보낸 요청을 취소했어요.' });
        await loadData();
      } catch (e) {
        console.error(e);
        const { silent, message } = mapError(e);
        if (!silent) toast.show({ message, variant: 'error' });
      }
    });

  // S22: 모임 초대 수락/거절. 수락 시 RPC 가 group_members INSERT + status UPDATE atomic 처리.
  const handleInvitationAccept = (inv: GroupInvitation): Promise<void> =>
    withPending(inv.id, async () => {
      try {
        const { groupId } = await invitationsApi.acceptInvitation(inv.id);
        toast.show({ message: messages.success.joined, variant: 'success' });
        router.push(`/group/${groupId}`);
      } catch (e) {
        const { silent, message } = mapError(e);
        if (!silent) toast.show({ message, variant: 'error' });
      }
    });

  const handleInvitationReject = (inv: GroupInvitation): Promise<void> =>
    withPending(inv.id, async () => {
      try {
        await invitationsApi.rejectInvitation(inv.id);
        toast.show({ message: '모임 초대를 거절했어요.' });
        await loadData();
      } catch (e) {
        const { silent, message } = mapError(e);
        if (!silent) toast.show({ message, variant: 'error' });
      }
    });

  const renderInvitationCard = ({ item }: { item: GroupInvitation }) => {
    const invPending = pendingIds.includes(item.id);
    return (
      <View
        testID="group-invitation-card"
        style={{
          backgroundColor: colors.surface[1],
          borderRadius: radius.md,
          padding: space[4],
          borderWidth: 1,
          borderColor: colors.border.subtle,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space[3] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.full,
              backgroundColor: colors.brand[50],
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: space[3],
            }}
          >
            <Icon name="캘린더" color={colors.brand[500]} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Body variant="bold" color={colors.text.primary} numberOfLines={1}>
              {item.group?.name ?? '이름 없는 모임'}
            </Body>
            <Caption color={colors.text.tertiary} numberOfLines={1}>
              {item.inviter?.nickname
                ? `${item.inviter.nickname}님이 초대했어요`
                : '친구가 초대했어요'}
            </Caption>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Pressable
            onPress={() => handleInvitationReject(item)}
            disabled={invPending}
            accessibilityRole="button"
            accessibilityLabel="모임 초대 거절"
            testID="invitation-reject-button"
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: rowPressBg(pressed, colors, colors.surface[2]),
              borderRadius: radius.md,
              paddingVertical: space[3],
              alignItems: 'center',
            })}
          >
            <Body
              variant="sm-bold"
              color={invPending ? colors.text.tertiary : colors.text.secondary}
            >
              거절
            </Body>
          </Pressable>
          <Pressable
            onPress={() => handleInvitationAccept(item)}
            disabled={invPending}
            accessibilityRole="button"
            accessibilityLabel="모임 초대 수락 + 합류"
            testID="invitation-accept-button"
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: !invPending ? ctaPressBg(pressed, colors) : colors.surface[2],
              borderRadius: radius.md,
              paddingVertical: space[3],
              alignItems: 'center',
            })}
          >
            <Body
              variant="sm-bold"
              color={invPending ? colors.text.tertiary : colors.text['on-brand']}
            >
              수락 · 합류
            </Body>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    const isInvitations = activeTab === 'invitations';
    const title = isInvitations
      ? '받은 모임 초대가 없어요'
      : activeTab === 'incoming'
        ? '받은 요청이 없어요'
        : '보낸 요청이 없어요';
    const subtitle = isInvitations
      ? '친구가 모임에 초대하면\n여기에서 바로 합류할 수 있어요.'
      : activeTab === 'incoming'
        ? '친구의 요청이 도착하면\n여기에서 바로 수락할 수 있어요.'
        : '친구를 검색해서 먼저 요청을 보내볼까요?';
    return (
      <View style={styles.emptyContainer} testID="requests-empty-state">
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.brand[50],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: space[4],
          }}
        >
          <Icon name={isInvitations ? '캘린더' : '추가'} color={colors.brand[500]} size={32} />
        </View>
        <Title level="h3" color={colors.text.primary} style={{ marginBottom: space[2] }}>
          {title}
        </Title>
        <Body
          variant="sm"
          color={colors.text.tertiary}
          style={{ textAlign: 'center', marginBottom: space[6] }}
        >
          {subtitle}
        </Body>
        {/* W2-10 — 막다른 빈 상태 탈출구(§11.2). 초대=모임 만들기 / 친구요청=친구 검색하기 */}
        {isInvitations ? (
          <Pressable
            onPress={() => router.push('/group/new')}
            accessibilityRole="button"
            accessibilityLabel="새 모임 만들기로 이동"
            style={({ pressed }) => [
              {
                backgroundColor: colors.brand[50],
                borderColor: colors.brand[300],
                borderWidth: 1,
                borderRadius: 9999,
                paddingHorizontal: space[5],
                paddingVertical: space[3],
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="empty-create-group-cta"
          >
            <Body variant="sm-bold" color={colors.brand[500]}>
              모임 만들기
            </Body>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/friends/search')}
            accessibilityRole="button"
            accessibilityLabel="친구 검색으로 이동"
            style={({ pressed }) => [
              {
                backgroundColor: colors.brand[50],
                borderColor: colors.brand[300],
                borderWidth: 1,
                borderRadius: 9999,
                paddingHorizontal: space[5],
                paddingVertical: space[3],
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="empty-search-cta"
          >
            <Body variant="sm-bold" color={colors.brand[500]}>
              친구 검색하기
            </Body>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface[0] }]}>
      <ScreenHeader title="요청함" onBack={() => router.back()} />

      {/* Tabs */}
      <View
        testID="requests-tabbar"
        onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
        style={[
          styles.tabContainer,
          {
            borderBottomWidth: 1,
            borderBottomColor: colors.border.subtle,
          },
        ]}
      >
        <Pressable
          onPress={() => setActiveTab('incoming')}
          accessibilityRole="tab"
          accessibilityLabel="받은 친구 요청 탭"
          accessibilityState={{ selected: activeTab === 'incoming' }}
          style={styles.tabButton}
          testID="incoming-tab"
        >
          <Body
            variant="sm-bold"
            color={activeTab === 'incoming' ? colors.text.primary : colors.text.tertiary}
            style={{ paddingBottom: space[3] }}
          >
            받은 요청
          </Body>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('outgoing')}
          accessibilityRole="tab"
          accessibilityLabel="보낸 친구 요청 탭"
          accessibilityState={{ selected: activeTab === 'outgoing' }}
          style={styles.tabButton}
          testID="outgoing-tab"
        >
          <Body
            variant="sm-bold"
            color={activeTab === 'outgoing' ? colors.text.primary : colors.text.tertiary}
            style={{ paddingBottom: space[3] }}
          >
            보낸 요청
          </Body>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('invitations')}
          accessibilityRole="tab"
          accessibilityLabel="모임 초대 탭"
          accessibilityState={{ selected: activeTab === 'invitations' }}
          style={styles.tabButton}
          testID="invitations-tab"
        >
          <Body
            variant="sm-bold"
            color={activeTab === 'invitations' ? colors.text.primary : colors.text.tertiary}
            style={{ paddingBottom: space[3] }}
          >
            모임 초대
          </Body>
        </Pressable>

        {/* 단일 슬라이딩 인디케이터 — 활성 탭 아래로 translateX (W3-5) */}
        {tabBarWidth > 0 ? (
          <Animated.View
            testID="tab-indicator"
            style={[
              styles.tabIndicator,
              {
                width: tabWidth,
                backgroundColor: colors.brand[500],
                transform: [{ translateX: indicatorX }],
              },
            ]}
          />
        ) : null}
      </View>

      {/* List — 첫 로딩=Skeleton, 로드 실패=EmptyState error(빈 상태 위장 아님) */}
      {loading ? (
        <View
          testID="requests-loading"
          style={{ paddingHorizontal: space[4], paddingTop: space[4] }}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={88} style={{ marginBottom: space[3] }} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          variant="error"
          title="불러오지 못했어요"
          body="잠시 후 다시 시도해볼게요."
          cta={{ label: messages.action.retry, onPress: fetchData }}
          testID="requests-error"
        />
      ) : activeTab === 'invitations' ? (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: space[4], paddingVertical: space[4], flexGrow: 1 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand[500]}
              colors={[colors.brand[500]]}
            />
          }
          renderItem={({ item }) => (
            <View style={{ marginBottom: space[3] }}>{renderInvitationCard({ item })}</View>
          )}
          ListEmptyComponent={renderEmptyState}
          testID="invitations-list"
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: space[4],
              paddingVertical: space[4],
              flexGrow: 1,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand[500]}
              colors={[colors.brand[500]]}
            />
          }
          renderItem={({ item }) => (
            <View style={{ marginBottom: space[3] }}>
              <FriendRequestCard
                request={item}
                type={activeTab === 'incoming' ? 'incoming' : 'outgoing'}
                onAccept={handleAccept}
                onReject={handleReject}
                onCancel={handleCancel}
                pending={pendingIds.includes(item.id)}
              />
            </View>
          )}
          ListEmptyComponent={renderEmptyState}
          testID="requests-list"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 12,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
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
});
