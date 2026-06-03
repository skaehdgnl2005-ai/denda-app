// Root layout — expo-router entry (D25 always load).
// 부트스트랩: authStore.bootstrap()으로 SecureStore 약관·온보딩 플래그 복원.
// 라우팅 게이트는 app/index.tsx에서 처리.

import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { authStore, useAuth } from '@/lib/auth/setup';
import { AttributionRoot } from '@/lib/branch/AttributionRoot';
import { resolveAttribution } from '@/lib/branch/attributionApi';
import { requestAttPermissionOnce } from '@/lib/branch/attTracking';
import { CalendarSyncRoot } from '@/lib/calendar/CalendarSyncRoot';
import { fetchCalendarPreference } from '@/lib/calendar/preference';
import { createAppStateAdapter, createAppleCalendarProvider } from '@/lib/calendar/setup';
import { ColdStartBadge } from '@/components/perf/ColdStartBadge';
import { getAppColdStartTracker } from '@/lib/perf/coldStart';
import { createExpoNotificationsApi, createPlatformApi } from '@/lib/push/expoNotifications';
import { PushRegistrationRoot } from '@/lib/push/PushRegistrationRoot';
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

  // S15-deeplink (D28) — iOS ATT 첫 launch 프롬프트. Android·web은 skipped.
  // 거부해도 attribution 매칭은 서버 측 IP/UA 해시로 동작(IDFA 미사용). 프롬프트는
  // Apple ATT 정의(다른 도메인 데이터와 연결)와 App Store 심사 통과 의무로 표시.
  useEffect(() => {
    requestAttPermissionOnce({
      api: createAttApiOrNull() ?? noopAttApi,
      storage: SecureStore,
      platform: { isIos: Platform.OS === 'ios' },
    }).catch(() => {
      // 베타 한정 silent. ATT는 서비스 기능과 무관.
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      // D25 cold start 측정 — 폰트 로드 + 첫 렌더 완료(splash hide) = interactive 시점.
      // tracker는 idempotent라 재실행에도 첫 측정만 기록. production binary에서 console 판독.
      getAppColdStartTracker().markInteractive();
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
        <PushRegistrationConnected />
        <AttributionRootConnected />
        <ColdStartBadge />
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

/**
 * production wiring for PushRegistrationRoot — useAuth + dynamicRequire 어댑터로
 * expo-notifications + react-native Platform 결합. projectId는 EAS Build 시점
 * `EXPO_PUBLIC_EAS_PROJECT_ID` 환경변수로 set. 미설정 시 빈 문자열 → register 내부에서
 * silent fail (EAS Build 트랙 prereq).
 */
function PushRegistrationConnected(): React.JSX.Element | null {
  const userId = useAuth((s) => s.session?.user.id);
  const apis = useMemo(() => {
    try {
      return {
        notifications: createExpoNotificationsApi(),
        platform: createPlatformApi(),
      };
    } catch {
      // expo-notifications 또는 react-native 미설치 — silent skip
      return null;
    }
  }, []);

  if (!apis) return null;

  return (
    <PushRegistrationRoot
      userId={userId}
      supabase={supabase}
      notifications={apis.notifications}
      platform={apis.platform}
      projectId={process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? ''}
    />
  );
}

/**
 * production wiring for AttributionRoot — useAuth로 userId 받고 supabase client로
 * attribution_resolve Edge Function 호출. matched 시 한국어 Alert로 자동 합류 안내.
 * 본 wrapper는 _layout.tsx와 함께 untested glue. AttributionRoot 자체는 Jest tested.
 */
/**
 * expo-tracking-transparency dynamicRequire 어댑터. 미설치 환경(Jest·일부 dev)에선 null →
 * noopAttApi로 fallback해 layout mount는 통과. iOS production 빌드에서만 실제 API 호출.
 */
function createAttApiOrNull(): {
  getTrackingPermissionsAsync(): Promise<{ status: string }>;
  requestTrackingPermissionsAsync(): Promise<{ status: string }>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const mod = require('expo-tracking-transparency') as {
      getTrackingPermissionsAsync: () => Promise<{ status: string }>;
      requestTrackingPermissionsAsync: () => Promise<{ status: string }>;
    };
    return {
      getTrackingPermissionsAsync: () => mod.getTrackingPermissionsAsync(),
      requestTrackingPermissionsAsync: () => mod.requestTrackingPermissionsAsync(),
    };
  } catch {
    return null;
  }
}

const noopAttApi = {
  getTrackingPermissionsAsync: async (): Promise<{ status: string }> => ({
    status: 'undetermined',
  }),
  requestTrackingPermissionsAsync: async (): Promise<{ status: string }> => ({
    status: 'undetermined',
  }),
};

function AttributionRootConnected(): React.JSX.Element {
  const userId = useAuth((s) => s.session?.user.id);
  const resolve = useCallback(
    (args: Parameters<typeof resolveAttribution>[1]) => resolveAttribution(supabase, args),
    [],
  );
  const onMatched = useCallback((groupId: string) => {
    Alert.alert(
      '모임에 합류했어요!',
      '초대받은 모임에 자동으로 합류했어요. 모임 탭에서 확인하세요.',
      [{ text: '확인' }],
    );
    // 모임 list refresh 또는 navigation은 후속 sub-task. 베타 한정 Alert만으로 충분.
    void groupId;
  }, []);
  return <AttributionRoot userId={userId} resolve={resolve} onMatched={onMatched} />;
}
