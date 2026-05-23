// 카카오 OIDC 로그인 화면 (D29).
//
// 색·타이포는 S11에서 토큰화 — 현재는 rgba/시스템 컬러로 최소 스타일.
// "카카오로 시작" CTA는 KakaoGuide 공식 가이드의 노란색 (rgba(254, 229, 0, 1)).
// 약관 동의 / 온보딩은 로그인 성공 후 게이트 (app/index.tsx)에서 라우팅.

import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, Text, View } from 'react-native';

import { AuthError } from '@/lib/auth/AuthProvider';
import { authStore, useAuth } from '@/lib/auth/setup';

const KAKAO_YELLOW = 'rgba(254, 229, 0, 1)';
const TEXT_PRIMARY = 'rgba(0, 0, 0, 0.87)';
const TEXT_SECONDARY = 'rgba(0, 0, 0, 0.6)';

export default function LoginScreen() {
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
      // 성공 시 index 게이트로 — 약관·온보딩 상태에 따라 routing
      router.replace('/');
    } catch (error) {
      if (error instanceof AuthError && error.detail.kind === 'cancelled') {
        // 사용자 취소는 silent
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
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 32,
        }}
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: '700',
              color: TEXT_PRIMARY,
              letterSpacing: -0.5,
            }}
          >
            된다
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: TEXT_SECONDARY,
              marginTop: 12,
              textAlign: 'center',
            }}
          >
            {'친구와 시간·장소·예약\n한 번에 정해요'}
          </Text>
        </View>

        <View style={{ width: '100%' }}>
          {lastError && lastError.kind !== 'cancelled' ? (
            <Text
              style={{
                color: 'rgba(180, 0, 0, 1)',
                fontSize: 13,
                marginBottom: 12,
                textAlign: 'center',
              }}
              accessibilityRole="alert"
            >
              {errorMessage(lastError.kind)}
            </Text>
          ) : null}

          <Pressable
            onPress={handleKakaoSignIn}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="카카오로 시작하기"
            accessibilityState={{ disabled: isLoading }}
            style={({ pressed }) => ({
              backgroundColor: KAKAO_YELLOW,
              opacity: isLoading ? 0.6 : pressed ? 0.9 : 1,
              minHeight: 52,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
            })}
          >
            {isLoading ? (
              <ActivityIndicator color={TEXT_PRIMARY} />
            ) : (
              <Text style={{ color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' }}>
                카카오로 시작하기
              </Text>
            )}
          </Pressable>

          <Text
            style={{
              fontSize: 12,
              color: TEXT_SECONDARY,
              textAlign: 'center',
              marginTop: 16,
              lineHeight: 18,
            }}
          >
            {'계속하면 이용약관과 개인정보 처리방침에\n동의하는 것으로 간주합니다.'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function errorMessage(kind: 'cancelled' | 'network' | 'invalid_token' | 'unknown'): string {
  switch (kind) {
    case 'network':
      return '네트워크 연결이 불안정해요. 잠시 후 다시 시도해주세요.';
    case 'invalid_token':
      return '카카오 인증을 확인하지 못했어요. 다시 시도해주세요.';
    case 'unknown':
      return '로그인 중 오류가 발생했어요. 다시 시도해주세요.';
    default:
      return '';
  }
}
