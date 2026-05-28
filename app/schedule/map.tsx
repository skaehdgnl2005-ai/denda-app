// S15-mapmode-ui-calendar — "지도로 내 일정 보기" 화면.
//
// fetchConfirmedGroupSchedules → toScheduleMapPoints로 시간순 정렬+①②③ order 부여 →
// 시간 범위 chip(이번주/이번달/전체)으로 filterByKstDateRange → 리스트(default) or
// 지도 모드(placeholder) 토글.
//
// native MapView SDK(@mj-studio/react-native-naver-map) 통합은 Naver Maps Client ID 발급 +
// EAS Build 운영 트랙 deferred — 본 화면은 SDK 의존 0. 향후 native 합류 시 schedule-map-placeholder
// 자리에 `<NaverMapView mode="schedule">` + 32pt brand-500 fill ①②③ 마커 + 보라 dashed 폴리라인.

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DateTime } from 'luxon';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { fetchConfirmedGroupSchedules } from '@/lib/schedules/groupScheduleQueries';
import {
  toScheduleMapPoints,
  type ConfirmedGroupScheduleInput,
  type ScheduleMapPoint,
} from '@/lib/schedules/scheduleMapPoint';
import { filterByKstDateRange } from '@/lib/schedules/timeRangeFilter';

type TimeRange = 'week' | 'month' | 'all';
type ViewMode = 'list' | 'map';

const KST = 'Asia/Seoul';

function kstWindow(range: TimeRange): { fromKst: string; toKst: string } | null {
  if (range === 'all') return null;
  const today = DateTime.now().setZone(KST);
  const anchor = range === 'week' ? today.startOf('week') : today.startOf('month');
  const end = range === 'week' ? today.endOf('week') : today.endOf('month');
  return { fromKst: anchor.toFormat('yyyy-MM-dd'), toKst: end.toFormat('yyyy-MM-dd') };
}

function formatKstTime(utcIso: string): string {
  return DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(KST).toFormat('M월 d일 (EEE) HH:mm');
}

export default function ScheduleMapScreen(): React.JSX.Element {
  const { colors, space, radius } = useTheme();
  const router = useRouter();

  const [allPoints, setAllPoints] = useState<ScheduleMapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>('week');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    let cancelled = false;
    fetchConfirmedGroupSchedules()
      .then((rows: ConfirmedGroupScheduleInput[]) => {
        if (cancelled) return;
        setAllPoints(toScheduleMapPoints(rows));
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : '모임 일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const visiblePoints = useMemo(() => {
    const w = kstWindow(range);
    if (w === null) return allPoints;
    return filterByKstDateRange(allPoints, w.fromKst, w.toKst);
  }, [allPoints, range]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.surface[0] }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: space[3], paddingVertical: space[2] }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID="back-button"
          style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="뒤로" color={colors.text.primary} size={24} />
        </Pressable>
        <Title level="h3" color={colors.text.primary}>
          지도로 내 일정 보기
        </Title>
        <View style={{ width: 36 }} />
      </View>

      {/* 범위 + 모드 토글 */}
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
        <View style={[styles.rowGap, { marginBottom: space[3] }]}>
          {(
            [
              { key: 'week', label: '이번 주' },
              { key: 'month', label: '이번 달' },
              { key: 'all', label: '전체' },
            ] as const
          ).map((r) => {
            const active = range === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                accessibilityRole="button"
                accessibilityLabel={`${r.label} 범위 선택`}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                testID={`range-chip-${r.key}`}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.brand[50] : colors.surface[2],
                    borderColor: active ? colors.brand[500] : colors.border.subtle,
                    borderRadius: radius.pill,
                    paddingHorizontal: space[3],
                    paddingVertical: space[2],
                  },
                ]}
              >
                <Caption
                  variant="default"
                  color={active ? colors.brand[600] : colors.text.secondary}
                >
                  {r.label}
                </Caption>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rowGap}>
          {(
            [
              { key: 'list', label: '리스트', icon: '캘린더' as const },
              { key: 'map', label: '지도', icon: '지도' as const },
            ] as const
          ).map((m) => {
            const active = viewMode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setViewMode(m.key)}
                accessibilityRole="button"
                accessibilityLabel={`${m.label} 보기`}
                testID={`view-mode-${m.key}`}
                style={[
                  styles.viewModeBtn,
                  {
                    backgroundColor: active ? colors.surface[3] : colors.surface[1],
                    borderColor: active ? colors.border.strong : colors.border.subtle,
                    borderRadius: radius.md,
                    paddingHorizontal: space[3],
                    paddingVertical: space[2],
                  },
                ]}
              >
                <Icon
                  name={m.icon}
                  color={active ? colors.text.primary : colors.text.tertiary}
                  size={16}
                />
                <Caption
                  variant="default"
                  color={active ? colors.text.primary : colors.text.tertiary}
                  style={{ marginLeft: space[1] }}
                >
                  {m.label}
                </Caption>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 본문 */}
      {renderBody({
        isLoading,
        error,
        viewMode,
        visiblePoints,
        colors,
        space,
        radius,
      })}
    </SafeAreaView>
  );
}

interface BodyArgs {
  isLoading: boolean;
  error: string | null;
  viewMode: ViewMode;
  visiblePoints: ScheduleMapPoint[];
  colors: ReturnType<typeof useTheme>['colors'];
  space: ReturnType<typeof useTheme>['space'];
  radius: ReturnType<typeof useTheme>['radius'];
}

function renderBody(args: BodyArgs): React.JSX.Element {
  const { isLoading, error, viewMode, visiblePoints, colors, space, radius } = args;

  if (isLoading) {
    return (
      <View style={styles.center} testID="schedule-loading">
        <ActivityIndicator color={colors.brand[500]} size="large" />
      </View>
    );
  }
  if (error !== null) {
    return (
      <View style={[styles.center, { paddingHorizontal: space[6] }]} testID="schedule-error">
        <Icon name="장소" color={colors.text.tertiary} size={26} />
        <Body
          variant="sm"
          color={colors.text.secondary}
          style={{ marginTop: space[3], textAlign: 'center' }}
        >
          {error}
        </Body>
      </View>
    );
  }
  if (viewMode === 'map') {
    return (
      <View
        style={[styles.center, { paddingHorizontal: space[6] }]}
        testID="schedule-map-placeholder"
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
          <Icon name="지도" color={colors.text.secondary} size={26} />
        </View>
        <Body variant="bold" color={colors.text.primary} style={{ marginBottom: space[1] }}>
          지도 모드는 준비 중이에요
        </Body>
        <Caption
          variant="default"
          color={colors.text.tertiary}
          style={{ textAlign: 'center', lineHeight: 18 }}
        >
          정식 앱 빌드가 준비되면{'\n'}모임 일정을 지도 위에 표시해드릴게요.
        </Caption>
      </View>
    );
  }
  if (visiblePoints.length === 0) {
    return (
      <View style={[styles.center, { paddingHorizontal: space[6] }]} testID="schedule-empty">
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
        <Body variant="bold" color={colors.text.primary} style={{ marginBottom: space[1] }}>
          이 범위에 확정된 모임이 없어요
        </Body>
        <Caption
          variant="default"
          color={colors.text.tertiary}
          style={{ textAlign: 'center', lineHeight: 18 }}
        >
          모임이 확정되고 장소가 정해지면{'\n'}여기에 시간순으로 보여드려요.
        </Caption>
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[8] }}
      showsVerticalScrollIndicator={false}
    >
      {visiblePoints.map((p) => (
        <View
          key={p.groupId}
          testID={`schedule-point-${p.order}`}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface[1],
              borderColor: colors.border.subtle,
              borderRadius: radius.lg,
              padding: space[4],
              marginBottom: space[3],
            },
          ]}
        >
          <View
            style={[
              styles.orderBadge,
              {
                backgroundColor: colors.brand[500],
                borderRadius: radius.full,
                marginRight: space[3],
              },
            ]}
          >
            <Title
              level="h3"
              color={colors.text['on-brand']}
              tabularNums
              style={{ fontWeight: '700' }}
            >
              {p.order}
            </Title>
          </View>
          <View style={styles.cardBody}>
            <Body variant="bold" color={colors.text.primary}>
              {p.groupName}
            </Body>
            <Caption variant="default" color={colors.text.tertiary} style={{ marginTop: 2 }}>
              {p.placeName}
            </Caption>
            <Caption
              variant="default"
              color={colors.text.secondary}
              tabularNums
              style={{ marginTop: space[1] }}
            >
              {formatKstTime(p.confirmedStartAt)}
            </Caption>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowGap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  orderBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
});
