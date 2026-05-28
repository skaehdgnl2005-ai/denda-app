// S20 — 지도 없는 장소 검색·선택 (★게이트 임계경로, S10 디커플).
//
// Route: /group/[id]/place-search
//
// 흐름 (spec 진입 closure 2026-05-28: "확인 단계 거쳐 확정"):
//   1. 텍스트 검색 → useMapSearch (NaverSearchProvider + 400ms debounce + 5분 캐시 reuse).
//   2. 결과 카드 tap → Alert "이 장소로 정할까요?" 확인 단계 (오탭 방지 + Gate #1 신호 의도성).
//   3. 확정 → persistPlace (upsert by source+provider_place_id) → setConfirmedPlace (Gate #1 이벤트)
//      → router.replace(`/group/${id}/place?placeId=...`) (S08 PlaceActionSheet 으로 합류, Gate #2).
//   4. 취소 → Alert dismiss, 검색 화면 유지.
//
// S10 무접촉: NaverSearchProvider/useMapSearch 만 재사용, 지도탭/네이티브 MapView 일체 미참조.
// 한국어 only · DESIGN 토큰 · §17 anti-AI-feel (brand-500 fill CTA 0개 — 카드 tap = action).

import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { setConfirmedPlace } from '@/lib/groups/setConfirmedPlace';
import { persistPlace } from '@/lib/places/persist';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import { useMapSearch } from '@/lib/places/useMapSearch';

export default function PlaceSearchScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { colors, space, radius } = useTheme();
  const [inflight, setInflight] = useState(false);

  const { query, setQuery, results, isLoading, error } = useMapSearch();

  const handleResultPress = (result: PlaceSearchResult): void => {
    if (inflight) return;
    Alert.alert(`${result.name}으로 정할까요?`, result.address ?? result.category ?? '', [
      { text: '취소', style: 'cancel' },
      {
        text: '확정',
        style: 'default',
        onPress: () => {
          void commitPlace(result);
        },
      },
    ]);
  };

  const commitPlace = async (result: PlaceSearchResult): Promise<void> => {
    if (inflight) return;
    setInflight(true);
    try {
      const placeId = await persistPlace(result);
      await setConfirmedPlace(groupId, placeId);
      router.replace(`/group/${groupId}/place?placeId=${placeId}`);
    } catch (e) {
      Alert.alert('장소 확정 실패', (e as Error).message);
    } finally {
      setInflight(false);
    }
  };

  const trimmedQuery = query.trim();
  const showEmpty = trimmedQuery.length > 0 && !isLoading && results.length === 0 && error === null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <View style={[styles.topBar, { paddingHorizontal: space[4], paddingVertical: space[3] }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          testID="back-button"
          style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="뒤로" color={colors.text.primary} size={24} />
        </Pressable>
        <Title level="h2" color={colors.text.primary} style={styles.titleFlex}>
          장소 정하기
        </Title>
        <View style={styles.iconButton} />
      </View>

      <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface[2],
            borderRadius: radius.md,
            paddingHorizontal: space[3],
          }}
        >
          <Icon name="검색" color={colors.text.tertiary} size={20} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="식당 이름 또는 동네"
            placeholderTextColor={colors.text.disabled}
            testID="place-search-input"
            autoFocus
            returnKeyType="search"
            style={{
              flex: 1,
              marginLeft: space[2],
              paddingVertical: space[3],
              color: colors.text.primary,
              fontFamily: 'PretendardVariable',
              fontSize: 16,
            }}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={[styles.centered, { padding: space[4] }]} testID="place-search-loading">
          <Body color={colors.text.tertiary}>장소를 찾고 있어요...</Body>
        </View>
      ) : null}

      {error !== null ? (
        <View style={[styles.centered, { padding: space[4] }]}>
          <Body color={colors.semantic.error.fg}>{error}</Body>
        </View>
      ) : null}

      {showEmpty ? (
        <View style={[styles.centered, { padding: space[4] }]} testID="place-search-empty">
          <Icon name="장소" color={colors.text.tertiary} size={32} />
          <Title level="h3" color={colors.text.primary} style={{ marginTop: space[3] }}>
            결과가 없어요
          </Title>
          <Body color={colors.text.secondary} style={{ marginTop: space[1], textAlign: 'center' }}>
            다른 검색어로 다시 찾아볼까요?
          </Body>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.providerPlaceId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[6] }}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => handleResultPress(item)}
            disabled={inflight}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} 선택`}
            testID={`place-result-${index}`}
            style={({ pressed }) => ({
              backgroundColor: colors.surface[1],
              borderRadius: radius.md,
              padding: space[4],
              marginTop: space[2],
              borderWidth: 1,
              borderColor: colors.border.subtle,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Body variant="bold" color={colors.text.primary} numberOfLines={1}>
                  {item.name}
                </Body>
                {item.category !== null && item.category.length > 0 ? (
                  <Caption color={colors.text.tertiary} style={{ marginTop: space[1] }}>
                    {item.category}
                  </Caption>
                ) : null}
                {item.address !== null && item.address.length > 0 ? (
                  <Caption
                    color={colors.text.secondary}
                    style={{ marginTop: space[1] }}
                    numberOfLines={1}
                  >
                    {item.address}
                  </Caption>
                ) : null}
              </View>
              <Icon name="화살표" color={colors.text.tertiary} size={20} />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleFlex: { flex: 1, textAlign: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center' },
});
