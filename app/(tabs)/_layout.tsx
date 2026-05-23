// (tabs) 그룹 layout — 홈/친구/지도/프로필 4탭은 후속 sprint에서.
// S01은 placeholder Stack 하나만 — 인증 완료 후 진입 화면.

import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
