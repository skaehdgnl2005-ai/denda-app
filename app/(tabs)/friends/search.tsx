import React, { useEffect, useState, useRef } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { FriendUser, friendsApi } from '@/lib/friends/api';

export default function FriendsSearchScreen() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [results, setResults] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
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

  // Execute search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      const trimmed = debouncedQuery.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const searchResults = await friendsApi.search(trimmed);
        setResults(searchResults);
      } catch (e) {
        console.error(e);
        Alert.alert('오류', '검색에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const handleSendRequest = async (userId: string) => {
    try {
      await friendsApi.sendRequest(userId);
      setSentUserIds((prev) => [...prev, userId]);
      Alert.alert('알림', '친구 요청을 보냈습니다.');
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '친구 요청을 보내지 못했습니다.');
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
            borderRadius: radius.md,
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
          <Body variant="bold" color={colors.text.primary}>
            {initial}
          </Body>
        </View>

        {/* Info */}
        <Body variant="bold" color={colors.text.primary} style={styles.nickname}>
          {item.nickname}
        </Body>

        {/* Action Button */}
        <Pressable
          onPress={() => !isSent && handleSendRequest(item.id)}
          disabled={isSent}
          accessibilityRole="button"
          accessibilityLabel={isSent ? '친구 요청 보냄' : `${item.nickname}님께 친구 요청 보내기`}
          style={({ pressed }) => [
            styles.requestButton,
            {
              backgroundColor: isSent ? colors.surface[3] : colors.brand[500],
              borderRadius: radius.md,
              paddingVertical: space[2],
              paddingHorizontal: space[3],
              opacity: pressed && !isSent ? 0.8 : 1,
            },
          ]}
          testID="send-request-button"
        >
          <Body
            variant="sm-bold"
            color={isSent ? colors.text.disabled : colors.text['on-brand']}
          >
            {isSent ? '요청 보냄' : '친구 요청'}
          </Body>
        </Pressable>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer} testID="search-empty-state">
      <Icon name="검색" color={colors.text.disabled} size={48} />
      <Title level="h3" color={colors.text.primary} style={{ marginTop: space[4], marginBottom: space[2] }}>
        검색 결과가 없습니다
      </Title>
      <Body variant="sm" color={colors.text.secondary}>
        다른 닉네임으로 검색해 보세요.
      </Body>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface[0] }]}>
      {/* Top Header */}
      <View style={[styles.header, { paddingHorizontal: space[4], paddingVertical: space[3] }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="이전 화면으로 돌아가기"
          style={styles.backButton}
          testID="search-back-button"
        >
          <Icon name="뒤로" color={colors.text.primary} size={24} />
        </Pressable>
        <Title level="h2" color={colors.text.primary} style={styles.headerTitle}>
          친구 검색
        </Title>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {/* Input Section */}
      <View style={[styles.inputContainer, { paddingHorizontal: space[4], paddingBottom: space[3] }]}>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.surface[2],
              borderRadius: radius.md,
              borderColor: colors.border.strong,
            },
          ]}
        >
          <View style={[styles.searchIconWrapper, { marginLeft: space[3] }]}>
            <Icon name="검색" color={colors.text.secondary} size={20} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="닉네임으로 검색"
            placeholderTextColor={colors.text.disabled}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.text.primary, paddingRight: space[3] }]}
            accessibilityLabel="친구 닉네임 검색 입력창"
            testID="search-input-field"
          />
        </View>
      </View>

      {/* Results Section */}
      {loading ? (
        <View style={styles.loadingContainer} testID="search-loading-indicator">
          <ActivityIndicator color={colors.brand[500]} size="large" />
        </View>
      ) : (
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
          ListEmptyComponent={debouncedQuery.trim() ? renderEmptyState : null}
          testID="search-results-list"
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
});
