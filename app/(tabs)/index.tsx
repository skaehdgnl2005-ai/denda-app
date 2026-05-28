// 홈 화면 — §17.2 placeholder 회피 + §17.1 D5 절제.
// 탭바 추가 후 quick action 제거 — 한 화면 한 정보 (토스 풍).
// 보라는 메인 CTA 하나만, 빈 상태 아이콘은 회색.

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { BrandMark } from '@/components/brand/BrandMark';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { useAuth } from '@/lib/auth/setup';

export default function HomeScreen() {
  const { colors, space, radius, shadow } = useTheme();
  const router = useRouter();
  const nickname = useAuth((s) => s.session?.user.nickname ?? '');

  // 더미 — 실제 데이터는 후속 sprint. 0일 때 badge hide 규칙 검증용.
  const upcomingCount = 0;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.surface[0] }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: space[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[3] },
          ]}
        >
          <BrandMark size="sm" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="알림"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.surface[2],
                borderRadius: radius.full,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            testID="notifications-button"
          >
            <Icon name="알림 켜짐" color={colors.text.secondary} size={20} />
          </Pressable>
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
                backgroundColor: colors.brand[500],
                borderRadius: radius.lg,
                paddingHorizontal: space[5],
                paddingVertical: space[5],
                opacity: pressed ? 0.92 : 1,
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
          {/* 0 배지 hide — 카운트 > 0일 때만 (피드백 P1 12) */}
          {upcomingCount > 0 ? (
            <View
              style={{
                minWidth: 24,
                height: 24,
                paddingHorizontal: space[2],
                borderRadius: radius.pill,
                backgroundColor: colors.brand[50],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Caption variant="micro" color={colors.brand[600]} tabularNums>
                {upcomingCount}
              </Caption>
            </View>
          ) : null}
        </View>

        {/* Empty card — §11.2. 아이콘 컨테이너는 회색(D5 절제) */}
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
              위에서 새 모임을 만들면{'\n'}여기에 다가오는 일정이 표시돼요.
            </Caption>
          </View>
        </View>

        {/* Stat row */}
        <View
          style={{
            paddingHorizontal: space[4],
            marginTop: space[8],
            flexDirection: 'row',
            gap: space[3],
          }}
        >
          <StatChip label="이번 달 모임" value="0" suffix="회" />
          <StatChip label="함께한 친구" value="0" suffix="명" />
          <StatChip label="노쇼" value="0" suffix="회" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  const { colors, space, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface[2],
        borderRadius: radius.md,
        paddingHorizontal: space[3],
        paddingVertical: space[3],
      }}
    >
      <Caption variant="micro" color={colors.text.tertiary} style={{ marginBottom: 2 }}>
        {label}
      </Caption>
      {/* baseline 정렬 보정 — tabular-nums + 같은 line-height */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Title
          level="h3"
          color={colors.text.primary}
          tabularNums
          style={{ fontWeight: '700', letterSpacing: -0.3, lineHeight: 22 }}
        >
          {value}
        </Title>
        <Caption
          variant="default"
          color={colors.text.tertiary}
          style={{ marginLeft: 3, marginBottom: 2 }}
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
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
});
