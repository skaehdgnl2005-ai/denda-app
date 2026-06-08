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
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { Grid } from '@/components/TimeGrid/Grid';
import { RealtimeStatus } from '@/components/TimeGrid/RealtimeStatus';
import { SelectionOverlay } from '@/components/TimeGrid/SelectionOverlay';
import { VoteGuide } from '@/components/TimeGrid/VoteGuide';
import { FirstTimeModal } from '@/components/calendar/FirstTimeModal';
import { ConfirmedTimeCard } from '@/components/group/ConfirmedTimeCard';
import { HostConfirmButton } from '@/components/group/HostConfirmButton';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { useAuth } from '@/lib/auth/setup';
import { fetchCalendarPreference } from '@/lib/calendar/preference';
import {
  createAppleCalendarProvider,
  createGoogleCalendarProvider,
  signInGoogleAndUpload,
} from '@/lib/calendar/setup';
import { confirmGroup } from '@/lib/groups/confirm';
import { fetchGroupForConfirm, fetchUserVotes, type GroupForConfirm } from '@/lib/groups/queries';
import { selectionToConfirmRange } from '@/lib/groups/selectionToConfirmRange';
import { useHeatmapSubscription } from '@/lib/heatmap/useHeatmapSubscription';
import type { GridLayout } from '@/lib/heatmap/coords';
import type { SlotKey } from '@/lib/heatmap/types';
import { supabase } from '@/lib/supabase/client';
import { commitVoteDiff } from '@/lib/votes/api';
import { useSweepGesture } from '@/lib/votes/useSweepGesture';
import { diffVoteSets, voteSetFromSlots, type VoteSlot } from '@/lib/votes/voteSet';

const ROW_COUNT = 60;
const CELL_HEIGHT = 14; // Grid styles.row.height (Issue 2: 10 → 14)
const HEADER_WIDTH = 50; // Grid TIME_COLUMN_WIDTH

function formatDayLabels(dates: string[]): string[] {
  return dates.map((d) => {
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isInteger(month) || !Number.isInteger(day)) return d;
    return `${month}/${day}`;
  });
}

export default function GroupConfirmScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { colors, space, radius } = useTheme();
  const userId = useAuth((s) => s.session?.user.id);

  const [group, setGroup] = useState<GroupForConfirm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectionRecord, setSelectionRecord] = useState<Record<SlotKey, boolean>>({});
  const [inflight, setInflight] = useState(false);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);

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
  }, [groupId, userId]);

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
        Alert.alert('알림', e.message);
      });
    },
    [group, userId, groupId, isConfirmed],
  );

  const days = group?.dates ?? [];
  const { panGesture, scrollOffsetY, startCoord, currentCoord, toggleAdd } = useSweepGesture({
    days,
    layout,
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

  const handleConfirm = async (): Promise<void> => {
    if (!group || inflight) return;
    const range = selectionToConfirmRange(selectionRecord);
    if (!range.ok) {
      Alert.alert('확인', range.error);
      return;
    }
    setInflight(true);
    try {
      const result = await confirmGroup({
        groupId,
        dayIndex: range.dayIndex,
        startMinute: range.startMinute,
        endMinute: range.endMinute,
        confirmedPlaceId: null,
      });
      if (result.alreadyConfirmed) {
        Alert.alert('알림', '이미 확정된 모임이에요.');
      } else if (result.f5Dispatch.rejected > 0) {
        Alert.alert('확정했어요', '일부 멤버에게 알림을 보내지 못했어요.');
      } else {
        Alert.alert('확정', '모임이 확정됐어요!');
      }
      // Refresh group state to flip into read-only mode
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
      Alert.alert('확정 실패', (e as Error).message);
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
          <Body color={colors.text.secondary}>{loadError}</Body>
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

  const dayLabels = formatDayLabels(group.dates);

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
        <Caption color={colors.text.tertiary}>
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
              backgroundColor: colors.surface[1],
              borderRadius: radius.md,
              padding: space[4],
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border.subtle,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon name="장소" color={colors.text.tertiary} size={20} />
            <Body color={colors.text.primary} style={{ flex: 1, marginLeft: space[2] }}>
              정해진 장소 보기
            </Body>
            <Icon name="화살표" color={colors.text.tertiary} size={20} />
          </Pressable>
        </View>
      ) : isConfirmed && isHost ? (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <Pressable
            onPress={() => router.push(`/group/${groupId}/place-search`)}
            accessibilityRole="button"
            accessibilityLabel="장소 정하기"
            testID="place-pick-button"
            style={({ pressed }) => ({
              backgroundColor: colors.brand[500],
              borderRadius: radius.md,
              padding: space[4],
              alignItems: 'center',
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Body variant="bold" color={colors.text['on-brand']}>
              장소 정하기
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
          dayLabels={dayLabels}
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
