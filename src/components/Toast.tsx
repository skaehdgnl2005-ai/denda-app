// 토스트 (W0-2). Alert.alert 성공/안내 피드백을 디자인 시스템 안에서 처리 (§11.3 금지 대체).
// e3, surface-1 + border-subtle, radius-md. in/out = duration-short + enter/exit (§6.5).
// variant default/success/error — 시맨틱은 색 + 아이콘 + 좌측 스트라이프 3중 신호 (§12.6).
// 선택 액션 버튼("보러 가기"). 모션 감소 시 슬라이드 없이 페이드/즉시.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body } from '@/design/typography';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

export type ToastVariant = 'default' | 'success' | 'error';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  action?: { label: string; onPress: () => void };
  /** 자동 소멸까지 ms (기본 3200) */
  durationMs?: number;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const DEFAULT_DURATION = 3200;
let toastSeq = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);

  const show = useCallback((opts: ToastOptions) => {
    toastSeq += 1;
    setToast({ ...opts, id: toastSeq });
  }, []);

  const handleDismiss = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? <ToastView key={toast.id} {...toast} onDismiss={handleDismiss} /> : null}
    </ToastContext.Provider>
  );
};

interface ToastViewProps extends ToastOptions {
  onDismiss: () => void;
}

const ToastView: React.FC<ToastViewProps> = ({
  message,
  variant = 'default',
  action,
  durationMs = DEFAULT_DURATION,
  onDismiss,
}) => {
  const { colors, radius, space, shadow, duration, zIndex } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const enterMs = reduced ? 0 : duration.short;

    // 스크린리더 안내 — accessibilityRole="alert"만으론 iOS VoiceOver가 마운트 시 읽지
    // 않으므로(RN 한계) 두 플랫폼 모두 확실히 읽히도록 명시 안내 (§12.3, Alert 대체).
    AccessibilityInfo.announceForAccessibility(message);

    Animated.timing(anim, {
      toValue: 1,
      duration: enterMs,
      easing: motionEasing.enter,
      useNativeDriver: true,
    }).start();

    timers.push(
      setTimeout(() => {
        Animated.timing(anim, {
          toValue: 0,
          duration: enterMs,
          easing: motionEasing.exit,
          useNativeDriver: true,
        }).start();
        timers.push(setTimeout(onDismiss, enterMs));
      }, durationMs),
    );

    return () => timers.forEach(clearTimeout);
  }, [anim, durationMs, reduced, duration.short, onDismiss, message]);

  const accent =
    variant === 'success'
      ? colors.semantic.success
      : variant === 'error'
        ? colors.semantic.error
        : null;
  const iconName: IconName | null =
    variant === 'success' ? '성공' : variant === 'error' ? '경고' : null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + space[2],
        left: space[4],
        right: space[4],
        zIndex: zIndex.modal,
      }}
    >
      <Animated.View
        testID="toast"
        // action이 있으면 컨테이너를 하나로 병합하지 않는다 — 안 그러면 '보러 가기'
        // Pressable이 독립 포커스를 잃는다(§12.3). 메시지 안내는 announceForAccessibility가 담당.
        accessible={action ? undefined : true}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          paddingVertical: space[3],
          paddingHorizontal: space[4],
          backgroundColor: colors.surface[1],
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border.subtle,
          borderLeftWidth: accent ? 3 : 1,
          borderLeftColor: accent ? accent.solid : colors.border.subtle,
          opacity: anim,
          transform: reduced ? [] : [{ translateY }],
          ...shadow.e3,
        }}
      >
        {iconName && accent ? (
          <View testID="toast-icon">
            <Icon name={iconName} color={accent.fg} size={20} />
          </View>
        ) : null}
        <Body variant="sm" color={colors.text.primary} style={{ flex: 1 }}>
          {message}
        </Body>
        {action ? (
          <Pressable
            testID="toast-action"
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={{ minHeight: 44, justifyContent: 'center' }}
            onPress={() => {
              action.onPress();
              onDismiss();
            }}
          >
            <Body variant="sm-bold" color={colors.text.brand}>
              {action.label}
            </Body>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
};
