// 홈 화면 — §17.2 placeholder 회피 + §17.1 D5 절제.
// 탭바 추가 후 quick action 제거 — 한 화면 한 정보 (토스 풍).
// 보라는 메인 CTA 하나만, 빈 상태 아이콘은 회색.

import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { DateTime } from 'luxon';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { BrandMark } from '@/components/brand/BrandMark';
import { ctaPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { useAuth } from '@/lib/auth/setup';
import { fetchMyGroups, type MyGroupSummary } from '@/lib/groups/list';
import { formatDateChip } from '@/lib/groups/dateOptions';
import { countGroupsThisMonthKst } from '@/lib/groups/stats';
import { messages } from '@/lib/i18n/messages';

export default function HomeScreen() {
  const { colors, space, radius, shadow, isDark } = useTheme();
  const router = useRouter();
  const nickname = useAuth((s) => s.session?.user.nickname ?? '');

  const [myGroups, setMyGroups] = useState<MyGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadGroups = useCallback(async () => {
    setError(false);
    try {
      setMyGroups(await fetchMyGroups());
    } catch {
      // fetch 실패를 '잡힌 모임이 없어요' 빈 상태로 위장하지 않는다(W1-7) —
      // 데이터가 없을 때만 EmptyState error로 표출(리스트가 있으면 stale 유지).
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 모임 생성 후 홈 복귀 시 자동 갱신(§11.4) — 포커스마다 refetch(첫 로드만 skeleton).
  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroups();
  }, [loadGroups]);

  const upcomingCount = myGroups.length;
  // '이번 달 모임' 파생값 — now는 호출부에서 KST ISO로 만들어 순수 helper에 주입(D13).
  const nowKstIso = DateTime.now().setZone('Asia/Seoul').toISODate() ?? '';
  const thisMonthCount = countGroupsThisMonthKst(myGroups, nowKstIso);

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
        {/* Header — 알림 벨 제거(R2: 알림함은 차기, 죽은 Alert 노출 방지 §17) */}
        <View
          style={[
            styles.header,
            { paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[3] },
          ]}
        >
          <BrandMark size="sm" />
        </View>

        {/* Greeting — 한글 자간 -0.025em 적용 */}
        <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>
          <Title
            level="h1"
            color={colors.text.primary}
            style={{ fontWeight: '700', letterSpacing: -0.7 }}
          >
            {nickname ? `${nickname}님,` : '안녕하세요,'}
          </Title>
          <Title
            level="h1"
            color={colors.text.primary}
            style={{ marginTop: space[1], fontWeight: '500', letterSpacing: -0.6 }}
          >
            오늘 어떤 모임 잡아볼까요?
          </Title>
        </View>

        {/* Primary CTA — 한 화면 1개의 brand-500 fill (§17.1) */}
        <View style={{ paddingHorizontal: space[4], marginTop: space[6] }}>
          <Pressable
            onPress={() => router.push('/group/new')}
            accessibilityRole="button"
            accessibilityLabel="새 모임 만들기"
            style={({ pressed }) => [
              styles.primaryCard,
              {
                backgroundColor: ctaPressBg(pressed, colors),
                borderRadius: radius.lg,
                paddingHorizontal: space[5],
                paddingVertical: space[5],
              },
              shadow.e2,
            ]}
            testID="create-group-card"
          >
            <View style={{ flex: 1 }}>
              <Caption
                variant="default"
                color="rgba(255,255,255,0.72)"
                style={{ marginBottom: space[1] }}
              >
                바로 시작하기
              </Caption>
              <Body
                variant="bold"
                color={colors.text['on-brand']}
                style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.5 }}
              >
                새 모임 만들기
              </Body>
              <Caption
                variant="default"
                color="rgba(255,255,255,0.84)"
                style={{ marginTop: space[2] }}
              >
                시간 · 장소 · 예약을 한 번에
              </Caption>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="우측 화살표" color={colors.text['on-brand']} size={22} />
            </View>
          </Pressable>
        </View>

        {/* Upcoming section */}
        <View
          style={{
            paddingHorizontal: space[4],
            marginTop: space[8],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Title level="h3" color={colors.text.primary} style={{ letterSpacing: -0.4 }}>
            다가오는 모임
          </Title>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            {/* 0 배지 hide — 카운트 > 0일 때만 (피드백 P1 12) */}
            {upcomingCount > 0 ? (
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  paddingHorizontal: space[2],
                  borderRadius: radius.pill,
                  // 다크: brand-50(6% 알파)은 투명이라 배지가 사라짐 → surface-3(리뷰 confirmed).
                  backgroundColor: isDark ? colors.surface[3] : colors.brand[50],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Caption variant="micro" color={colors.brand[600]} tabularNums>
                  {upcomingCount}
                </Caption>
              </View>
            ) : null}
            {/* S15-mapmode-ui-calendar: "지도로 보기" 진입 */}
            <Pressable
              onPress={() => router.push('/schedule/map')}
              accessibilityRole="button"
              accessibilityLabel="지도로 일정 보기"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="schedule-map-entry"
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Caption variant="default" color={colors.text.secondary}>
                지도로 보기
              </Caption>
              <Icon name="화살표" color={colors.text.tertiary} size={16} />
            </Pressable>
          </View>
        </View>

        {/* 로딩 중 — 스켈레톤 카드 (§11.1) */}
        {loading ? (
          <View style={{ paddingHorizontal: space[4], marginTop: space[3] }} testID="home-loading">
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
        ) : error && myGroups.length === 0 ? (
          <View style={{ paddingHorizontal: space[4], marginTop: space[3] }}>
            <EmptyState
              variant="error"
              title="모임을 불러오지 못했어요"
              body="잠시 후 다시 시도해볼게요."
              cta={{ label: messages.action.retry, onPress: loadGroups }}
              testID="home-error"
            />
          </View>
        ) : /* 모임 목록 (실데이터) 또는 빈 카드 — §11.2 */
        myGroups.length > 0 ? (
          <View style={{ paddingHorizontal: space[4], marginTop: space[3] }}>
            {myGroups.map((g) => {
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
              <Body variant="bold" color={colors.text.primary} style={{ marginBottom: space[1] }}>
                잡힌 모임이 아직 없어요
              </Body>
              <Caption
                variant="default"
                color={colors.text.tertiary}
                style={{ textAlign: 'center', lineHeight: 18 }}
              >
                첫 모임을 만들어볼까요?
              </Caption>
              {/* §11.2 3요소 채우기 — 상단이 이미 brand fill이라 여기선 secondary(§17.1) */}
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

        {/* Stat row — 데이터 있는 '이번 달 모임'만(§17.2 가짜 0 금지). 단일 칩은 콘텐츠 폭 */}
        <View
          style={{
            paddingHorizontal: space[4],
            marginTop: space[8],
            flexDirection: 'row',
          }}
        >
          <StatChip
            label="이번 달 모임"
            value={String(thisMonthCount)}
            suffix="회"
            testID="stat-this-month-value"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({
  label,
  value,
  suffix,
  testID,
}: {
  label: string;
  value: string;
  suffix: string;
  testID?: string;
}) {
  const { colors, space, radius } = useTheme();
  return (
    <View
      style={{
        // 단일 칩이므로 콘텐츠 폭만 차지(전폭 stretch 회피)
        alignSelf: 'flex-start',
        backgroundColor: colors.surface[2],
        borderRadius: radius.md,
        paddingHorizontal: space[4],
        paddingVertical: space[3],
      }}
    >
      <Caption variant="micro" color={colors.text.tertiary} style={{ marginBottom: 2 }}>
        {label}
      </Caption>
      {/* baseline 정렬 보정 — tabular-nums + 같은 line-height */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Title
          level="h2"
          color={colors.text.primary}
          tabularNums
          testID={testID}
          style={{ fontWeight: '700', letterSpacing: -0.4, lineHeight: 26 }}
        >
          {value}
        </Title>
        <Caption
          variant="default"
          color={colors.text.tertiary}
          style={{ marginLeft: space['0.5'], marginBottom: space['0.5'] }}
        >
          {suffix}
        </Caption>
      </View>
    </View>
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
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
