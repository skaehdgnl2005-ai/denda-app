import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { rowPressBg } from '@/design/press';
import { Body, Caption, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchField } from '@/components/SearchField';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { FriendUser, friendsApi } from '@/lib/friends/api';
import { mapError, messages } from '@/lib/i18n/messages';
import { useKakaoInvite } from '@/lib/share/useKakaoInvite';

export default function FriendsSearchScreen() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const { show: showToast } = useToast();
  const handleInvite = useKakaoInvite();

  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [results, setResults] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  // W2-10 — pull-to-refresh는 loading(스켈레톤 전체 교체)과 분리. 목록을 유지한 채 재검색.
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sentUserIds, setSentUserIds] = useState<string[]>([]);

  // Debounce search query input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // 검색 실행 본체 — refresh=true면 스켈레톤(loading) 대신 refreshing으로 목록 유지 재검색.
  const runSearch = useCallback(
    async (refresh = false) => {
      const trimmed = debouncedQuery.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }
      const setBusy = refresh ? setRefreshing : setLoading;
      setBusy(true);
      try {
        const searchResults = await friendsApi.search(trimmed);
        setResults(searchResults);
      } catch (e) {
        console.error(e);
        const { silent, message } = mapError(e);
        if (!silent) showToast({ message, variant: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [debouncedQuery, showToast],
  );

  // Execute search when debounced query changes
  useEffect(() => {
    // 빈 검색어일 때 결과 초기화(setResults) 동기 호출은 의도 — 디바운스 후 1회
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch();
  }, [runSearch]);

  const onRefresh = useCallback(() => runSearch(true), [runSearch]);

  // W2-10 — in-flight 잠금: 응답 전 더블탭이 sendRequest를 2번 호출하지 않도록 가드.
  const sendingRef = useRef<Set<string>>(new Set());
  const handleSendRequest = async (userId: string) => {
    if (sendingRef.current.has(userId) || sentUserIds.includes(userId)) return;
    sendingRef.current.add(userId);
    try {
      await friendsApi.sendRequest(userId);
      setSentUserIds((prev) => [...prev, userId]);
      showToast({ message: messages.success.requestSent, variant: 'success' });
    } catch (e) {
      console.error(e);
      const { silent, message } = mapError(e);
      if (!silent) showToast({ message, variant: 'error' });
    } finally {
      sendingRef.current.delete(userId);
    }
  };

  const renderResultItem = ({ item }: { item: FriendUser }) => {
    const initial = item.nickname.charAt(0);
    const isSent = sentUserIds.includes(item.id);

    return (
      <View
        style={[
          styles.resultCard,
          {
            borderColor: colors.border.subtle,
            borderRadius: radius.lg,
            padding: space[4],
            backgroundColor: colors.surface[1],
            marginBottom: space[3],
          },
        ]}
        testID="search-result-card"
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
        >
          <Body variant="bold" color={colors.text.secondary}>
            {initial}
          </Body>
        </View>

        {/* Info */}
        <Body variant="bold" color={colors.text.primary} style={styles.nickname}>
          {item.nickname}
        </Body>

        {/* Action Button — §17.1 ghost outline (반복 brand-500 fill 방지) */}
        <Pressable
          onPress={() => !isSent && handleSendRequest(item.id)}
          disabled={isSent}
          accessibilityRole="button"
          accessibilityLabel={isSent ? '친구 요청 보냄' : `${item.nickname}님께 친구 요청 보내기`}
          // 버튼 시각 높이 ~36pt → 44pt 터치 타깃 위해 hitSlop 보정 (W3-3, §12.1)
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.requestButton,
            {
              backgroundColor: isSent ? colors.surface[3] : colors.brand[50],
              borderColor: isSent ? colors.border.subtle : colors.brand[300],
              borderWidth: 1,
              borderRadius: radius.pill,
              paddingVertical: space[2],
              paddingHorizontal: space[4],
              opacity: pressed && !isSent ? 0.7 : 1,
            },
          ]}
          testID="send-request-button"
        >
          <Body variant="sm-bold" color={isSent ? colors.text.disabled : colors.brand[500]}>
            {isSent ? '요청 보냄' : '친구 요청'}
          </Body>
        </Pressable>
      </View>
    );
  };

  // 검색 결과 빈 상태 (검색어 입력 후 결과 없음)
  const renderNoResults = () => (
    <View style={styles.emptyContainer} testID="search-empty-state">
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surface[2],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space[3],
        }}
      >
        <Icon name="검색" color={colors.text.secondary} size={26} />
      </View>
      <Title level="h3" color={colors.text.primary} style={{ marginBottom: space[2] }}>
        검색 결과가 없어요
      </Title>
      <Body
        variant="sm"
        color={colors.text.tertiary}
        style={{ textAlign: 'center', paddingHorizontal: space[6] }}
      >
        닉네임을 다시 확인하거나{'\n'}카톡 친구를 초대해보세요.
      </Body>
      {/* W2-10 — 막다른 빈 상태 탈출구: §11.2 3요소 완성용 CTA */}
      <Pressable
        onPress={handleInvite}
        accessibilityRole="button"
        accessibilityLabel="카카오톡으로 친구 초대"
        testID="search-empty-invite"
        style={({ pressed }) => ({
          marginTop: space[4],
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: pressed ? colors.surface[3] : colors.surface[2],
          borderColor: colors.border.subtle,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        })}
      >
        <Icon name="카톡 공유" color={colors.text.secondary} size={18} />
        <Body variant="sm-bold" color={colors.text.primary} style={{ marginLeft: space[2] }}>
          카톡으로 초대
        </Body>
      </Pressable>
    </View>
  );

  // 검색어 없을 때 — 친구 초대 entry point 제공 (피드백 P1 7)
  const renderInitialEmptyState = () => (
    <View
      style={[styles.initialEmpty, { paddingHorizontal: space[4] }]}
      testID="search-initial-state"
    >
      <Caption
        variant="micro"
        color={colors.text.tertiary}
        style={{ marginBottom: space[3], letterSpacing: 0.2 }}
      >
        친구를 더 빠르게 찾는 방법
      </Caption>
      <Pressable
        onPress={handleInvite}
        accessibilityRole="button"
        accessibilityLabel="카카오톡으로 친구 초대"
        style={({ pressed }) => ({
          backgroundColor: rowPressBg(pressed, colors, colors.surface[2]),
          borderColor: colors.border.subtle,
          borderWidth: 1,
          borderRadius: radius.lg,
          paddingHorizontal: space[4],
          paddingVertical: space[4],
          flexDirection: 'row',
          alignItems: 'center',
        })}
        testID="kakao-invite-card"
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface[3],
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: space[3],
          }}
        >
          <Icon name="카톡 공유" color={colors.text.secondary} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Body variant="bold" color={colors.text.primary}>
            카톡으로 친구 초대
          </Body>
          <Caption
            variant="default"
            color={colors.text.tertiary}
            style={{ marginTop: space['0.5'] }}
          >
            카카오톡 친구에게 초대 링크를 보내요.
          </Caption>
        </View>
        <Icon name="화살표" color={colors.text.tertiary} size={20} />
      </Pressable>

      <Caption
        variant="default"
        color={colors.text.tertiary}
        style={{ marginTop: space[6], textAlign: 'center', lineHeight: 20 }}
      >
        닉네임을 알고 있다면{'\n'}위 검색창에 입력해요.
      </Caption>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface[0] }]}>
      <ScreenHeader title="친구 검색" onBack={() => router.back()} />

      {/* Input Section */}
      <View
        style={[styles.inputContainer, { paddingHorizontal: space[4], paddingBottom: space[3] }]}
      >
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="친구 닉네임을 입력해요"
          accessibilityLabel="친구 닉네임 검색 입력창"
          testID="search-input-field"
        />
      </View>

      {/* Results Section — 로딩=Skeleton(§11.1 스피너 스펙 준수) */}
      {loading ? (
        <View testID="search-loading" style={{ paddingHorizontal: space[4], paddingTop: space[2] }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} style={{ marginBottom: space[3] }} />
          ))}
        </View>
      ) : debouncedQuery.trim() ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResultItem}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: space[4],
              paddingVertical: space[2],
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
          ListEmptyComponent={renderNoResults}
          testID="search-results-list"
        />
      ) : (
        renderInitialEmptyState()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  inputContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 44,
  },
  searchIconWrapper: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontFamily: 'PretendardVariable',
  },
  listContent: {
    paddingBottom: 24,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nickname: {
    flex: 1,
    marginLeft: 12,
  },
  requestButton: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 36,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  initialEmpty: {
    paddingTop: 24,
  },
});
