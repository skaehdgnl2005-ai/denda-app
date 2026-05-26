// S06-ui-reauth-modal — Google 캘린더 재인증 안내 모달.
//
// 노출 trigger: 프로필 화면 mount 시 `isGoogleReauthNeeded(supabase, userId)` true 반환 시.
// 원인:
//   - 사용자가 FirstTimeModal에서 Google 선택했지만 OAuth 중 cancelled
//   - worker가 invalid_grant 받아 user_oauth_tokens row 삭제 (refresh token revoke)
//   - 사용자가 Google 계정에서 직접 token revoke
//
// "다시 로그인" → signInGoogle (setup.ts signInGoogleAndUpload wrapper) → 성공 시 onSuccess
// 콜백 (parent에서 화면 refresh 또는 state clear) + 모달 close. worker 다음 tick에서 retry
// 자동 재시도 (calendar_retry_count가 max 미만이라면). max 초과 시 캘린더 push 영구 실패 —
// 베타 한정 founder weekly review로 hand-off (별도 sub-task로 retry_count reset RPC 검토).
//
// §17 anti-AI-feel:
//   - brand-500 fill "다시 로그인" CTA 1개 + secondary "나중에"
//   - 친근체 "Google 캘린더 연결이 끊겼어요"
//   - error.fg 시맨틱 컬러로 상태 신호 + 아이콘 동반 가능 (현 베타 텍스트만)

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';
import { CalendarProviderError } from '@/lib/calendar/google';

export interface ReauthModalProps {
  visible: boolean;
  onClose: () => void;
  /** production: setup.ts::signInGoogleAndUpload wrapper. */
  signInGoogle: () => Promise<void>;
  /** reauth 성공 시 호출 — parent가 isGoogleReauthNeeded 재실행해 모달 상태 갱신 등. */
  onSuccess?: () => void;
}

function mapErrorToKorean(err: unknown): { silent: boolean; message: string } {
  if (err instanceof CalendarProviderError) {
    switch (err.detail.kind) {
      case 'cancelled':
        return { silent: true, message: '' };
      case 'unauthorized':
        return { silent: false, message: '캘린더 권한이 필요해요. 다시 시도해 주세요.' };
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

export const ReauthModal: React.FC<ReauthModalProps> = ({
  visible,
  onClose,
  signInGoogle,
  onSuccess,
}) => {
  const { colors, space, radius } = useTheme();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!visible) return null;

  const handleClose = (): void => {
    setBusy(false);
    setErrorMsg(null);
    onClose();
  };

  const handleReauth = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await signInGoogle();
      onSuccess?.();
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

  const reauthBg = busy ? colors.surface[2] : colors.brand[500];
  const reauthFg = busy ? colors.text.disabled : colors.text['on-brand'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      testID="reauth-modal"
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
          <Title level="h2" color={colors.text.primary}>
            Google 캘린더 연결이 끊겼어요
          </Title>
          <Body
            variant="sm"
            color={colors.text.secondary}
            style={{ marginTop: space[2], marginBottom: space[2] }}
          >
            모임이 확정되면 자동으로 캘린더에 추가해드리려면 다시 로그인이 필요해요.
          </Body>

          {errorMsg !== null ? (
            <Body
              variant="sm"
              color={colors.semantic.error.fg}
              testID="reauth-error-message"
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
              accessibilityLabel="나중에 다시 로그인"
              testID="reauth-later-button"
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
              onPress={handleReauth}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Google 다시 로그인"
              accessibilityState={{ disabled: busy, busy }}
              testID="reauth-button"
              style={({ pressed }) => [
                styles.button,
                {
                  flex: 1,
                  borderRadius: radius.md,
                  paddingVertical: space[3],
                  backgroundColor: reauthBg,
                  opacity: pressed && !busy ? 0.85 : 1,
                },
              ]}
            >
              <Body variant="bold" color={reauthFg}>
                {busy ? '연결 중...' : '다시 로그인'}
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
