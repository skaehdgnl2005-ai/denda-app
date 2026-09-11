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

import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Icon } from '@/components/Icon';
import { SearchField } from '@/components/SearchField';
import { MapHost } from '@/components/map/MapHost';
import { PartnerBadge } from '@/components/place/PartnerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { rowPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { toSearchScene } from '@/lib/map/mapScene';
import { isResultPartner } from '@/lib/places/partnership';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import { findResultByActionId, usePlaceConfirmAction } from '@/lib/places/usePlaceConfirmAction';
import { useMapSearch } from '@/lib/places/useMapSearch';

export default function PlaceSearchScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { colors, space, radius } = useTheme();

  const { query, setQuery, results, isLoading, error } = useMapSearch();
  const toast = useToast();
  const [pending, setPending] = useState<PlaceSearchResult | null>(null);

  const { confirm, inflight } = usePlaceConfirmAction(groupId, {
    onConfirmed: (placeId) => router.replace(`/group/${groupId}/place?placeId=${placeId}`),
    onError: (message) => {
      setPending(null);
      toast.show({ message, variant: 'error' });
    },
  });

  // 리스트 탭과 (점등 시) 마커 onPress가 호출하는 단일 확정 액션 — ConfirmSheet 확인 단계
  // (오탭 방지 + Gate #1 신호 의도성). 확정 commit은 usePlaceConfirmAction ref lock으로 1회.
  const requestConfirm = (result: PlaceSearchResult): void => {
    if (inflight) return;
    setPending(result);
  };

  const handleMarkerAction = (actionId: string): void => {
    const result = findResultByActionId(results, actionId);
    if (result) requestConfirm(result);
  };

  // 마커 강조도 리스트 배지와 같은 seam(isResultPartner)을 공유 — Phase 1+2 stub은 무강조.
  const searchScene = useMemo(
    () => toSearchScene(results, { isPartner: isResultPartner }),
    [results],
  );

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
            backgroundColor: rowPressBg(pressed, colors, colors.surface[1]),
            borderRadius: radius.md,
            padding: space[4],
            marginTop: space[2],
            borderWidth: 1,
            borderColor: colors.border.subtle,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              {/* ② 제휴 배지 — stub(isResultPartner) 뒤 시각 capability. Phase 1+2는 항상 false. */}
              {isResultPartner(item) ? (
                <View style={{ marginBottom: space[1] }}>
                  <PartnerBadge />
                </View>
              ) : null}
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
      <ScreenHeader title="장소 정하기" onBack={() => router.back()} />

      <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="식당 이름 또는 동네"
          accessibilityLabel="장소 검색 입력창"
          testID="place-search-input"
          autoFocus
        />
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

      {/* 장소 확정 확인 (Gate #1 신호) — 시스템 Alert 대신 ConfirmSheet */}
      <ConfirmSheet
        visible={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `${pending.name}, 여기로 정할까요?` : ''}
        message={pending?.address ?? pending?.category ?? undefined}
        confirmLabel="이곳으로 확정"
        cancelLabel="다음에 정할게요"
        loading={inflight}
        onConfirm={() => {
          if (pending) void confirm(pending);
        }}
        testID="place-confirm"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
});
