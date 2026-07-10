// S05-screen-confirm — 호스트만 노출되는 모임 확정 CTA.
//
// §17 anti-AI-feel: brand-500 CTA 1개 (다른 CTA는 secondary로). disabled = surface-2 + text-disabled.
// inflight 시 ActivityIndicator + onPress 차단 (D17 더블 탭 UI 추가 방어 — backend도 idempotent).

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ctaPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body } from '@/design/typography';

export interface HostConfirmButtonProps {
  onPress: () => void;
  disabled: boolean;
  inflight: boolean;
  testID?: string;
}

export const HostConfirmButton: React.FC<HostConfirmButtonProps> = ({
  onPress,
  disabled,
  inflight,
  testID,
}) => {
  const { colors, space, radius } = useTheme();
  const isDisabled = disabled || inflight;

  const fg = isDisabled ? colors.text.disabled : colors.text['on-brand'];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="모임 확정"
      accessibilityState={{ disabled: isDisabled, busy: inflight }}
      onPress={() => {
        if (isDisabled) return;
        onPress();
      }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          // disabled/busy면 surface-2, 아니면 pressed에 따라 brand-500↔600 색 전환 (W2-8)
          backgroundColor: isDisabled ? colors.surface[2] : ctaPressBg(pressed, colors),
          borderRadius: radius.md,
          paddingVertical: space[3],
          paddingHorizontal: space[5],
          minHeight: 48, // 터치 타깃 ≥ 44pt (rules/design.md)
        },
      ]}
    >
      <View style={styles.content}>
        {inflight ? (
          <ActivityIndicator
            size="small"
            color={fg}
            testID={testID ? `${testID}-spinner` : undefined}
          />
        ) : null}
        <Body color={fg} style={{ fontWeight: '600' }}>
          모임 확정
        </Body>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
