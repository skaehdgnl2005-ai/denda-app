import { Stack } from 'expo-router';

import { useTheme } from '@/design/theme';

export default function GroupLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // 다크 전환 시 라이트 배경 flash 제거 (W2-2, §0.3).
        contentStyle: { backgroundColor: colors.surface[0] },
      }}
    />
  );
}
