// S20 — 지도 없는 장소 검색·선택 (★게이트 임계경로, S10 디커플).
// S-MAP M2 — 검색→장소 확정 단일 액션(Gate #2 정확도) + 마커 actionId 통일.
//
// Route: /group/[id]/place-search
//
// 흐름 (spec 진입 closure 2026-05-28: "확인 단계 거쳐 확정"):
//   1. 텍스트 검색 → useMapSearch (NaverSearchProvider + 400ms debounce + 5분 캐시 reuse).
//   2. 결과 카드 tap → Alert "이 장소로 정할까요?" 확인 단계 (오탭 방지 + Gate #1 신호 의도성).
//   3. 확정 → usePlaceConfirmAction.confirm (persist → setConfirmedPlace[Gate #1] → place 라우트, Gate #2).
//   4. 취소 → Alert dismiss, 검색 화면 유지.
//
// M2 통일: 리스트 카드 탭과 (점등 시) 지도 마커 onPress가 같은 requestConfirm으로 수렴한다
//   (toSearchScene → MapHost onMarkerPress → findResultByActionId → requestConfirm). 점등 전엔
//   MapHost가 리스트(fallback)를 그대로 렌더 → isMapAvailable=false라 코드 변경 0으로 점등.
// 더블탭 idempotency: 확정 commit은 usePlaceConfirmAction의 ref 동기 lock으로 정확히 1회.
//
// S10 무접촉: NaverSearchProvider/useMapSearch 만 재사용. 한국어 only · DESIGN 토큰 ·
// §17 anti-AI-feel (brand-500 fill CTA 0개 — 카드 tap = action).

import React, { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { MapHost } from '@/components/map/MapHost';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { toSearchScene } from '@/lib/map/mapScene';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import { findResultByActionId, usePlaceConfirmAction } from '@/lib/places/usePlaceConfirmAction';
import { useMapSearch } from '@/lib/places/useMapSearch';

export default function PlaceSearchScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { colors, space, radius } = useTheme();

  const { query, setQuery, results, isLoading, error } = useMapSearch();

  const { confirm, inflight } = usePlaceConfirmAction(groupId, {
    onConfirmed: (placeId) => router.replace(`/group/${groupId}/place?placeId=${placeId}`),
    onError: (message) => Alert.alert('장소 확정 실패', message),
  });

  // 리스트 탭과 (점등 시) 마커 onPress가 호출하는 단일 확정 액션 (Alert 확인 → idempotent commit).
  const requestConfirm = (result: PlaceSearchResult): void => {
    if (inflight) return;
    Alert.alert(`${result.name}으로 정할까요?`, result.address ?? result.category ?? '', [
      { text: '취소', style: 'cancel' },
      {
        text: '확정',
        style: 'default',
        onPress: () => {
          void confirm(result);
        },
      },
    ]);
  };

  const handleMarkerAction = (actionId: string): void => {
    const result = findResultByActionId(results, actionId);
    if (result) requestConfirm(result);
  };

  const searchScene = useMemo(() => toSearchScene(results), [results]);

  const trimmedQuery = query.trim();
  const showEmpty = trimmedQuery.length > 0 && !isLoading && results.length === 0 && error === null;

  const resultsList = (
    <FlatList
      data={results}
      keyExtractor={(item) => item.providerPlaceId}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[6] }}
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => requestConfirm(item)}
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
  );

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

      {/* 점등 전: fallback(리스트). 점등 시: 마커 onPress → handleMarkerAction → requestConfirm (리스트와 동일). */}
      <MapHost scene={searchScene} onMarkerPress={handleMarkerAction} fallback={resultsList} />
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
