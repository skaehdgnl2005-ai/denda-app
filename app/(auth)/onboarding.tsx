// 3-슬라이드 온보딩 (S01 acceptance).
//
// §17.4 적용: 각 슬라이드에 미니 시각 컴포넌트 — MiniTimeGrid · MiniMap · MiniCalendar.
// "건너뛰기"는 상단 우측 secondary로.

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniCalendar } from '@/components/brand/MiniCalendar';
import { MiniMap } from '@/components/brand/MiniMap';
import { MiniTimeGrid } from '@/components/brand/MiniTimeGrid';
import { ctaPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { authStore } from '@/lib/auth/setup';

type Slide = {
  visual: 'grid' | 'map' | 'calendar';
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    visual: 'grid',
    title: '친구와 시간을 맞춰요',
    body: '시간 위를 손가락으로 쓱 — \n함께 시간을 맞춰가는 모습이 보여요.',
  },
  {
    visual: 'map',
    title: '장소도 같이 정해요',
    body: '지도에서 후보를 함께 고르고\n예약까지 한 번에 진행해요.',
  },
  {
    visual: 'calendar',
    title: '확정하면 끝',
    body: '캘린더에 자동으로 등록되고\n친구들에게 알림이 가요.',
  },
];

export default function OnboardingScreen() {
  const { colors, space, radius } = useTheme();
  const { width } = Dimensions.get('window');
  const [pageIndex, setPageIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const next = Math.round(offsetX / width);
    if (next !== pageIndex) {
      setPageIndex(next);
    }
  };

  const goNext = () => {
    if (pageIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (pageIndex + 1) * width, animated: true });
    } else {
      void complete();
    }
  };

  const complete = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    await authStore.getState().completeOnboarding();
    router.replace('/(tabs)');
  };

  const isLast = pageIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      {/* Top bar — 건너뛰기 */}
      <View style={[styles.topBar, { paddingHorizontal: space[4], paddingTop: space[3] }]}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={complete}
          accessibilityRole="button"
          accessibilityLabel="건너뛰기"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => ({
            paddingHorizontal: space[3],
            paddingVertical: space[2],
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Caption variant="default" color={colors.text.tertiary}>
            건너뛰기
          </Caption>
        </Pressable>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width, alignItems: 'center' }}>
            {/* Mini visual */}
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: space[8],
              }}
            >
              <View
                style={{
                  padding: space[6],
                  borderRadius: radius['2xl'],
                  backgroundColor: colors.surface[2],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {slide.visual === 'grid' && (
                  <MiniTimeGrid cellSize={26} gap={3} animated={i === pageIndex} />
                )}
                {slide.visual === 'map' && <MiniMap width={224} height={150} />}
                {slide.visual === 'calendar' && <MiniCalendar cellSize={28} gap={4} />}
              </View>
            </View>

            {/* Copy */}
            <View style={{ paddingHorizontal: space[6], paddingBottom: space[8] }}>
              <Title
                level="h1"
                color={colors.text.primary}
                style={{
                  textAlign: 'center',
                  fontSize: 26,
                  lineHeight: 34,
                  letterSpacing: -0.7,
                  fontWeight: '700',
                }}
              >
                {slide.title}
              </Title>
              <Body
                variant="primary"
                color={colors.text.secondary}
                style={{
                  marginTop: space[3],
                  lineHeight: 24,
                  textAlign: 'center',
                }}
              >
                {slide.body}
              </Body>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          paddingVertical: space[3],
          gap: space[2],
        }}
      >
        {SLIDES.map((_, i) => {
          const active = i === pageIndex;
          return (
            <View
              key={i}
              style={{
                width: active ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: active ? colors.brand[500] : colors.border.subtle,
              }}
            />
          );
        })}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[5], paddingTop: space[3] }}>
        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? '시작하기' : '다음'}
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: ctaPressBg(pressed, colors),
              borderRadius: radius.md,
            },
          ]}
        >
          <Body variant="bold" color={colors.text['on-brand']}>
            {isLast ? '시작하기' : '다음'}
          </Body>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
