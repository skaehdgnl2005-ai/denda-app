// S05-screen-confirm — 모임 화면 + 호스트 확정 surface.
//
// 책임:
//   - groups + group_members fetch (queries.fetchGroupForConfirm)
//   - useHeatmapSubscription으로 Realtime broadcast 수신 + heat-0~4 분류
//   - useSweepGesture로 drag sweep selection (D12 worklet)
//   - drag onCommit → commitVoteDiff (S05c) + JS state selection mirror 갱신
//   - 호스트 + 미확정 → HostConfirmButton 노출, selection → range 변환 → confirmGroup 호출
//   - 확정 후 → 그리드 disable + ConfirmedTimeCard 표시
//
// §17 anti-AI-feel: brand-500 CTA 1개("모임 확정"), surface-2 disabled, 친근체 토스트.
// D13: 모든 시간 표시는 KST. confirmed_*_at는 UTC ISO → ConfirmedTimeCard가 luxon 변환.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Grid } from '@/components/TimeGrid/Grid';
import { RealtimeStatus } from '@/components/TimeGrid/RealtimeStatus';
import { SelectionOverlay } from '@/components/TimeGrid/SelectionOverlay';
import { VoteGuide } from '@/components/TimeGrid/VoteGuide';
import { FirstTimeModal } from '@/components/calendar/FirstTimeModal';
import { ConfirmedTimeCard } from '@/components/group/ConfirmedTimeCard';
import { ConfirmSlotSheet } from '@/components/group/ConfirmSlotSheet';
import { HostConfirmButton } from '@/components/group/HostConfirmButton';
import { useToast } from '@/components/Toast';
import { rowPressBg, ctaPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { mapError } from '@/lib/i18n/messages';
import { Body, Caption, Title } from '@/design/typography';
import { useAuth } from '@/lib/auth/setup';
import { fetchCalendarPreference } from '@/lib/calendar/preference';
import {
  createAppleCalendarProvider,
  createGoogleCalendarProvider,
  signInGoogleAndUpload,
} from '@/lib/calendar/setup';
import { formatDayHeader } from '@/lib/datetime/dayHeader';
import { confirmGroup } from '@/lib/groups/confirm';
import { fetchGroupForConfirm, fetchUserVotes, type GroupForConfirm } from '@/lib/groups/queries';
import { recommendSlots, type RecommendedSlot } from '@/lib/groups/recommendSlots';
import { useHeatmapSubscription } from '@/lib/heatmap/useHeatmapSubscription';
import type { GridLayout } from '@/lib/heatmap/coords';
import type { SlotKey } from '@/lib/heatmap/types';
import { supabase } from '@/lib/supabase/client';
import { commitVoteDiff } from '@/lib/votes/api';
import { useSweepGesture } from '@/lib/votes/useSweepGesture';
import { diffVoteSets, voteSetFromSlots, type VoteSlot } from '@/lib/votes/voteSet';

const ROW_COUNT = 60;
const CELL_HEIGHT = 16; // Grid styles.row.height (Issue 2: 10 → 14 → 16)
const HEADER_WIDTH = 50; // Grid TIME_COLUMN_WIDTH

export default function GroupConfirmScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { colors, space, radius } = useTheme();
  const toast = useToast();
  const userId = useAuth((s) => s.session?.user.id);

  const [group, setGroup] = useState<GroupForConfirm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectionRecord, setSelectionRecord] = useState<Record<SlotKey, boolean>>({});
  const [inflight, setInflight] = useState(false);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedSlot[]>([]);

  // S06: 첫 Google/Apple sign-in callback — lazy 구성 (expo-* 패키지 미설치 환경에서 페이지
  // 진입 시점 throw 방지). createGoogleCalendarProvider/createAppleCalendarProvider는 호출 시
  // 점에 expo-auth-session/expo-secure-store/expo-calendar dynamicRequire — 사용자가 모달
  // 옵션을 실제 선택해 확인 버튼 누를 때만 native 모듈 require.
  const handleSignInGoogle = useCallback(async (): Promise<void> => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
    const { provider, storage } = createGoogleCalendarProvider({
      oauthConfig: { clientId, redirectUri: 'denda://oauth' },
    });
    await signInGoogleAndUpload({ provider, storage, supabase });
  }, []);
  const handleRequestApplePermission = useCallback(async (): Promise<void> => {
    const appleProvider = createAppleCalendarProvider();
    await appleProvider.requestPermission();
  }, []);

  // Previous committed vote slot set (JS mirror for diff)
  const prevVoteSetRef = useRef<Set<string>>(new Set());

  // Fail #12: group + 본인 기존 vote를 한 effect에서 fetch.
  // votes 실패는 silent (group 도착하면 빈 grid로 진입 가능). group 실패는 loadError.
  // userId 변경 시 재fetch — group 단일 row라 비용 작음.
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const votesPromise = userId
      ? fetchUserVotes(groupId, userId).catch(() => [] as VoteSlot[])
      : Promise.resolve([] as VoteSlot[]);
    Promise.all([fetchGroupForConfirm(groupId), votesPromise])
      .then(([g, slots]) => {
        if (cancelled) return;
        setLoadError(null);
        setGroup(g);
        prevVoteSetRef.current = voteSetFromSlots(slots);
        const next: Record<SlotKey, boolean> = {};
        for (const slot of slots) {
          const col = g.dates.indexOf(slot.day);
          if (col >= 0) next[`${col}:${slot.start_minute}` as SlotKey] = true;
        }
        setSelectionRecord(next);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return (): void => {
      cancelled = true;
    };
  }, [groupId, userId, reloadKey]);

  // W2-7 — 재진입 시 refetch. 멤버가 화면을 떠난 사이 호스트가 확정하면 재진입해도 stale로
  // 남던 문제 해소. 첫 포커스(마운트)는 위 useEffect가 이미 fetch하므로 skip(중복 fetch 방지).
  // (드래그 그리드에 pull-to-refresh는 D12 60fps 보호 위해 별도 검증 후 도입 — 본 커밋 제외.)
  const didFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didFocusRef.current) {
        didFocusRef.current = true;
        return;
      }
      setReloadKey((k) => k + 1);
    }, []),
  );

  const selfMarks = useMemo<Set<SlotKey>>(() => {
    const set = new Set<SlotKey>();
    for (const [key, val] of Object.entries(selectionRecord)) {
      if (val) set.add(key as SlotKey);
    }
    return set;
  }, [selectionRecord]);

  const dayCount = group?.dates.length ?? 7;
  const memberCount = Math.max(group?.memberCount ?? 1, 1);

  const { cells, isConnected } = useHeatmapSubscription({
    groupId,
    selfMarks,
    maxCount: memberCount,
    dayCount,
  });

  const layout = useSharedValue<GridLayout>({
    headerWidth: HEADER_WIDTH,
    cellHeight: CELL_HEIGHT,
    cellWidth: 0,
    rowCount: ROW_COUNT,
    colCount: dayCount,
    scrollOffsetY: 0,
  });

  const isConfirmed = group?.confirmedAt !== null && group?.confirmedAt !== undefined;
  const isHost = Boolean(userId && group && group.hostId === userId);

  const handleSweepCommit = useCallback(
    (slots: VoteSlot[]) => {
      if (!group || !userId || isConfirmed) return;

      // selection JS mirror — col 기반 (selectionToConfirmRange + selfMarks 둘 다 호환)
      const nextSelection: Record<SlotKey, boolean> = {};
      for (const slot of slots) {
        const col = group.dates.indexOf(slot.day);
        if (col >= 0) nextSelection[`${col}:${slot.start_minute}` as SlotKey] = true;
      }
      setSelectionRecord(nextSelection);

      // S05c: vote diff commit
      const nextSet = voteSetFromSlots(slots);
      const { added, removed } = diffVoteSets(prevVoteSetRef.current, nextSet);
      if (added.length === 0 && removed.length === 0) return;
      prevVoteSetRef.current = nextSet;
      commitVoteDiff({ groupId, userId, added, removed }).catch((e: Error) => {
        const { silent, message } = mapError(e);
        if (!silent) toast.show({ message, variant: 'error' });
      });
    },
    [group, userId, groupId, isConfirmed, toast],
  );

  const days = group?.dates ?? [];
  const { panGesture, scrollOffsetY, startCoord, currentCoord, toggleAdd } = useSweepGesture({
    days,
    layout,
    // 기존 투표 시드 — 미전달 시 재진입 후 첫 sweep이 기존 투표 전체를 removed로 삭제
    initialSelection: selectionRecord,
    onCommit: handleSweepCommit,
  });

  const handleCellWidthChange = useCallback(
    (cellWidth: number) => {
      // Reanimated SharedValue 패턴 — useSweepGesture worklet이 layout.value를 매 frame 읽는다.
      // useState로 옮기면 worklet에서 stale 값을 보게 됨 (React fiber rerender 사이클 불일치).
      // eslint-disable-next-line react-hooks/immutability
      layout.value = { ...layout.value, cellWidth, colCount: dayCount };
    },
    [layout, dayCount],
  );

  const handleScrollY = useCallback(
    (offsetY: number) => {
      // scrollOffsetY는 useSweepGesture가 노출한 SharedValue (worklet이 매 onUpdate에서 읽음).
      // eslint-disable-next-line react-hooks/immutability
      scrollOffsetY.value = offsetY;
    },
    [scrollOffsetY],
  );

  // 모임 확정 = 투표(여러 날짜)와 분리. 히트맵 집계에서 "가장 많은 인원이 가능한" 단일 날짜
  // 연속 구간 1~3순위를 뽑아 시트로 제시 → 호스트가 하나를 골라 확정한다 (selectionRecord 미사용).
  const handleConfirm = (): void => {
    if (!group || inflight) return;
    setRecommendations(recommendSlots(cells, group.dates));
    setShowConfirmSheet(true);
  };

  const handleSelectRecommendation = async (rec: RecommendedSlot): Promise<void> => {
    if (!group || inflight) return;
    setInflight(true);
    try {
      const result = await confirmGroup({
        groupId,
        dayIndex: rec.dayIndex,
        startMinute: rec.startMinute,
        endMinute: rec.endMinute,
        confirmedPlaceId: null,
      });
      setShowConfirmSheet(false);
      // 클라이맥스 피드백 = ConfirmedTimeCard 등장(아래 setGroup) + 보조 success 토스트.
      // 시스템 Alert 제거 (§6.5·§11.3).
      if (result.alreadyConfirmed) {
        toast.show({ message: '이미 확정된 모임이에요.' });
      } else if (result.f5Dispatch.rejected > 0) {
        toast.show({
          message: '모임이 확정됐어요! 일부 멤버는 알림을 못 받았어요.',
          variant: 'success',
        });
      } else {
        toast.show({ message: '모임이 확정됐어요!', variant: 'success' });
      }
      // Refresh group state to flip into read-only mode (ConfirmedTimeCard 등장 트리거)
      const updated = await fetchGroupForConfirm(groupId);
      setGroup(updated);

      // S06: 새로 확정된 경우(이미 확정 X) + 캘린더 선택 미결정 시 모달 노출
      if (!result.alreadyConfirmed && userId) {
        try {
          const pref = await fetchCalendarPreference(supabase, userId);
          if (pref === null) {
            setShowFirstTimeModal(true);
          }
        } catch {
          // preference 조회 실패는 confirm 흐름을 막지 않음 (silent)
        }
      }
    } catch (e) {
      // 확정 실패: 시트를 닫지 않아 재시도 보존 + error 토스트 (raw 메시지 비노출).
      const { silent, message } = mapError(e);
      if (!silent) toast.show({ message, variant: 'error' });
    } finally {
      setInflight(false);
    }
  };

  if (!groupId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
        <View style={[styles.centered, { padding: space[4] }]}>
          <Body color={colors.text.secondary}>모임 ID가 없어요.</Body>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
        <View style={[styles.centered, { padding: space[4] }]}>
          <EmptyState
            variant="error"
            title="모임을 불러오지 못했어요"
            body="잠시 후 다시 시도해볼게요"
            cta={{
              label: '다시 시도',
              onPress: () => {
                setLoadError(null);
                setReloadKey((k) => k + 1);
              },
            }}
            testID="group-load-error"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
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
          <Skeleton width={120} height={20} />
          <View style={styles.iconButton} />
        </View>
        <View
          testID="group-loading-skeleton"
          accessibilityRole="progressbar"
          accessibilityLabel="모임을 불러오는 중"
          style={{ paddingHorizontal: space[4], paddingTop: space[2] }}
        >
          <Skeleton width={160} height={14} />
          <View style={{ height: space[4] }} />
          <Skeleton height={72} borderRadius={radius.md} />
          <View style={{ height: space[4] }} />
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={{ marginBottom: space[2] }}>
              <Skeleton height={12} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const dayHeaders = group.dates.map(formatDayHeader);

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
        <Title level="h2" color={colors.text.primary} numberOfLines={1} style={styles.titleFlex}>
          {group.name}
        </Title>
        {isHost ? (
          <Pressable
            onPress={() => router.push(`/group/${groupId}/invite`)}
            accessibilityRole="button"
            accessibilityLabel="친구 초대"
            testID="invite-button"
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="추가" color={colors.text.primary} size={24} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>

      <View
        style={{
          paddingHorizontal: space[4],
          paddingBottom: space[2],
        }}
      >
        <Caption color={colors.text.tertiary} tabularNums>
          멤버 {group.memberCount}명 · {group.dates.length}일 후보
        </Caption>
      </View>

      {isConfirmed && group.confirmedStartAt && group.confirmedEndAt ? (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <ConfirmedTimeCard
            startAtUtc={group.confirmedStartAt}
            endAtUtc={group.confirmedEndAt}
            testID="confirmed-time-card"
          />
        </View>
      ) : null}

      {/* S20: 장소 정하기 / 보기 — 시간 확정 이후 노출. host 만 pick 가능. */}
      {isConfirmed && group.confirmedPlaceId !== null ? (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <Pressable
            onPress={() => router.push(`/group/${groupId}/place?placeId=${group.confirmedPlaceId}`)}
            accessibilityRole="button"
            accessibilityLabel="정해진 장소 보기"
            testID="place-view-button"
            style={({ pressed }) => ({
              backgroundColor: rowPressBg(pressed, colors, colors.surface[1]),
              borderRadius: radius.md,
              padding: space[4],
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border.subtle,
            })}
          >
            <Icon name="장소" color={colors.text.tertiary} size={20} />
            <Body color={colors.text.primary} style={{ flex: 1, marginLeft: space[2] }}>
              정해진 장소 보기
            </Body>
            <Icon name="화살표" color={colors.text.tertiary} size={20} />
          </Pressable>
        </View>
      ) : isConfirmed ? (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
          {isHost ? (
            <Pressable
              onPress={() => router.push(`/group/${groupId}/place-search`)}
              accessibilityRole="button"
              accessibilityLabel="장소 정하기"
              testID="place-pick-button"
              style={({ pressed }) => ({
                backgroundColor: ctaPressBg(pressed, colors),
                borderRadius: radius.md,
                padding: space[4],
                alignItems: 'center',
              })}
            >
              <Body variant="bold" color={colors.text['on-brand']}>
                장소 정하기
              </Body>
            </Pressable>
          ) : null}
          {/* S-MAP M3+M5(D41): 중간지점 진입은 전 멤버 — 각자 출발지 등록. 장소 확정은 호스트만(RLS). */}
          <Pressable
            onPress={() =>
              router.push({ pathname: '/group/[id]/midpoint', params: { id: groupId } })
            }
            accessibilityRole="button"
            accessibilityLabel="중간지점으로 찾기"
            testID="midpoint-entry-button"
            style={({ pressed }) => ({
              marginTop: isHost ? space[2] : 0,
              borderRadius: radius.md,
              padding: space[4],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: rowPressBg(pressed, colors, colors.surface[1]),
              borderWidth: 1,
              borderColor: colors.border.subtle,
            })}
          >
            <Icon name="장소" color={colors.text.secondary} size={18} />
            <Body color={colors.text.primary} style={{ marginLeft: space[2] }}>
              중간지점으로 찾기
            </Body>
          </Pressable>
        </View>
      ) : null}

      {!isConfirmed ? (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <VoteGuide hasSelection={selfMarks.size > 0} testID="vote-guide" />
        </View>
      ) : null}

      <RealtimeStatus isConnected={isConnected} testID="realtime-status" />

      <View style={styles.gridContainer}>
        <Grid
          cells={cells}
          dayHeaders={dayHeaders}
          colCount={dayCount}
          panGesture={isConfirmed ? undefined : panGesture}
          onCellWidthChange={handleCellWidthChange}
          onScrollY={handleScrollY}
          testID="time-grid"
          overlay={
            isConfirmed ? null : (
              <SelectionOverlay
                layout={layout}
                startCoord={startCoord}
                currentCoord={currentCoord}
                toggleAdd={toggleAdd}
                testID="selection-overlay"
              />
            )
          }
        />
      </View>

      {isHost && !isConfirmed ? (
        <View style={[styles.footer, { padding: space[4], borderTopColor: colors.border.subtle }]}>
          <HostConfirmButton
            onPress={handleConfirm}
            disabled={false}
            inflight={inflight}
            testID="host-confirm-button"
          />
        </View>
      ) : null}

      <ConfirmSlotSheet
        visible={showConfirmSheet}
        recommendations={recommendations}
        onSelect={handleSelectRecommendation}
        onClose={() => setShowConfirmSheet(false)}
        inflight={inflight}
        testID="confirm-slot-sheet"
      />

      {userId ? (
        <FirstTimeModal
          visible={showFirstTimeModal}
          onClose={() => setShowFirstTimeModal(false)}
          userId={userId}
          supabase={supabase}
          signInGoogle={handleSignInGoogle}
          requestApplePermission={handleRequestApplePermission}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleFlex: {
    flex: 1,
    textAlign: 'center',
  },
  gridContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: 1,
  },
});
