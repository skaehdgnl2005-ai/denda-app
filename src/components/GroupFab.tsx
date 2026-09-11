// 중앙 '모임 만들기' FAB (W2-3, §10.7 — IA 4탭+FAB의 FAB).
//
// 글리프 = Lucide 캘린더(base) + 더하기(코너 badge) 코드 합성. PNG 자산 0
// (MapMarkerView/D40 뷰 합성 선례). §10.7: 56pt · radius-md(둥근 사각형, 원형 아님 —
// 슬롯 모양 토스 풍 차별화) · brand-500 fill(D5 sanctioned, 모임 만들기 primary CTA) ·
// elevation e4 · press scale 0.96(instant). reduce-motion 시 정적(§6.4).
//
// 위치(탭바 위 16pt notch)는 소비처((tabs)/_layout)가 absolute로 배치 — 본 컴포넌트는 버튼만.
import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

const SIZE = 56;

export interface GroupFabProps {
  /** 기본 동작(/group/new 이동)을 대체할 핸들러. 없으면 라우터로 이동. */
  onPress?: () => void;
  testID?: string;
}

export const GroupFab: React.FC<GroupFabProps> = ({ onPress, testID = 'group-fab' }) => {
  const { colors, radius, duration, shadow, zIndex } = useTheme();
  const reduced = useReducedMotion();
  const router = useRouter();
  const [scale] = useState(() => new Animated.Value(1));

  const glyphColor = colors.text['on-brand'];

  const animateTo = (toValue: number): void => {
    if (reduced) return;
    Animated.timing(scale, {
      toValue,
      duration: duration.instant,
      easing: motionEasing.standard,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (): void => {
    if (onPress) {
      onPress();
      return;
    }
    router.push('/group/new');
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      onPressIn={() => animateTo(0.96)}
      onPressOut={() => animateTo(1)}
      accessibilityRole="button"
      accessibilityLabel="새 모임 만들기"
      style={{ zIndex: zIndex.fab }}
    >
      <Animated.View
        testID={`${testID}-body`}
        style={[
          styles.body,
          shadow.e4,
          {
            width: SIZE,
            height: SIZE,
            borderRadius: radius.md,
            backgroundColor: colors.brand[500],
            transform: reduced ? [] : [{ scale }],
          },
        ]}
      >
        <View testID={`${testID}-calendar`}>
          <Icon name="캘린더" color={glyphColor} size={26} />
        </View>
        <View testID={`${testID}-plus`} style={styles.plusBadge}>
          <Icon name="더하기" color={glyphColor} size={16} />
        </View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
  },
});
