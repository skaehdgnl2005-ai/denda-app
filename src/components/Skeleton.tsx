// 로딩 스켈레톤 (DESIGN §11.1). surface-3 블록 + 부드러운 opacity 펄스.
// "데이터 없음" 빈 텍스트 대신 콘텐츠 모양을 미리 보여 체감 속도를 높인다.
// 토큰만 사용 (hex 금지). 모션 감소(§6.4) 시 펄스를 멈추고 정적 표시.
import React, { useEffect, useState } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/design/theme';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** borderRadius (기본 radius.md) */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius,
  style,
  testID,
}) => {
  const { colors, radius, duration } = useTheme();
  const reduced = useReducedMotion();
  // 안정적 인스턴스 1회 생성 (ref 대신 lazy useState — render 중 ref.current 접근 회피).
  const [pulse] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    if (reduced) {
      // 모션 감소: 무한 펄스 대신 정적 표시 (§6.4)
      pulse.setValue(0.7);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: duration.long,
          easing: motionEasing.standard,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: duration.long,
          easing: motionEasing.standard,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, reduced, duration.long]);

  return (
    <Animated.View
      testID={testID}
      accessible={false}
      style={[
        {
          width,
          height,
          borderRadius: borderRadius ?? radius.md,
          backgroundColor: colors.surface[3],
          opacity: pulse,
        },
        style,
      ]}
    />
  );
};
