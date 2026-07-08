// 인디터미닛 스피너 (DESIGN §11.1). Lucide loader-2(=LoaderCircle) 24pt(인라인 16pt),
// text-brand, 1초 linear 무한 회전. 모션 감소(§6.4) 시 회전 없이 정적 표시.
// 액션 진행(버튼 loading·시트 busy 등)에 사용. 첫 fetch·리스트는 Skeleton을 쓴다.
import React, { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { LoaderCircle } from 'lucide-react-native';

import { useTheme } from '@/design/theme';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

const ROTATION_MS = 1000; // §11.1 명시 값 (1s linear)

export interface SpinnerProps {
  /** 24pt 기본, 인라인(버튼 내부 등) 16pt */
  size?: number;
  /** 기본 text-brand */
  color?: string;
  /** 버튼 등에 임베드 시 true — 부모가 busy를 전달하므로 스피너는 무음 처리 (중복 안내 방지) */
  decorative?: boolean;
  testID?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 24,
  color,
  decorative = false,
  testID,
}) => {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: ROTATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [spin, reduced]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const iconColor = color ?? colors.text.brand;

  return (
    <Animated.View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={decorative ? undefined : '불러오는 중'}
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: reduced ? [] : [{ rotate }],
      }}
    >
      <LoaderCircle color={iconColor} size={size} strokeWidth={2} />
    </Animated.View>
  );
};
