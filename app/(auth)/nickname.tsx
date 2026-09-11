// 닉네임 설정/변경 화면.
// 스펙: docs/superpowers/specs/2026-07-29-nickname-design.md §7.
//
// 한 화면이 두 모드를 겸한다. 모드는 세션의 nicknameSetAt에서 파생된다:
//   null   → 가입 모드 (뒤로 없음, "확인", 성공 시 온보딩으로 replace)
//   값 있음 → 수정 모드 (뒤로 있음, "저장", 성공 시 back + 토스트)
//
// 모드를 라우트 파라미터로 받지 않는 이유: 게이트(gate.ts)가 같은 nicknameSetAt으로
// 이 화면에 보낼지를 결정한다. 두 곳이 다른 입력을 보면 "게이트는 필수라고 보내는데
// 화면은 수정 모드로 뜨는" 어긋남이 생긴다.
//
// D5 절제: 보라 fill은 CTA 1개. 한국어 only. 토큰만.

import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { NicknameField } from '@/components/profile/NicknameField';
import { ctaPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';
import { authStore, useAuth } from '@/lib/auth/setup';
import { mapError, messages, nicknameErrorMessage } from '@/lib/i18n/messages';
import { setMyNickname } from '@/lib/profile/api';
import { validateNickname } from '@/lib/profile/nickname';

export default function NicknameScreen(): React.JSX.Element {
  const { colors, space, radius } = useTheme();
  const toast = useToast();

  const currentNickname = useAuth((s) => s.session?.user.nickname ?? '');
  const nicknameSetAt = useAuth((s) => s.session?.user.nicknameSetAt);
  const isEditing = Boolean(nicknameSetAt);

  // 프리필: 가입 모드는 카톡 이름, 수정 모드는 현재 닉네임. 어느 쪽이든 지우고
  // 시작하지 않아도 되게 한다. 최초 1회만 — 이후 입력을 세션 변화가 덮어쓰면 안 된다.
  const [value, setValue] = useState(currentNickname);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [inflight, setInflight] = useState(false);

  const validation = useMemo(() => validateNickname(value), [value]);
  const canSubmit = validation.ok && !inflight;

  const handleChange = useCallback((next: string): void => {
    setValue(next);
    // 다시 입력하는 순간 이전 실패는 무효 — 고친 값에 옛 에러가 붙어 있으면 혼란스럽다.
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    // 연타·비활성 상태 press를 여기서 막는다 (Pressable disabled와 이중 방어).
    if (!validation.ok || inflight) return;

    setInflight(true);
    setSubmitError(null);
    try {
      const result = await setMyNickname(validation.value);

      if (!result.ok) {
        // 중복·규칙 위반은 사유별 카피가 그대로 전달돼야 한다 (mapError를 태우지 않는 이유).
        setSubmitError(nicknameErrorMessage(result.reason));
        setInflight(false);
        return;
      }

      authStore.getState().applyNickname(result.value);

      if (isEditing) {
        toast.show({ message: messages.nickname.saved, variant: 'default' });
        router.back();
      } else {
        // 가입 모드는 곧바로 화면이 바뀌므로 토스트가 불필요하다.
        router.replace('/(auth)/onboarding');
      }
      // 성공 경로는 화면이 언마운트되므로 inflight를 되돌리지 않는다.
    } catch (e) {
      // 네트워크·로그인 만료 등 — CTA가 영구 disabled로 갇히지 않게 반드시 복원.
      setInflight(false);
      const { silent, message } = mapError(e);
      if (!silent) toast.show({ message, variant: 'error' });
    }
  }, [validation, inflight, isEditing, toast]);

  const submitLabel = isEditing ? messages.nickname.submitEdit : messages.nickname.submitSignup;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      {/* 가입 모드에는 뒤로가 없다 — 건너뛸 수 없는 단계이므로 되돌아갈 곳이 없다. */}
      <ScreenHeader
        title={isEditing ? messages.nickname.editTitle : undefined}
        onBack={isEditing ? () => router.back() : undefined}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, paddingHorizontal: space[4], paddingTop: space[4] }}>
          {!isEditing ? (
            <View style={{ marginBottom: space[6] }}>
              <Title level="display" color={colors.text.primary}>
                {messages.nickname.signupTitle}
              </Title>
              <Body variant="primary" color={colors.text.secondary} style={{ marginTop: space[3] }}>
                {messages.nickname.signupBody}
              </Body>
            </View>
          ) : null}

          <NicknameField
            value={value}
            onChangeText={handleChange}
            error={submitError}
            onSubmit={handleSubmit}
            autoFocus
          />
        </View>

        <View style={{ paddingHorizontal: space[4], paddingBottom: space[5] }}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: !canSubmit }}
            testID="nickname-submit"
            style={({ pressed }) => ({
              backgroundColor: canSubmit ? ctaPressBg(pressed, colors) : colors.surface[3],
              borderRadius: radius.md,
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Body variant="bold" color={canSubmit ? colors.text['on-brand'] : colors.text.disabled}>
              {inflight ? '저장 중...' : submitLabel}
            </Body>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
