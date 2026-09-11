// 공용 확인 바텀시트 (W0-3, §10.3). Alert 확인류(로그아웃·차단·장소 확정 등)를 대체.
// radius-2xl 상단 + grabber(36×4 surface-3) + e3 + backdrop 탭 닫기 + medium enter/exit.
// 타이틀(title-3) + 본문(body-sm) + 버튼 페어(ghost 취소 / primary·destructive 확정).
// backdrop은 overlay.scrim 토큰. 모션 감소 시 슬라이드 없이 즉시.
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

const SLIDE_DISTANCE = 480; // 시트를 화면 아래에서 밀어 올리는 거리 (측정 대신 충분값)

export interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  /** 확정이 파괴적(로그아웃·차단·삭제)이면 error 팔레트 */
  destructive?: boolean;
  /** 확정 진행 중 — 확정 버튼 인라인 스피너 */
  loading?: boolean;
  /** 타이틀/본문과 버튼 사이 커스텀 콘텐츠 (장소 카드 등) */
  children?: React.ReactNode;
  testID?: string;
}

export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  visible,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
  cancelLabel = '취소',
  destructive = false,
  loading = false,
  children,
  testID,
}) => {
  const { colors, radius, space, shadow, duration } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(0));

  // 확정 진행 중(loading)엔 backdrop 탭·하드웨어 back·취소로 닫히지 않게 막는다 — 절반만
  // 처리된 작업(예: 탈퇴 RPC 진행 중) 이탈 방지 (리뷰 #8).
  const handleDismiss = useCallback(() => {
    if (loading) return;
    onClose();
  }, [loading, onClose]);

  // 열릴 때만 슬라이드-업(§6.5 바텀시트 up). 닫힘은 Modal 언마운트(즉시) — 후속 폴리시로
  // reanimated exiting 도입 seam. setState-in-effect 없이 Animated만 구동.
  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: reduced ? 0 : duration.medium,
      easing: motionEasing.enter,
      useNativeDriver: true,
    }).start();
  }, [visible, reduced, duration.medium, anim]);

  if (!visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [SLIDE_DISTANCE, 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          // backdrop은 시트 콘텐츠보다 먼저 렌더되지만, 시트의 accessibilityViewIsModal이
          // 모달 subtree를 격리해 스크린리더가 형제인 backdrop을 건너뛰고 타이틀부터 읽는다 (리뷰 #5).
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: anim }}
        >
          <Pressable
            testID={testID ? `${testID}-backdrop` : undefined}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={handleDismiss}
            style={{ flex: 1, backgroundColor: colors.overlay.scrim }}
          />
        </Animated.View>

        <Animated.View
          testID={testID ? `${testID}-sheet` : undefined}
          accessibilityViewIsModal
          style={{
            transform: reduced ? [] : [{ translateY }],
            backgroundColor: colors.surface[1],
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingHorizontal: space[5],
            paddingTop: space[2],
            paddingBottom: insets.bottom + space[4],
            ...shadow.e3,
          }}
        >
          <View
            testID={testID ? `${testID}-grabber` : undefined}
            style={{
              width: 36,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: colors.surface[3],
              alignSelf: 'center',
              marginBottom: space[4],
            }}
          />

          <Title level="h3" color={colors.text.primary}>
            {title}
          </Title>
          {message ? (
            <Body variant="sm" color={colors.text.secondary} style={{ marginTop: space[2] }}>
              {message}
            </Body>
          ) : null}

          {children ? <View style={{ marginTop: space[4] }}>{children}</View> : null}

          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[6] }}>
            <View style={{ flex: 1 }}>
              <Button
                label={cancelLabel}
                onPress={handleDismiss}
                variant="ghost"
                size="md"
                disabled={loading}
                testID={testID ? `${testID}-cancel` : undefined}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={confirmLabel}
                onPress={onConfirm}
                variant={destructive ? 'destructive' : 'primary'}
                size="md"
                loading={loading}
                testID={testID ? `${testID}-confirm` : undefined}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};
