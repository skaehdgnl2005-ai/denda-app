import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { FriendRequestCard } from '@/components/friends/FriendRequestCard';
import { FriendRequest, friendsApi } from '@/lib/friends/api';

type RequestTab = 'incoming' | 'outgoing';

export default function FriendsRequestsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<RequestTab>('incoming');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'incoming') {
        const incoming = await friendsApi.listIncomingRequests();
        setRequests(incoming);
      } else {
        const outgoing = await friendsApi.listOutgoingRequests();
        setRequests(outgoing);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '요청 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    // 데이터 fetch trigger — fetchRequests 내부 setLoading 호출은 의도
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, [fetchRequests]);

  const handleAccept = async (req: FriendRequest) => {
    try {
      await friendsApi.acceptRequest(req.id);
      Alert.alert('알림', '친구 요청을 수락했습니다.');
      fetchRequests();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '요청 수락에 실패했습니다.');
    }
  };

  const handleReject = async (req: FriendRequest) => {
    try {
      await friendsApi.rejectRequest(req.id);
      Alert.alert('알림', '친구 요청을 거절했습니다.');
      fetchRequests();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '요청 거절에 실패했습니다.');
    }
  };

  const handleCancel = async (req: FriendRequest) => {
    try {
      await friendsApi.cancelRequest(req.id);
      Alert.alert('알림', '보낸 친구 요청을 취소했습니다.');
      fetchRequests();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '요청 취소에 실패했습니다.');
    }
  };

  const renderEmptyState = () => (
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
        <Icon name="추가" color={colors.brand[500]} size={32} />
      </View>
      <Title level="h3" color={colors.text.primary} style={{ marginBottom: space[2] }}>
        {activeTab === 'incoming' ? '받은 요청이 없어요' : '보낸 요청이 없어요'}
      </Title>
      <Body
        variant="sm"
        color={colors.text.tertiary}
        style={{ textAlign: 'center', marginBottom: space[6] }}
      >
        {activeTab === 'incoming'
          ? '친구의 요청이 도착하면\n여기에서 바로 수락할 수 있어요.'
          : '친구를 검색해서 먼저 요청을 보내볼까요?'}
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
          친구 요청
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
          accessibilityLabel="받은 요청 탭"
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
          accessibilityLabel="보낸 요청 탭"
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
      </View>

      {/* Requests List */}
      {loading ? (
        <View style={styles.loadingContainer} testID="requests-loading-indicator">
          <ActivityIndicator color={colors.brand[500]} size="large" />
        </View>
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
                type={activeTab}
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
