import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { FriendRequestCard } from '@/components/friends/FriendRequestCard';
import { FriendRequest, friendsApi } from '@/lib/friends/api';
import { invitationsApi, type GroupInvitation } from '@/lib/groups/invitations';

type RequestTab = 'incoming' | 'outgoing' | 'invitations';

export default function FriendsRequestsScreen() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<RequestTab>('incoming');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'incoming') {
        const incoming = await friendsApi.listIncomingRequests();
        setRequests(incoming);
      } else if (activeTab === 'outgoing') {
        const outgoing = await friendsApi.listOutgoingRequests();
        setRequests(outgoing);
      } else {
        const list = await invitationsApi.listMyInvitations();
        setInvitations(list);
      }
    } catch (e) {
      console.error(e);
      Alert.alert(
        '오류',
        activeTab === 'invitations'
          ? '모임 초대를 불러오지 못했습니다.'
          : '요청 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    // 데이터 fetch trigger — fetchData 내부 setLoading 호출은 의도
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleAccept = async (req: FriendRequest) => {
    try {
      // S23: sender_id 전달 → F2 push 대상 식별 (수락된 사실을 원래 요청 보낸 사람에게 알림)
      await friendsApi.acceptRequest(req.id, req.sender_id);
      Alert.alert('알림', '친구 요청을 수락했습니다.');
      fetchData();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '요청 수락에 실패했습니다.');
    }
  };

  const handleReject = async (req: FriendRequest) => {
    try {
      await friendsApi.rejectRequest(req.id);
      Alert.alert('알림', '친구 요청을 거절했습니다.');
      fetchData();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '요청 거절에 실패했습니다.');
    }
  };

  const handleCancel = async (req: FriendRequest) => {
    try {
      await friendsApi.cancelRequest(req.id);
      Alert.alert('알림', '보낸 친구 요청을 취소했습니다.');
      fetchData();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '요청 취소에 실패했습니다.');
    }
  };

  // S22: 모임 초대 수락/거절. 수락 시 RPC 가 group_members INSERT + status UPDATE atomic 처리.
  const handleInvitationAccept = async (inv: GroupInvitation) => {
    try {
      const { groupId } = await invitationsApi.acceptInvitation(inv.id);
      Alert.alert('합류 완료', '모임에 합류했어요!');
      router.push(`/group/${groupId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : '수락하지 못했어요.';
      Alert.alert('오류', message);
    }
  };

  const handleInvitationReject = async (inv: GroupInvitation) => {
    try {
      await invitationsApi.rejectInvitation(inv.id);
      Alert.alert('알림', '모임 초대를 거절했어요.');
      fetchData();
    } catch (e) {
      const message = e instanceof Error ? e.message : '거절하지 못했어요.';
      Alert.alert('오류', message);
    }
  };

  const renderInvitationCard = ({ item }: { item: GroupInvitation }) => (
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
          accessibilityRole="button"
          accessibilityLabel="모임 초대 거절"
          testID="invitation-reject-button"
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: colors.surface[2],
            borderRadius: radius.md,
            paddingVertical: space[3],
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Body variant="sm-bold" color={colors.text.secondary}>
            거절
          </Body>
        </Pressable>
        <Pressable
          onPress={() => handleInvitationAccept(item)}
          accessibilityRole="button"
          accessibilityLabel="모임 초대 수락 + 합류"
          testID="invitation-accept-button"
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: colors.brand[500],
            borderRadius: radius.md,
            paddingVertical: space[3],
            alignItems: 'center',
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <Body variant="sm-bold" color={colors.text['on-brand']}>
            수락 · 합류
          </Body>
        </Pressable>
      </View>
    </View>
  );

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
        {activeTab === 'outgoing' ? (
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
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface[0] }]}>
      {/* Custom Header */}
      <View style={[styles.header, { paddingHorizontal: space[4], paddingVertical: space[3] }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="이전 화면으로 돌아가기"
          style={styles.backButton}
          testID="requests-back-button"
        >
          <Icon name="뒤로" color={colors.text.primary} size={24} />
        </Pressable>
        <Title level="h2" color={colors.text.primary} style={styles.headerTitle}>
          요청함
        </Title>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {/* Tabs */}
      <View
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
          {activeTab === 'incoming' && (
            <View style={[styles.tabIndicator, { backgroundColor: colors.brand[500] }]} />
          )}
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
          {activeTab === 'outgoing' && (
            <View style={[styles.tabIndicator, { backgroundColor: colors.brand[500] }]} />
          )}
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
          {activeTab === 'invitations' && (
            <View style={[styles.tabIndicator, { backgroundColor: colors.brand[500] }]} />
          )}
        </Pressable>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer} testID="requests-loading-indicator">
          <ActivityIndicator color={colors.brand[500]} size="large" />
        </View>
      ) : activeTab === 'invitations' ? (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: space[4], paddingVertical: space[4], flexGrow: 1 },
          ]}
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
          renderItem={({ item }) => (
            <View style={{ marginBottom: space[3] }}>
              <FriendRequestCard
                request={item}
                type={activeTab === 'incoming' ? 'incoming' : 'outgoing'}
                onAccept={handleAccept}
                onReject={handleReject}
                onCancel={handleCancel}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  backButtonPlaceholder: {
    width: 44,
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
    right: 0,
    height: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
