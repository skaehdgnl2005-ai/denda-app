// (auth) 그룹 layout — 약관·온보딩·로그인 화면 Stack.

import { Stack } from 'expo-router';

import { useTheme } from '@/design/theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // auth 흐름은 fade 의도 유지(§4 전환 패턴 무관) — 배경 flash만 제거(W2-2).
        animation: 'fade',
        contentStyle: { backgroundColor: colors.surface[0] },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
