// S06-ui-first-time-modal — 첫 모임 확정 후 "어디에 추가할까요?" 모달.
//
// 책임:
//   - 4가지 옵션 (Google / iCloud / 둘 다 / 안 함) 선택 UI
//   - 확인 → 선택된 provider sign-in/permission + users.calendar_preference UPDATE
//   - 에러 분기: cancelled = silent close, unauthorized/network/기타 = 한국어 메시지 + 모달 유지
//   - 나중에 → DB update 없이 close (다음 모임 확정 시 다시 표시)
//
// trigger 위치 결정: app/group/[id]/index.tsx confirmGroup 성공 분기 + users.calendar_preference IS NULL
//   → 본 컴포넌트 호출 측이 visible/userId/supabase/콜백 주입
//
// §17 anti-AI-feel:
//   - brand-500 fill CTA 1개 (확인) + secondary "나중에"
//   - 선택된 옵션 = border-focus + brand-50 배경 (소속감)
//   - 친근체 "어디에 추가할까요?" + 옵션 라벨도 친근체
//   - disabled = surface-2 + text-disabled (옵션 미선택 시 확인 비활성)

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SupabaseClient } from '@supabase/supabase-js';

import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { CalendarProviderError } from '@/lib/calendar/google';

export type CalendarPreference = 'google' | 'apple_ios' | 'both' | 'none';

interface OptionDef {
  key: CalendarPreference;
  label: string;
  description: string;
}

const OPTIONS: OptionDef[] = [
  {
    key: 'google',
    label: 'Google 캘린더',
    description: '구글 계정 연결 후 자동 추가',
  },
  {
    key: 'apple_ios',
    label: 'iCloud 캘린더',
    description: 'iPhone 기본 캘린더에 자동 추가',
  },
  {
    key: 'both',
    label: '둘 다',
    description: 'Google + iCloud 모두 추가',
  },
  {
    key: 'none',
    label: '안 할래요',
    description: '캘린더에 추가하지 않음',
  },
];

export interface FirstTimeModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  supabase: SupabaseClient;
  /** production: setup.ts::signInGoogleAndUpload wrapper. */
  signInGoogle: () => Promise<void>;
  /** production: setup.ts::createAppleCalendarProvider().requestPermission wrapper. */
  requestApplePermission: () => Promise<void>;
}

function mapErrorToKorean(err: unknown): { silent: boolean; message: string } {
  if (err instanceof CalendarProviderError) {
    switch (err.detail.kind) {
      case 'cancelled':
        return { silent: true, message: '' };
      case 'unauthorized':
        return { silent: false, message: '캘린더 권한이 필요해요. 설정에서 허용해 주세요.' };
      case 'token_expired':
        return { silent: false, message: '인증이 만료되었어요. 다시 시도해 주세요.' };
      case 'rate_limit':
        return { silent: false, message: '요청이 많아요. 잠시 후 다시 시도해 주세요.' };
      case 'network':
        return { silent: false, message: '네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.' };
      case 'unknown':
        return { silent: false, message: '캘린더 연결 중 오류가 발생했어요.' };
    }
  }
  return { silent: false, message: '캘린더 연결 중 오류가 발생했어요.' };
}

export const FirstTimeModal: React.FC<FirstTimeModalProps> = ({
  visible,
  onClose,
  userId,
  supabase,
  signInGoogle,
  requestApplePermission,
}) => {
  const { colors, space, radius } = useTheme();
  const [selected, setSelected] = useState<CalendarPreference | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!visible) return null;

  const handleClose = (): void => {
    setSelected(null);
    setBusy(false);
    setErrorMsg(null);
    onClose();
  };

  const handleConfirm = async (): Promise<void> => {
    if (busy || selected === null) return;
    setBusy(true);
    setErrorMsg(null);

    try {
      if (selected === 'google' || selected === 'both') {
        await signInGoogle();
      }
      if (selected === 'apple_ios' || selected === 'both') {
        await requestApplePermission();
      }

      const { error } = await supabase
        .from('users')
        .update({ calendar_preference: selected })
        .eq('id', userId);
      if (error) {
        setErrorMsg('설정 저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
        setBusy(false);
        return;
      }

      handleClose();
    } catch (err) {
      const { silent, message } = mapErrorToKorean(err);
      if (silent) {
        handleClose();
        return;
      }
      setErrorMsg(message);
      setBusy(false);
    }
  };

  const confirmDisabled = selected === null || busy;
  const confirmBg = confirmDisabled ? colors.surface[2] : colors.brand[500];
  const confirmFg = confirmDisabled ? colors.text.disabled : colors.text['on-brand'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      testID="first-time-modal"
    >
      <View
        style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}
        accessibilityViewIsModal
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface[1],
              borderRadius: radius.xl,
              padding: space[5],
              marginHorizontal: space[4],
              borderColor: colors.border.subtle,
            },
          ]}
        >
          <Title level="h2" color={colors.text.primary} style={styles.heading}>
            어디에 추가할까요?
          </Title>
          <Body
            variant="sm"
            color={colors.text.secondary}
            style={{ marginTop: space[2], marginBottom: space[4] }}
          >
            모임이 확정되면 자동으로 캘린더에 추가해드려요.
          </Body>

          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setSelected(opt.key);
                  setErrorMsg(null);
                }}
                accessibilityRole="radio"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected: isSelected, disabled: busy }}
                disabled={busy}
                testID={`option-${opt.key}`}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.border.focus : colors.border.subtle,
                    backgroundColor: isSelected ? colors.brand[50] : colors.surface[1],
                    paddingVertical: space[3],
                    paddingHorizontal: space[4],
                    marginBottom: space[2],
                    opacity: pressed && !busy ? 0.7 : 1,
                  },
                ]}
              >
                <Body
                  variant="bold"
                  color={isSelected ? colors.text.brand : colors.text.primary}
                >
                  {opt.label}
                </Body>
                <Caption color={colors.text.tertiary} style={{ marginTop: space[1] }}>
                  {opt.description}
                </Caption>
              </Pressable>
            );
          })}

          {errorMsg !== null ? (
            <Body
              variant="sm"
              color={colors.semantic.error.fg}
              testID="error-message"
              style={{ marginTop: space[2], marginBottom: space[2] }}
            >
              {errorMsg}
            </Body>
          ) : null}

          <View style={[styles.footer, { marginTop: space[4], gap: space[2] }]}>
            <Pressable
              onPress={handleClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="나중에 설정하기"
              testID="later-button"
              style={({ pressed }) => [
                styles.button,
                {
                  flex: 1,
                  borderRadius: radius.md,
                  paddingVertical: space[3],
                  backgroundColor: colors.surface[2],
                  opacity: pressed && !busy ? 0.7 : 1,
                },
              ]}
            >
              <Body variant="bold" color={colors.text.secondary}>
                나중에
              </Body>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={confirmDisabled}
              accessibilityRole="button"
              accessibilityLabel="확인"
              accessibilityState={{ disabled: confirmDisabled, busy }}
              testID="confirm-button"
              style={({ pressed }) => [
                styles.button,
                {
                  flex: 1,
                  borderRadius: radius.md,
                  paddingVertical: space[3],
                  backgroundColor: confirmBg,
                  opacity: pressed && !confirmDisabled ? 0.85 : 1,
                },
              ]}
            >
              <Body variant="bold" color={confirmFg}>
                {busy ? '연결 중...' : '확인'}
              </Body>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
  },
  heading: {
    textAlign: 'left',
  },
  optionRow: {
    alignItems: 'flex-start',
    minHeight: 48,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});
