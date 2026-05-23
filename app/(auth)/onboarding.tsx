// 3-슬라이드 온보딩 (S01 acceptance).
//
// 가치 제안 3가지:
//   1. 친구와 시간 조율 (60fps 시간 그리드)
//   2. 장소 함께 정하기 (지도 + 제휴 마커)
//   3. 모임 확정 + 캘린더 자동 등록
//
// "건너뛰기" 항상 노출 (P0/P1 페르소나 모두 빠르게 진입 가능).
// 마지막 슬라이드는 "시작하기" CTA.
//
// 정식 일러스트는 S11 + D-ONBOARD-MOTION (sprint 2 design asset)에서 — 현재는
// 텍스트만으로 흐름을 검증.

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { authStore } from '@/lib/auth/setup';

const TEXT_PRIMARY = 'rgba(0, 0, 0, 0.87)';
const TEXT_SECONDARY = 'rgba(0, 0, 0, 0.6)';
// brand-500 (D5) — S11에서 tokens.light.brand[500] 참조로 교체
const CTA_ENABLED = 'rgba(124, 58, 237, 1)';
const DOT_INACTIVE = 'rgba(0, 0, 0, 0.16)';

type Slide = {
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    title: '친구와 시간을 맞춰요',
    body: '시간 그리드 위에 손가락으로 쓱.\n7명까지 동시 투표를 볼 수 있어요.',
  },
  {
    title: '장소도 같이 정해요',
    body: '지도 위에서 후보를 골라\n예약까지 한 번에 진행할 수 있어요.',
  },
  {
    title: '모임을 확정하면',
    body: '캘린더에 자동으로 추가되고\n친구들도 알림을 받아요.',
  },
];

export default function OnboardingScreen() {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 16,
          paddingTop: 12,
        }}
      >
        <Pressable
          onPress={complete}
          accessibilityRole="button"
          accessibilityLabel="건너뛰기"
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            minHeight: 44,
            minWidth: 44,
            justifyContent: 'center',
            alignItems: 'flex-end',
          })}
        >
          <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>건너뛰기</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <View
            key={i}
            style={{
              width,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
            }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: '700',
                color: TEXT_PRIMARY,
                letterSpacing: -0.5,
                textAlign: 'center',
              }}
            >
              {slide.title}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: TEXT_SECONDARY,
                marginTop: 16,
                lineHeight: 24,
                textAlign: 'center',
              }}
            >
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          paddingVertical: 16,
          gap: 8,
        }}
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === pageIndex ? CTA_ENABLED : DOT_INACTIVE,
            }}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? '시작하기' : '다음'}
          style={({ pressed }) => ({
            backgroundColor: CTA_ENABLED,
            opacity: pressed ? 0.9 : 1,
            minHeight: 52,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
            {isLast ? '시작하기' : '다음'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
