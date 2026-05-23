// Root layout — expo-router entry (D25 always load).
// 부트스트랩: authStore.bootstrap()으로 SecureStore 약관·온보딩 플래그 복원.
// 라우팅 게이트는 app/index.tsx에서 처리.

import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';

import { authStore } from '@/lib/auth/setup';
import { ThemeProvider } from '@/design/theme';

// Prevent splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Prevent unhandled promise rejection */
});

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    PretendardVariable: require('../assets/fonts/PretendardVariable.woff2'),
  });

  useEffect(() => {
    authStore.getState().bootstrap();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync().catch(() => {
        /* Prevent unhandled promise rejection */
      });
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}
