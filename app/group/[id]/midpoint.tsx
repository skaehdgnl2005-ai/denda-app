// S-MAP M3 — 멤버 중간지점 추천 화면 (Q-B23).
//
// Route: /group/[id]/midpoint
//
// 흐름:
//   1. 각 멤버 출발지를 OriginInput으로 추가 (자동완성 = 장소검색 재사용 + 최근 2개 칩).
//      출발지는 온디바이스 로컬 저장(recentOrigins, 서버 미전송 — PIPA 경량).
//   2. 2곳 이상 → computeMidpoint(중간지점). toMidpointScene으로 member/midpoint 마커 산출.
//   3. "중간지점 근처 장소" 검색(useMapSearch) → sortByDistanceTo로 중간점 가까운 순 정렬.
//   4. 추천 tap → Alert 확인 → usePlaceConfirmAction(M2 재사용)로 확정 → place 라우트(Gate #1·#2).
//
// M2 통일: 리스트 탭과 (점등 시) 지도 place 마커 onPress가 같은 requestConfirm으로 수렴.
// 네이티브 핀 렌더(중간점·출발지)는 EAS 운영 트랙 — 키 없이 MapHost fallback(리스트)로 검증.
// 한국어 only · DESIGN 토큰 · §17 anti-AI-feel (brand-500 fill 0 — tap이 action).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Icon } from '@/components/Icon';
import { MapHost } from '@/components/map/MapHost';
import { OriginInput } from '@/components/map/OriginInput';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import {
  computeMidpoint,
  sortByDistanceTo,
  toMidpointScene,
  type OriginPoint,
} from '@/lib/map/midpoint';
import type { MapMarker } from '@/lib/map/mapScene';
import { loadRecentOrigins, saveRecentOrigin } from '@/lib/map/recentOrigins';
import { recentOriginsStorage } from '@/lib/map/recentOriginsStorage';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import { findResultByActionId, usePlaceConfirmAction } from '@/lib/places/usePlaceConfirmAction';
import { useMapSearch } from '@/lib/places/useMapSearch';

export default function MidpointScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { colors, space, radius } = useTheme();

  const [origins, setOrigins] = useState<OriginPoint[]>([]);
  const [recents, setRecents] = useState<OriginPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadRecentOrigins(recentOriginsStorage)
      .then((loaded) => {
        if (!cancelled) setRecents(loaded);
      })
      .catch(() => {
        // 로컬 저장 로드 실패는 무시 (칩만 비어 보일 뿐 입력은 정상).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddOrigin = useCallback((origin: OriginPoint): void => {
    setOrigins((prev) => [...prev, origin]);
    saveRecentOrigin(recentOriginsStorage, origin)
      .then((merged) => setRecents(merged))
      .catch(() => {
        // 저장 실패해도 이번 세션 origins는 유지 (서버 미전송 best-effort).
      });
  }, []);

  const handleRemoveOrigin = useCallback((index: number): void => {
    setOrigins((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 중간지점은 출발지 2곳 이상일 때만 의미 있음.
  const midpoint = useMemo(
    () => (origins.length >= 2 ? computeMidpoint(origins.map((o) => o.coord)) : null),
    [origins],
  );

  // 추천 검색 (중간지점 근처). useMapSearch는 키워드 검색 → 중간점 가까운 순으로 재정렬.
  const { query, setQuery, results, isLoading, error } = useMapSearch();
  const recommended = useMemo(
    () => (midpoint !== null ? sortByDistanceTo(results, midpoint) : results),
    [results, midpoint],
  );

  // scene = member/midpoint 마커 + 추천 place 마커(actionId=providerPlaceId, 마커 onPress 통일용).
  const scene = useMemo(() => {
    const base = toMidpointScene(origins, midpoint);
    const placeMarkers: MapMarker[] = recommended.map((r) => ({
      id: r.providerPlaceId,
      coord: { lat: r.lat, lng: r.lng },
      kind: 'place',
      label: r.name,
      actionId: r.providerPlaceId,
    }));
    return { ...base, markers: [...base.markers, ...placeMarkers] };
  }, [origins, midpoint, recommended]);

  const toast = useToast();
  const [pending, setPending] = useState<PlaceSearchResult | null>(null);

  const { confirm, inflight } = usePlaceConfirmAction(groupId, {
    onConfirmed: (placeId) => router.replace(`/group/${groupId}/place?placeId=${placeId}`),
    onError: (message) => {
      setPending(null);
      toast.show({ message, variant: 'error' });
    },
  });

  const requestConfirm = useCallback(
    (result: PlaceSearchResult): void => {
      if (inflight) return;
      setPending(result);
    },
    [inflight],
  );

  const handleMarkerAction = useCallback(
    (actionId: string): void => {
      const result = findResultByActionId(recommended, actionId);
      if (result) requestConfirm(result);
    },
    [recommended, requestConfirm],
  );

  const trimmedQuery = query.trim();
  const showEmpty =
    midpoint !== null &&
    trimmedQuery.length > 0 &&
    !isLoading &&
    recommended.length === 0 &&
    error === null;

  const recoList = (
    <FlatList
      data={recommended}
      keyExtractor={(item) => item.providerPlaceId}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[6] }}
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => requestConfirm(item)}
          disabled={inflight}
          accessibilityRole="button"
          accessibilityLabel={`${item.name} 선택`}
          testID={`reco-result-${index}`}
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
      <ScreenHeader title="중간지점 찾기" onBack={() => router.back()} />

      <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
        <OriginInput recentOrigins={recents} onSelect={handleAddOrigin} />

        {origins.length > 0 ? (
          <View style={styles.chipRow}>
            {origins.map((origin, index) => (
              <Pressable
                key={`origin-${index}`}
                onPress={() => handleRemoveOrigin(index)}
                accessibilityRole="button"
                accessibilityLabel={`${origin.label} 출발지 빼기`}
                testID={`origin-added-${index}`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.brand[50],
                  borderRadius: radius.pill,
                  paddingHorizontal: space[3],
                  paddingVertical: space[2],
                  marginRight: space[2],
                  marginTop: space[2],
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Caption color={colors.brand[600]}>{origin.label}</Caption>
                <Icon name="닫기" color={colors.brand[600]} size={14} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {midpoint !== null ? (
          <View testID="midpoint-summary" style={{ marginTop: space[3] }}>
            <Caption color={colors.text.secondary}>
              중간지점을 찾았어요 · 근처에서 만날 장소를 추천해드릴게요
            </Caption>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface[2],
                borderRadius: radius.md,
                paddingHorizontal: space[3],
                marginTop: space[2],
              }}
            >
              <Icon name="검색" color={colors.text.tertiary} size={20} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="중간지점 근처 장소 (식당·카페)"
                placeholderTextColor={colors.text.disabled}
                testID="reco-search-input"
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
        ) : (
          <Caption color={colors.text.tertiary} style={{ marginTop: space[3] }}>
            출발지를 2곳 이상 넣으면 중간지점을 찾아드려요
          </Caption>
        )}
      </View>

      {isLoading ? (
        <View style={[styles.centered, { padding: space[4] }]} testID="reco-loading">
          <Body color={colors.text.tertiary}>장소를 찾고 있어요...</Body>
        </View>
      ) : null}

      {error !== null ? (
        <View style={[styles.centered, { padding: space[4] }]}>
          <Body color={colors.semantic.error.fg}>{error}</Body>
        </View>
      ) : null}

      {showEmpty ? (
        <View style={[styles.centered, { padding: space[4] }]} testID="reco-empty">
          <Icon name="장소" color={colors.text.tertiary} size={32} />
          <Body color={colors.text.secondary} style={{ marginTop: space[2], textAlign: 'center' }}>
            다른 검색어로 다시 찾아볼까요?
          </Body>
        </View>
      ) : null}

      {/* 점등 전: fallback(추천 리스트). 점등 시: place 마커 onPress → handleMarkerAction(리스트와 동일). */}
      <MapHost scene={scene} onMarkerPress={handleMarkerAction} fallback={recoList} />

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
        testID="mid-confirm"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  centered: { alignItems: 'center', justifyContent: 'center' },
});
