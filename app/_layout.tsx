// Root layout — expo-router entry (D25 always load).
// 부트스트랩: authStore.bootstrap()으로 SecureStore 약관·온보딩 플래그 복원.
// 라우팅 게이트는 app/index.tsx에서 처리.

import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { authStore, useAuth } from '@/lib/auth/setup';
import { CalendarSyncRoot } from '@/lib/calendar/CalendarSyncRoot';
import { fetchCalendarPreference } from '@/lib/calendar/preference';
import {
  createAppStateAdapter,
  createAppleCalendarProvider,
} from '@/lib/calendar/setup';
import { supabase } from '@/lib/supabase/client';
import { ThemeProvider } from '@/design/theme';

// Prevent splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Prevent unhandled promise rejection */
});

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    // RN native는 TTF/OTF만 지원 (woff2는 web 전용). D7 woff2 정책은 S14 웹 게스트에 적용.
    PretendardVariable: require('../assets/fonts/PretendardVariable.ttf'),
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
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <CalendarSyncRootConnected />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="schedule" />
          <Stack.Screen name="group" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * production wiring for CalendarSyncRoot — useAuth로 userId 받고 native AppState 어댑터
 * + createAppleCalendarProvider(expo-calendar dynamicRequire) wire-up. CalendarSyncRoot
 * 자체는 DI 친화로 Jest tested. 본 wrapper는 _layout.tsx와 함께 untested glue.
 */
function CalendarSyncRootConnected(): React.JSX.Element {
  const userId = useAuth((s) => s.session?.user.id);
  const appState = useMemo(() => createAppStateAdapter(), []);
  return (
    <CalendarSyncRoot
      userId={userId}
      supabase={supabase}
      fetchPreference={(id) => fetchCalendarPreference(supabase, id)}
      createAppleProvider={createAppleCalendarProvider}
      appState={appState}
    />
  );
}
