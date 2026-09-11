// 홈 화면 — S25: 나만의 캘린더 (PRD §4·§5.1 복귀).
//
// 월간 캘린더가 주인공. 아래에 선택한 날의 일정(모임·수업·내 일정), 그 아래 다가오는 모임 요약.
// 모임 만들기 동선은 탭바 중앙 GroupFab이 담당하므로 보라 CTA 카드는 두지 않는다
// (§17.1 한 화면 brand fill 1개 — 여기선 '확정' 마커가 그 자리).
//
// D13: 오늘/창 계산은 luxon Asia/Seoul. D25: 신규 무거운 의존성 0 (luxon + supabase만).

import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { DateTime } from 'luxon';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { BrandMark } from '@/components/brand/BrandMark';
import { DayAgenda } from '@/components/calendar/DayAgenda';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import {
  PersonalScheduleSheet,
  type EditingPersonalSchedule,
} from '@/components/calendar/PersonalScheduleSheet';
import { useToast } from '@/components/Toast';
import { rowPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { useAuth } from '@/lib/auth/setup';
import {
  buildCalendarItems,
  groupByDate,
  monthMarkers,
  upcomingGroups,
  type CalendarItem,
} from '@/lib/calendar/agenda';
import { expandSchedules } from '@/lib/calendar/recurrence';
import { fetchMyGroups, type MyGroupSummary } from '@/lib/groups/list';
import { formatDateChip } from '@/lib/groups/dateOptions';
import { messages } from '@/lib/i18n/messages';
import { fetchActiveSchedules, type ScheduleRow } from '@/lib/schedules/queries';

const KST = 'Asia/Seoul';
const UPCOMING_LIMIT = 3;

export default function HomeScreen() {
  const { colors, space, radius, isDark } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const userId = useAuth((s) => s.session?.user.id ?? '');

  // 화면 수명 동안 고정 — 렌더마다 now()를 다시 읽으면 선택 날짜가 자정에 튄다.
  const todayIso = useMemo(() => DateTime.now().setZone(KST).toISODate() ?? '', []);
  const [anchorIso, setAnchorIso] = useState(todayIso);
  const [selectedIso, setSelectedIso] = useState(todayIso);

  const [myGroups, setMyGroups] = useState<MyGroupSummary[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPersonalSchedule | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [groups, rows] = await Promise.all([
        fetchMyGroups(),
        userId === '' ? Promise.resolve<ScheduleRow[]>([]) : fetchActiveSchedules(userId),
      ]);
      setMyGroups(groups);
      setSchedules(rows);
    } catch {
      // fetch 실패를 '일정이 없어요' 빈 상태로 위장하지 않는다(W1-7).
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // 모임 생성·확정 후 홈 복귀 시 자동 갱신 — 포커스마다 refetch(첫 로드만 skeleton).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // 전개 창 = 보고 있는 달 ∪ 선택한 날 (달을 넘겨도 선택일 목록이 비지 않게)
  const [windowFrom, windowTo] = useMemo(() => {
    const anchor = DateTime.fromISO(anchorIso, { zone: KST });
    const monthStart = anchor.startOf('month').toISODate() ?? anchorIso;
    const monthEnd = anchor.endOf('month').toISODate() ?? anchorIso;
    return [
      selectedIso < monthStart ? selectedIso : monthStart,
      selectedIso > monthEnd ? selectedIso : monthEnd,
    ];
  }, [anchorIso, selectedIso]);

  const itemsByDate = useMemo(() => {
    const occurrences = expandSchedules(schedules, windowFrom, windowTo);
    return groupByDate(buildCalendarItems({ groups: myGroups, schedules, occurrences }));
  }, [myGroups, schedules, windowFrom, windowTo]);

  const markers = useMemo(() => monthMarkers(itemsByDate), [itemsByDate]);
  const dayItems = itemsByDate[selectedIso] ?? [];
  const upcoming = useMemo(
    () => upcomingGroups(myGroups, todayIso, UPCOMING_LIMIT),
    [myGroups, todayIso],
  );
  const hasEverytime = schedules.some((s) => s.source === 'everytime');
  // 실패 + 보여줄 데이터 0 → 화면 전체를 에러로. '다가오는 모임' 빈 카드까지 띄우면
  // 실패가 '모임이 없음'으로 위장된다(W1-7).
  const showErrorState = error && myGroups.length === 0 && schedules.length === 0;

  const openAddSheet = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const handlePressItem = useCallback(
    (item: CalendarItem) => {
      if (item.groupId !== null) {
        router.push(`/group/${item.groupId}`);
        return;
      }
      if (item.kind === 'class') {
        // 에브리타임 일정은 앱에서 편집하지 않는다 — 다시 불러오기로 안내
        toast.show({
          message: '에브리타임에서 불러온 일정이에요',
          action: {
            label: '시간표 다시 불러오기',
            onPress: () => router.push('/schedule/everytime'),
          },
        });
        return;
      }
      if (item.scheduleId === null || item.startMinute === null || item.endMinute === null) return;
      setEditing({
        scheduleId: item.scheduleId,
        title: item.title,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
      });
      setSheetOpen(true);
    },
    [router, toast],
  );

  const handleSaved = useCallback(
    (message: string) => {
      toast.show({ message, variant: 'success' });
      load();
    },
    [toast, load],
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.surface[0] }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: space[8] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header — 브랜드 마크 + '지도로 보기'(§5.7 진입) */}
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: space[4],
              paddingTop: space[4],
              paddingBottom: space[2],
            },
          ]}
        >
          <BrandMark size="sm" />
          <Pressable
            onPress={() => router.push('/schedule/map')}
            accessibilityRole="button"
            accessibilityLabel="지도로 일정 보기"
            // 캡션 1줄(~18pt) → 44pt 터치 타깃 위해 상하 hitSlop 확장 (§12.1)
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            testID="schedule-map-entry"
            style={({ pressed }) => [styles.mapEntry, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Caption variant="default" color={colors.text.secondary}>
              지도로 보기
            </Caption>
            <Icon name="화살표" color={colors.text.tertiary} size={16} />
          </Pressable>
        </View>

        {/* 월간 캘린더 */}
        <View style={{ paddingHorizontal: space[4] }}>
          <MonthCalendar
            anchorIso={anchorIso}
            onAnchorChange={setAnchorIso}
            selectedIso={selectedIso}
            onSelect={setSelectedIso}
            todayIso={todayIso}
            markers={markers}
            testID="home-calendar"
          />
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: colors.border.subtle,
            marginHorizontal: space[4],
            marginTop: space[2],
            marginBottom: space[5],
          }}
        />

        {/* 선택일 일정 */}
        <View style={{ paddingHorizontal: space[4] }}>
          {loading ? (
            <View testID="home-loading">
              {[0, 1].map((i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: colors.surface[2],
                    borderColor: colors.border.subtle,
                    borderWidth: 1,
                    borderRadius: radius.lg,
                    padding: space[4],
                    marginBottom: space[2],
                  }}
                >
                  <Skeleton width={'55%'} height={16} />
                  <View style={{ height: space[2] }} />
                  <Skeleton width={'80%'} height={12} />
                </View>
              ))}
            </View>
          ) : showErrorState ? (
            <EmptyState
              variant="error"
              title="일정을 불러오지 못했어요"
              body="잠시 후 다시 시도해볼게요."
              cta={{ label: messages.action.retry, onPress: load }}
              testID="home-error"
            />
          ) : (
            <DayAgenda
              dateIso={selectedIso}
              items={dayItems}
              onPressItem={handlePressItem}
              onAddPress={openAddSheet}
            />
          )}
        </View>

        {/* 시간표 힌트 — 아직 에브리타임을 불러오지 않은 사용자에게만 */}
        {!loading && !showErrorState && !hasEverytime ? (
          <View style={{ paddingHorizontal: space[4], marginTop: space[4] }}>
            <Pressable
              onPress={() => router.push('/schedule/everytime')}
              accessibilityRole="button"
              accessibilityLabel="에브리타임 시간표 불러오기"
              testID="home-everytime-hint"
              style={({ pressed }) => [
                styles.hintRow,
                {
                  backgroundColor: rowPressBg(pressed, colors),
                  borderColor: colors.border.subtle,
                  borderRadius: radius.md,
                  paddingHorizontal: space[4],
                  paddingVertical: space[3],
                },
              ]}
            >
              <Icon name="캘린더" color={colors.text.secondary} size={18} />
              <Caption variant="default" color={colors.text.secondary} style={{ flex: 1 }}>
                시간표를 불러오면 수업도 함께 보여요
              </Caption>
              <Icon name="화살표" color={colors.text.tertiary} size={16} />
            </Pressable>
          </View>
        ) : null}

        {/* 다가오는 모임 — 에러 상태에선 섹션째 감춘다(빈 카드가 실패를 가리지 않게) */}
        {showErrorState ? null : (
          <>
            <View
              style={{
                paddingHorizontal: space[4],
                marginTop: space[8],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Title level="h3" color={colors.text.primary}>
                다가오는 모임
              </Title>
              {upcoming.length > 0 ? (
                <View
                  style={{
                    minWidth: 24,
                    height: 24,
                    paddingHorizontal: space[2],
                    borderRadius: radius.pill,
                    // 다크: brand-50(6% 알파)은 투명이라 배지가 사라짐 → surface-3.
                    backgroundColor: isDark ? colors.surface[3] : colors.brand[50],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Caption variant="micro" color={colors.brand[600]} tabularNums>
                    {upcoming.length}
                  </Caption>
                </View>
              ) : null}
            </View>

            {loading ? null : upcoming.length > 0 ? (
              <View style={{ paddingHorizontal: space[4], marginTop: space[3] }}>
                {upcoming.map((g) => {
                  const confirmed = g.confirmedAt !== null;
                  const dateSummary =
                    g.dates.length > 0
                      ? `후보 ${g.dates.length}일 · ${g.dates.map(formatDateChip).join(', ')}`
                      : '날짜 미정';
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => router.push(`/group/${g.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.name} 모임 열기`}
                      testID={`my-group-${g.id}`}
                      style={({ pressed }) => [
                        styles.groupCard,
                        {
                          backgroundColor: pressed ? colors.surface[3] : colors.surface[2],
                          borderColor: colors.border.subtle,
                          borderRadius: radius.lg,
                          padding: space[4],
                          marginBottom: space[2],
                        },
                      ]}
                    >
                      {/* 위계: 1 이름 / 2 상태(dot+라벨) / 3 날짜 요약 (§17.3) */}
                      <View style={{ flex: 1 }}>
                        <Body variant="bold" color={colors.text.primary}>
                          {g.name}
                        </Body>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: space[2],
                            marginTop: space[1],
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: radius.full,
                              backgroundColor: confirmed ? colors.brand[500] : colors.text.tertiary,
                            }}
                          />
                          <Caption
                            variant="default"
                            color={confirmed ? colors.text.primary : colors.text.secondary}
                          >
                            {confirmed ? '확정됨' : '투표 중'}
                          </Caption>
                        </View>
                        <Caption
                          variant="micro"
                          color={colors.text.tertiary}
                          style={{ marginTop: space[1] }}
                        >
                          {dateSummary}
                        </Caption>
                      </View>
                      {/* Icon testID는 svg로 안 넘어가므로 wrapper View로 노출 */}
                      <View testID={`my-group-${g.id}-chevron`} style={{ marginLeft: space[2] }}>
                        <Icon name="화살표" color={colors.text.tertiary} size={20} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              /* Empty card — §11.2. 아이콘 컨테이너는 회색(D5 절제) */
              <View style={{ paddingHorizontal: space[4], marginTop: space[3] }}>
                <View
                  style={[
                    styles.emptyCard,
                    {
                      backgroundColor: colors.surface[2],
                      borderColor: colors.border.subtle,
                      borderRadius: radius.lg,
                      padding: space[8],
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: radius.full,
                      backgroundColor: colors.surface[3],
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: space[3],
                    }}
                  >
                    <Icon name="캘린더" color={colors.text.secondary} size={26} />
                  </View>
                  <Body
                    variant="bold"
                    color={colors.text.primary}
                    style={{ marginBottom: space[1] }}
                  >
                    잡힌 모임이 아직 없어요
                  </Body>
                  <Caption
                    variant="default"
                    color={colors.text.tertiary}
                    style={{ textAlign: 'center' }}
                  >
                    첫 모임을 만들어볼까요?
                  </Caption>
                  <View style={{ alignSelf: 'stretch', marginTop: space[5] }}>
                    <Button
                      label="모임 만들기"
                      onPress={() => router.push('/group/new')}
                      variant="secondary"
                      size="md"
                      testID="home-empty-cta"
                    />
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* key로 remount — 추가/수정 전환 시 이전 입력이 남지 않는다 */}
      {sheetOpen ? (
        <PersonalScheduleSheet
          key={editing?.scheduleId ?? `new:${selectedIso}`}
          visible
          onClose={() => setSheetOpen(false)}
          onSaved={handleSaved}
          userId={userId}
          dateIso={selectedIso}
          editing={editing}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapEntry: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
});
