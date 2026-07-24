// S-MAP M5 — 멤버 중간지점 추천 화면 (Q-B23, D41).
//
// Route: /group/[id]/midpoint
//
// 흐름:
//   1. 모임 출발지는 서버(group_origins, D41)에 저장 — 멤버 각자 본인 행만 쓰기, 타인 행은
//      읽기 전용으로 focus 시 갱신되는 진행 표시("n/m명 입력", Realtime 아님 — v1 제외 D41/스펙 §0).
//      최근 검색 칩(recentOrigins)만 온디바이스.
//   2. 2곳 이상 → computeMidpoint(중간지점). toMidpointScene으로 member/midpoint 마커 산출.
//   3. "중간지점 근처 장소" 검색(useMapSearch) → sortByDistanceTo로 중간점 가까운 순 정렬.
//   4. 추천 tap → Alert 확인 → usePlaceConfirmAction(M2 재사용)로 확정 → place 라우트(Gate #1·#2).
//
// M2 통일: 리스트 탭과 (점등 시) 지도 place 마커 onPress가 같은 requestConfirm으로 수렴.
// 네이티브 핀 렌더(중간점·출발지)는 EAS 운영 트랙 — 키 없이 MapHost fallback(리스트)로 검증.
// 한국어 only · DESIGN 토큰 · §17 anti-AI-feel (brand-500 fill 0 — tap이 action).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Icon } from '@/components/Icon';
import { MapHost } from '@/components/map/MapHost';
import { OriginInput } from '@/components/map/OriginInput';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { rowPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import { useAuth } from '@/lib/auth/setup';
import { fetchGroupForConfirm } from '@/lib/groups/queries';
import {
  deleteMyOrigin,
  fetchGroupOrigins,
  upsertMyOrigin,
  type GroupOrigin,
} from '@/lib/map/groupOrigins';
import {
  computeMidpoint,
  sortByDistanceTo,
  toMidpointScene,
  type OriginPoint,
} from '@/lib/map/midpoint';
import type { MapMarker } from '@/lib/map/mapScene';
import { loadRecentOrigins, saveRecentOrigin } from '@/lib/map/recentOrigins';
import { recentOriginsStorage } from '@/lib/map/recentOriginsStorage';
import {
  buildAutoQuery,
  RECOMMEND_CATEGORIES,
  type RecommendCategory,
} from '@/lib/map/autoRecommend';
import { nearestStation } from '@/lib/map/stationSnap';
import { SUBWAY_STATIONS } from '@/lib/map/stations.data';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import { findResultByActionId, usePlaceConfirmAction } from '@/lib/places/usePlaceConfirmAction';
import { useMapSearch } from '@/lib/places/useMapSearch';

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

export default function MidpointScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { colors, space, radius } = useTheme();
  const toast = useToast();

  const userId = useAuth((s) => s.session?.user.id);
  const [origins, setOrigins] = useState<GroupOrigin[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // focus 직후 fetch가 in-flight일 때 upsert/delete 후 refetch와 경합하면, 먼저 시작된 느린
  // fetch가 뒤늦게 resolve되며 최신 상태를 덮어쓸 수 있다 → 최신 load만 state 반영.
  const loadSeqRef = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    if (!groupId) return; // params 미착지 — 빈 id로 서버 조회 방지 (렌더는 아래 가드 화면)
    const seq = ++loadSeqRef.current;
    try {
      const [fetched, group] = await Promise.all([
        fetchGroupOrigins(groupId),
        fetchGroupForConfirm(groupId),
      ]);
      if (seq !== loadSeqRef.current) return; // 최신 load만 반영 (연속 등록 경합 방지)
      setOrigins(fetched);
      setMemberCount(group.memberCount);
      setLoadError(null);
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      setLoadError(
        e instanceof Error ? e.message : '출발지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
      );
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // 콜드스타트/딥링크 직후 세션 hydration 전엔 userId가 undefined —
  // 조용한 무시는 "고장"으로 읽히므로 안내 토스트로 피드백 (조용한 실패 금지).
  const notifySessionPending = useCallback((): void => {
    toast.show({
      message: '로그인 정보를 확인하는 중이에요. 잠시 후 다시 시도해주세요.',
      variant: 'error',
    });
  }, [toast]);

  const handleAddOrigin = useCallback(
    (origin: OriginPoint): void => {
      if (userId === undefined) {
        notifySessionPending();
        return;
      }
      upsertMyOrigin(groupId, userId, origin)
        .then(() => load())
        .catch((e: unknown) => {
          toast.show({
            message:
              e instanceof Error
                ? e.message
                : '출발지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.',
            variant: 'error',
          });
        });
      saveRecentOrigin(recentOriginsStorage, origin)
        .then((merged) => setRecents(merged))
        .catch(() => {
          // 온디바이스 칩 best-effort (Q-B23 유지 부분)
        });
    },
    [groupId, userId, load, toast, notifySessionPending],
  );

  const handleRemoveMine = useCallback((): void => {
    if (userId === undefined) {
      notifySessionPending();
      return;
    }
    deleteMyOrigin(groupId, userId)
      .then(() => load())
      .catch((e: unknown) => {
        toast.show({
          message:
            e instanceof Error
              ? e.message
              : '출발지를 삭제하지 못했어요. 잠시 후 다시 시도해주세요.',
          variant: 'error',
        });
      });
  }, [groupId, userId, load, toast, notifySessionPending]);

  // 중간점·scene은 서버 origins 기반 (OriginPoint shape로 매핑)
  const originPoints = useMemo<OriginPoint[]>(
    () => origins.map((o) => ({ label: o.label, coord: o.coord })),
    [origins],
  );
  const midpoint = useMemo(
    () => (originPoints.length >= 2 ? computeMidpoint(originPoints.map((o) => o.coord)) : null),
    [originPoints],
  );

  // 최근접 역 스냅(3km 초과·목록 빔 → null) → 역 카드 + 카테고리 칩 자동 추천(검색 0타).
  const snap = useMemo(
    () => (midpoint !== null ? nearestStation(midpoint, SUBWAY_STATIONS) : null),
    [midpoint],
  );
  // category !== null = 자동 추천 모드. 수동 입력 시 null(자동 재발사 중단).
  const [category, setCategory] = useState<RecommendCategory | null>(RECOMMEND_CATEGORIES[0]);

  // 추천 검색 (중간지점 근처). useMapSearch는 키워드 검색 → 중간점 가까운 순으로 재정렬.
  const { query, setQuery, results, isLoading, error, retry } = useMapSearch();

  useEffect(() => {
    if (snap !== null && category !== null) {
      setQuery(buildAutoQuery(snap.name, category));
    }
  }, [snap, category, setQuery]);

  // 추천 정렬·마커·씬의 중심 = 역(스냅 시) 또는 산술 중점.
  const recoCenter = snap !== null ? snap.coord : midpoint;
  const recommended = useMemo(
    () => (recoCenter !== null ? sortByDistanceTo(results, recoCenter) : results),
    [results, recoCenter],
  );

  // scene = member/midpoint 마커 + 추천 place 마커(actionId=providerPlaceId, 마커 onPress 통일용).
  const scene = useMemo(() => {
    const base = toMidpointScene(originPoints, recoCenter, snap !== null ? snap.name : '중간지점');
    const placeMarkers: MapMarker[] = recommended.map((r) => ({
      id: r.providerPlaceId,
      coord: { lat: r.lat, lng: r.lng },
      kind: 'place',
      label: r.name,
      actionId: r.providerPlaceId,
    }));
    return { ...base, markers: [...base.markers, ...placeMarkers] };
  }, [originPoints, recoCenter, snap, recommended]);

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

  // 딥링크가 params 없이 착지하면 groupId가 '' — index.tsx와 동일 가드 (빈 id로 fetch 방지).
  if (!groupId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
        <View style={[styles.centered, { padding: space[4] }]}>
          <Body color={colors.text.secondary}>모임 ID가 없어요.</Body>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <ScreenHeader title="중간지점 찾기" onBack={() => router.back()} />

      <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
        <OriginInput recentOrigins={recents} onSelect={handleAddOrigin} />

        {/* D41: 진행 표시 + 출발지 목록 (본인 행만 삭제 가능, 타인 읽기 전용) */}
        {memberCount > 0 ? (
          <Caption
            color={colors.text.secondary}
            style={{ marginTop: space[2] }}
            testID="origin-progress"
          >
            {origins.length}/{memberCount}명 입력
          </Caption>
        ) : null}

        {loadError !== null ? (
          <Pressable
            onPress={() => void load()}
            accessibilityRole="button"
            accessibilityLabel="출발지 다시 불러오기"
            testID="origins-error-retry"
            style={({ pressed }) => ({
              backgroundColor: rowPressBg(pressed, colors, colors.surface[1]),
              borderRadius: radius.md,
              padding: space[3],
              marginTop: space[2],
            })}
          >
            <Caption color={colors.semantic.error.fg}>{loadError} (탭해서 다시 시도)</Caption>
          </Pressable>
        ) : null}

        {origins.map((origin, index) =>
          origin.userId === userId ? (
            <Pressable
              key={origin.userId}
              onPress={handleRemoveMine}
              accessibilityRole="button"
              accessibilityLabel={`내 출발지 ${origin.label} 빼기`}
              testID="my-origin-remove"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.brand[50],
                borderRadius: radius.pill,
                paddingHorizontal: space[3],
                paddingVertical: space[2],
                marginTop: space[2],
                alignSelf: 'flex-start',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Caption color={colors.brand[600]}>나 · {origin.label}</Caption>
              <Icon name="닫기" color={colors.brand[600]} size={14} />
            </Pressable>
          ) : (
            <View
              key={origin.userId}
              testID={`origin-row-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: space[2],
                marginTop: space[1],
              }}
            >
              <Icon name="장소" color={colors.text.tertiary} size={14} />
              <Caption color={colors.text.secondary} style={{ marginLeft: space[1] }}>
                {origin.nickname} · {origin.label}
              </Caption>
            </View>
          ),
        )}

        {midpoint !== null ? (
          <View testID="midpoint-summary" style={{ marginTop: space[3] }}>
            {snap !== null ? (
              <View
                testID="station-card"
                style={{
                  backgroundColor: colors.surface[1],
                  borderRadius: radius.md,
                  padding: space[4],
                  marginBottom: space[2],
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                }}
              >
                <Body variant="bold" color={colors.text.primary}>
                  {snap.name} 근처가 중간이에요
                </Body>
                <Caption color={colors.text.secondary} style={{ marginTop: space[1] }} tabularNums>
                  중간지점에서 {formatDistance(snap.distanceMeters)}
                </Caption>
                <View style={{ flexDirection: 'row', marginTop: space[2] }}>
                  {RECOMMEND_CATEGORIES.map((c) => {
                    const selected = category === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => {
                          if (category === c && error !== null) {
                            retry(); // 선택된 칩 재탭 시 에러면 재시도 (그 외엔 무반응이던 갭 해소)
                          } else {
                            setCategory(c);
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${c} 추천 보기`}
                        testID={`reco-chip-${c}`}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        style={({ pressed }) => ({
                          backgroundColor: selected
                            ? colors.brand[50]
                            : rowPressBg(pressed, colors, colors.surface[2]),
                          borderRadius: radius.pill,
                          paddingHorizontal: space[3],
                          paddingVertical: space[2],
                          marginRight: space[2],
                        })}
                      >
                        <Caption color={selected ? colors.brand[600] : colors.text.secondary}>
                          {c}
                        </Caption>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <Caption color={colors.text.secondary}>
              {snap !== null
                ? '다른 곳이 좋다면 직접 검색해보세요'
                : '중간지점을 찾았어요 · 근처에서 만날 장소를 검색해보세요'}
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
                onChangeText={(t) => {
                  setCategory(null); // 수동 모드 — 자동 재발사 중단
                  setQuery(t);
                }}
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
            출발지를 등록해주세요 · 2명 이상 모이면 중간지점을 찾아드려요
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
          <Pressable
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="다시 검색"
            testID="reco-error-retry"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              marginTop: space[2],
              minHeight: 44,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Body variant="bold" color={colors.semantic.error.fg}>
              다시 시도
            </Body>
          </Pressable>
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
  centered: { alignItems: 'center', justifyContent: 'center' },
});
