// 친구 탭의 nested stack — index / search / requests.

import { Stack } from 'expo-router';

export default function FriendsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="search" />
      <Stack.Screen name="requests" />
    </Stack>
  );
}
