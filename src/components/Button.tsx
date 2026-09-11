// 공용 버튼 (W0-1). CTA 5벌+ 중복을 대체하는 단일 프리미티브.
// variant: primary(brand fill)·secondary(테두리)·ghost(surface fill)·destructive(§10.6 절제)·kakao.
// - disabled: surface-2 + text-tertiary 죽은 회색 (§17.5 revised). 눌러도 onPress 미발생 + 0.1 overlay.
// - loading: 인라인 스피너 + 라벨 유지 (§11.1). onPress 차단.
// - pressed: opacity가 아닌 색 전환 (§9.1, 사실상 instant).
// 토큰만 사용 (Kakao 공식색은 외부 OAuth 가이드라인이라 예외 — login.tsx와 동일 근거).
import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Spinner } from '@/components/Spinner';
import { useTheme } from '@/design/theme';
import { Body } from '@/design/typography';

// 카카오 공식 컬러 (DESIGN 토큰 밖 — 외부 SDK 가이드라인).
const KAKAO_FILL = 'rgba(254, 229, 0, 1)';
const KAKAO_LABEL = 'rgba(0, 0, 0, 0.85)';
// disabled/kakao press 피드백 — §17.5 "0→0.1 opacity overlay".
const PRESS_OVERLAY = 'rgba(0, 0, 0, 0.1)';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'kakao';
export type ButtonSize = 'lg' | 'md';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** lg=56pt(주요 CTA) · md=48pt(시트 내) */
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** 기본 true — CTA는 폭 채움. inline 버튼은 false */
  fullWidth?: boolean;
  leftIcon?: IconName;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface Palette {
  bg: string;
  fg: string;
  border: string;
}

export function buttonPalette(
  variant: ButtonVariant,
  colors: ReturnType<typeof useTheme>['colors'],
  pressed: boolean,
  disabled: boolean,
): Palette {
  if (disabled) {
    return { bg: colors.surface[2], fg: colors.text.tertiary, border: 'transparent' };
  }
  switch (variant) {
    case 'primary':
      return {
        bg: pressed ? colors.brand[600] : colors.brand[500],
        fg: colors.text['on-brand'],
        border: 'transparent',
      };
    case 'secondary':
      return {
        bg: pressed ? colors.surface[2] : colors.surface[1],
        fg: colors.text.primary,
        border: colors.border.subtle,
      };
    case 'ghost':
      return {
        bg: pressed ? colors.surface[3] : colors.surface[2],
        fg: colors.text.primary,
        border: 'transparent',
      };
    case 'destructive':
      // 라이트 모드에서 error.bg(연분홍)가 흰 시트 위에 사실상 안 보이므로 error.border로
      // 버튼 경계를 명시 (§12.2 형태 인지, 리뷰 #10).
      return {
        bg: pressed ? colors.semantic.error.border : colors.semantic.error.bg,
        fg: colors.semantic.error.fg,
        border: colors.semantic.error.border,
      };
    case 'kakao':
      return { bg: KAKAO_FILL, fg: KAKAO_LABEL, border: 'transparent' };
  }
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = true,
  leftIcon,
  accessibilityLabel,
  testID,
  style,
}) => {
  const { colors, radius, space } = useTheme();
  const inert = disabled || loading;
  const height = size === 'lg' ? 56 : 48;
  // kakao·disabled는 색 전환 대신 overlay로 press 피드백 (§17.5). loading 중엔 press 피드백 0.
  const usesOverlay = disabled || variant === 'kakao';
  const colorPressed = (pressed: boolean): boolean => pressed && !usesOverlay && !loading;
  const overlayPressed = (pressed: boolean): boolean => usesOverlay && pressed && !loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy: loading }}
      onPress={() => {
        if (!inert) onPress();
      }}
      style={({ pressed }) => {
        const pal = buttonPalette(variant, colors, colorPressed(pressed), disabled);
        return [
          {
            height,
            width: fullWidth ? '100%' : undefined,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space[5],
            borderRadius: radius.md,
            backgroundColor: pal.bg,
            borderWidth: pal.border === 'transparent' ? 0 : 1,
            borderColor: pal.border,
          },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const pal = buttonPalette(variant, colors, colorPressed(pressed), disabled);
        return (
          <>
            {loading ? (
              <View style={{ marginRight: space[2] }}>
                <Spinner
                  size={16}
                  color={pal.fg}
                  decorative
                  testID={testID ? `${testID}-spinner` : undefined}
                />
              </View>
            ) : leftIcon ? (
              <View style={{ marginRight: space[2] }}>
                <Icon name={leftIcon} color={pal.fg} size={20} />
              </View>
            ) : null}
            <Body variant="bold" color={pal.fg}>
              {label}
            </Body>
            {overlayPressed(pressed) ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  borderRadius: radius.md,
                  backgroundColor: PRESS_OVERLAY,
                }}
              />
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
};
