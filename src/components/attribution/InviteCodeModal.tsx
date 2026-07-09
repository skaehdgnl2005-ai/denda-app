// S15-deeplink-rn-fallback — 4자리 invite_code 입력 모달.
//
// 트리거: 비로그인 사용자 또는 모임 멤버 아닌 사용자의 앱 첫 실행 시.
//   Universal Links + fingerprint 매칭 둘 다 miss 후 fallback.
// 동작:
//   1. 4자리 numeric 입력 (입력 자동 filter — non-numeric 제거, 4자리 truncate)
//   2. 확인 → resolveAttribution({mode:'invite_code', code}) Edge Function 호출
//   3. matched=true → onSuccess(groupId, guestToken) — 모임 list refresh
//      matched=false → 한국어 에러 메시지 노출 + 모달 유지 (재시도)
//   4. 건너뛰기 → Alert 확인 ("나중에 코드로 합류할 수 있어요") → onSkip
//
// §17 anti-AI-feel + DESIGN.md 토큰:
//   - brand-500 fill CTA 1개 (확인)
//   - secondary "건너뛰기" surface-2
//   - tabular-nums 4자리 코드 (정렬감)
//   - 친근체 한국어

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { isValidInviteCode } from '@/lib/branch/inviteCode';
import type { ResolveArgs, ResolveResult } from '@/lib/branch/attributionApi';

export interface InviteCodeModalProps {
  visible: boolean;
  onSuccess: (groupId: string, guestToken: string | null) => void;
  onSkip: () => void;
  /** production: (args) => resolveAttribution(supabase, args). 테스트 DI. */
  resolve: (args: ResolveArgs) => Promise<ResolveResult>;
}

function sanitizeCodeInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, 4);
}

export const InviteCodeModal: React.FC<InviteCodeModalProps> = ({
  visible,
  onSuccess,
  onSkip,
  resolve,
}) => {
  const { colors, space, radius } = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  if (!visible) return null;

  const canConfirm = isValidInviteCode(code) && !busy;

  const handleConfirm = async (): Promise<void> => {
    if (!canConfirm) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await resolve({ mode: 'invite_code', code });
      if (res.matched) {
        onSuccess(res.groupId, res.guestToken);
      } else {
        setErrorMsg('해당 코드의 모임을 찾지 못했어요. 코드를 다시 확인해 주세요.');
        setBusy(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '모임 합류에 실패했어요.';
      setErrorMsg(msg);
      setBusy(false);
    }
  };

  // 시스템 Alert 대신 시트 내 2스텝 확인(중첩 Modal 회피) — 실수 skip 방지.
  const handleSkipPress = (): void => {
    setConfirmingSkip(true);
  };

  const confirmBg = canConfirm ? colors.brand[500] : colors.surface[2];
  const confirmFg = canConfirm ? colors.text['on-brand'] : colors.text.disabled;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
      testID="invite-code-modal"
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
              borderWidth: 1,
            },
          ]}
        >
          <Title level="h2" color={colors.text.primary}>
            초대받은 모임이 있나요?
          </Title>
          <Body
            variant="sm"
            color={colors.text.secondary}
            style={{ marginTop: space[2], marginBottom: space[4] }}
          >
            친구에게 받은 4자리 초대 코드를 입력해 주세요.
          </Body>

          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(sanitizeCodeInput(t));
              setErrorMsg(null);
            }}
            placeholder="0000"
            placeholderTextColor={colors.text.disabled}
            keyboardType="number-pad"
            maxLength={4}
            editable={!busy}
            testID="invite-code-input"
            accessibilityLabel="초대 코드 4자리 입력"
            style={[
              styles.input,
              {
                borderColor: errorMsg ? colors.semantic.error.fg : colors.border.subtle,
                borderRadius: radius.md,
                paddingVertical: space[3],
                paddingHorizontal: space[4],
                color: colors.text.primary,
                fontVariant: ['tabular-nums'],
              },
            ]}
          />

          {errorMsg !== null ? (
            <Caption
              color={colors.semantic.error.fg}
              testID="invite-code-error"
              style={{ marginTop: space[2] }}
            >
              {errorMsg}
            </Caption>
          ) : null}

          {confirmingSkip ? (
            <View style={{ marginTop: space[4] }}>
              <Caption
                color={colors.text.secondary}
                style={{ marginBottom: space[3], textAlign: 'center' }}
              >
                나중에 4자리 코드로 다시 합류할 수 있어요. 지금 건너뛸까요?
              </Caption>
              <View style={[styles.footer, { gap: space[2] }]}>
                <Pressable
                  onPress={() => setConfirmingSkip(false)}
                  accessibilityRole="button"
                  accessibilityLabel="계속 입력"
                  testID="invite-code-skip-cancel"
                  style={({ pressed }) => [
                    styles.button,
                    {
                      flex: 1,
                      borderRadius: radius.md,
                      paddingVertical: space[3],
                      backgroundColor: colors.surface[2],
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Body variant="bold" color={colors.text.secondary}>
                    계속 입력
                  </Body>
                </Pressable>
                <Pressable
                  onPress={onSkip}
                  accessibilityRole="button"
                  accessibilityLabel="건너뛰기 확인"
                  testID="invite-code-skip-confirm"
                  style={({ pressed }) => [
                    styles.button,
                    {
                      flex: 1,
                      borderRadius: radius.md,
                      paddingVertical: space[3],
                      backgroundColor: colors.surface[2],
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Body variant="bold" color={colors.semantic.error.fg}>
                    건너뛰기
                  </Body>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.footer, { marginTop: space[4], gap: space[2] }]}>
              <Pressable
                onPress={handleSkipPress}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="건너뛰기"
                testID="invite-code-skip"
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
                  건너뛰기
                </Body>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                disabled={!canConfirm}
                accessibilityRole="button"
                accessibilityLabel="확인"
                accessibilityState={{ disabled: !canConfirm, busy }}
                testID="invite-code-confirm"
                style={({ pressed }) => [
                  styles.button,
                  {
                    flex: 1,
                    borderRadius: radius.md,
                    paddingVertical: space[3],
                    backgroundColor: confirmBg,
                    opacity: pressed && canConfirm ? 0.85 : 1,
                  },
                ]}
              >
                <Body variant="bold" color={confirmFg}>
                  {busy ? '확인 중...' : '확인'}
                </Body>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  container: {
    alignSelf: 'stretch',
  },
  input: {
    borderWidth: 1,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 4,
  },
  footer: {
    flexDirection: 'row',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
