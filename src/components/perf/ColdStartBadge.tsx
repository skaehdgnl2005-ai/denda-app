import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/design/theme';
import { Caption } from '@/design/typography';
import {
  getAppColdStartTracker,
  isPerfOverlayEnabled,
  type ColdStartMeasurement,
  type ColdStartTracker,
} from '@/lib/perf/coldStart';

export interface ColdStartBadgeProps {
  /** 노출 여부. 기본: dev 빌드 또는 EXPO_PUBLIC_PERF_OVERLAY === '1' (preview/internal). */
  enabled?: boolean;
  /** 측정 tracker 주입 (테스트). 기본: 앱 전역 singleton. */
  tracker?: ColdStartTracker;
}

/**
 * cold-start 측정값(D25)을 화면 상단 pill로 띄우는 dev 배지. adb 없이 실기기에서 판독.
 * production 빌드는 PERF_OVERLAY env 미주입 → enabled=false → 렌더 안 함 (UX 영향 0).
 */
export function ColdStartBadge({
  enabled = isPerfOverlayEnabled(__DEV__, process.env.EXPO_PUBLIC_PERF_OVERLAY),
  tracker,
}: ColdStartBadgeProps): React.JSX.Element | null {
  const { colors, space, radius, zIndex } = useTheme();
  const activeTracker = tracker ?? getAppColdStartTracker();
  // 첫 렌더 = 폰트 로드 후(_layout이 그 전까지 null) → interactive 시점. markInteractive는
  // idempotent라 _layout 쪽 호출과 충돌 없음. lazy initializer로 1회만 측정 (effect 불필요).
  const [measurement] = useState<ColdStartMeasurement>(() => activeTracker.markInteractive());

  if (!enabled) {
    return null;
  }

  const tone = measurement.withinBudget ? colors.semantic.success : colors.semantic.warning;
  const marker = measurement.withinBudget ? '✅' : '⚠️';
  const ms = measurement.durationMs.toFixed(0);
  const label = `${marker} 콜드스타트 ${ms}ms / ${measurement.budgetMs}ms`;
  const a11yLabel = `콜드스타트 ${ms}밀리초, ${
    measurement.withinBudget ? '예산 내' : '예산 초과'
  } (기준 ${measurement.budgetMs}밀리초)`;

  return (
    <View
      testID="cold-start-badge"
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      style={[
        styles.container,
        {
          top: space[12],
          paddingVertical: space[1],
          paddingHorizontal: space[3],
          borderRadius: radius.full,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          zIndex: zIndex.modal,
        },
      ]}
    >
      <Caption variant="micro" color={tone.fg} tabularNums>
        {label}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1,
  },
});
