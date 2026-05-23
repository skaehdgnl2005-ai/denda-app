// (auth) 그룹 layout — 약관·온보딩·로그인 화면 Stack.

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
