// 카카오 OIDC 로그인 (D29).
//
// §17.4 적용: hero에 BrandMark + HeatRampRow + 가치 prop 3행 — 시각 자산 확보.
// 카카오 공식 노란색은 brand 컬러 아니라 유지 (외부 OAuth UX 일관).

import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/BrandMark';
import { HeatRampRow } from '@/components/brand/HeatRampRow';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import { AuthError } from '@/lib/auth/AuthProvider';
import { authStore, useAuth } from '@/lib/auth/setup';

// 카카오 OAuth 공식 컬러 (외부 SDK 가이드라인 — DESIGN.md 토큰 밖).
const KAKAO_YELLOW = 'rgba(254, 229, 0, 1)';
const KAKAO_TEXT = 'rgba(0, 0, 0, 0.85)';

const VALUE_PROPS: { icon: IconName; title: string; body: string }[] = [
  { icon: '시간', title: '시간', body: '7명까지 동시 투표' },
  { icon: '장소', title: '장소', body: '지도에서 함께 결정' },
  { icon: '캘린더', title: '예약', body: '캘린더 자동 등록' },
];

export default function LoginScreen() {
  const { colors, space, radius } = useTheme();
  const status = useAuth((s) => s.status);
  const lastError = useAuth((s) => s.lastError);
  const [submitting, setSubmitting] = useState(false);

  const handleKakaoSignIn = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await authStore.getState().signIn();
      router.replace('/');
    } catch (error) {
      if (error instanceof AuthError && error.detail.kind === 'cancelled') {
        return;
      }
      const message =
        error instanceof AuthError ? error.message : '로그인 중 알 수 없는 오류가 발생했어요.';
      Alert.alert('로그인 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || status === 'authenticating';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: space[5],
            paddingTop: space[10],
            paddingBottom: space[6],
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          {/* Hero — wordmark + heat ramp 미니 그래픽 */}
          <View style={{ alignItems: 'center', marginTop: space[6] }}>
            <BrandMark size="lg" />
            <Body
              variant="primary"
              color={colors.text.secondary}
              style={{
                marginTop: space[5],
                textAlign: 'center',
                fontSize: 17,
                lineHeight: 26,
              }}
            >
              친구와 시간·장소·예약,{'\n'}한 번에 정해요
            </Body>
          </View>

          {/* Heat ramp 미니 시각 — 핵심 메커닉 hint + 양끝 라벨 */}
          <View
            style={{
              alignItems: 'center',
              marginTop: space[10],
            }}
          >
            <Caption
              variant="micro"
              color={colors.text.tertiary}
              style={{ marginBottom: space[3] }}
            >
              가능한 사람이 많을수록 진해져요
            </Caption>
            <HeatRampRow cellSize={36} cellGap={6} showLabel leftLabel="적음" rightLabel="많음" />
          </View>

          {/* Value props 3행 — 아이콘 컨테이너 회색 (§17.1 D5 절제) */}
          <View
            style={{
              marginTop: space[10],
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: space[2],
            }}
          >
            {VALUE_PROPS.map((p) => (
              <View key={p.title} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    backgroundColor: colors.surface[2],
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: space[2],
                  }}
                >
                  <Icon name={p.icon} color={colors.text.secondary} size={22} />
                </View>
                <Body variant="sm-bold" color={colors.text.primary}>
                  {p.title}
                </Body>
                <Caption
                  variant="micro"
                  color={colors.text.tertiary}
                  style={{ marginTop: 2, textAlign: 'center' }}
                >
                  {p.body}
                </Caption>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ width: '100%' }}>
          {lastError && lastError.kind !== 'cancelled' ? (
            <Caption
              variant="default"
              color={colors.semantic.error.fg}
              style={{ marginBottom: space[3], textAlign: 'center' }}
              accessibilityRole="alert"
            >
              {errorMessage(lastError.kind)}
            </Caption>
          ) : null}

          <Pressable
            onPress={handleKakaoSignIn}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="카카오로 시작하기"
            accessibilityState={{ disabled: isLoading }}
            style={({ pressed }) => [
              styles.kakaoButton,
              {
                backgroundColor: KAKAO_YELLOW,
                opacity: isLoading ? 0.6 : pressed ? 0.92 : 1,
                borderRadius: radius.md,
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={KAKAO_TEXT} />
            ) : (
              <Body variant="bold" color={KAKAO_TEXT}>
                카카오로 시작하기
              </Body>
            )}
          </Pressable>

          <Caption
            variant="default"
            color={colors.text.tertiary}
            style={{ textAlign: 'center', marginTop: space[3], lineHeight: 18 }}
          >
            계속하면 이용약관과 개인정보 처리방침에{'\n'}동의하는 것으로 간주합니다.
          </Caption>
        </View>
      </View>
    </SafeAreaView>
  );
}

function errorMessage(kind: 'cancelled' | 'network' | 'invalid_token' | 'unknown'): string {
  switch (kind) {
    case 'network':
      return '네트워크가 불안정해요. 잠시 후 다시 시도해주세요.';
    case 'invalid_token':
      return '카카오 인증을 확인하지 못했어요. 다시 시도해주세요.';
    case 'unknown':
      return '로그인 중 문제가 생겼어요. 다시 시도해주세요.';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  kakaoButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
