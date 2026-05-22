// Root layout — expo-router entry (Always load, D25)
// src/ 트리 미사용 사유: expo-router default는 root `app/`. ARCHITECTURE.md §3의
// src/app 컨벤션은 deviation — 추후 expo-router root option 검증 후 결정.

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
