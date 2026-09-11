// 친구 탭의 nested stack — index / search / requests.

import { Stack } from 'expo-router';

import { useTheme } from '@/design/theme';

export default function FriendsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // 다크 전환 시 라이트 배경 flash 제거 (W2-2, §0.3).
        contentStyle: { backgroundColor: colors.surface[0] },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="search" />
      <Stack.Screen name="requests" />
    </Stack>
  );
}
