// Root layout — expo-router entry (D25 always load).
// 부트스트랩: authStore.bootstrap()으로 SecureStore 약관·온보딩 플래그 복원.
// 라우팅 게이트는 app/index.tsx에서 처리.

import { Stack, SplashScreen, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { authStore, useAuth } from '@/lib/auth/setup';
import { AttributionRoot } from '@/lib/branch/AttributionRoot';
import type { AttributionStorage } from '@/lib/branch/AttributionRoot';
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
import { ThemeProvider, useTheme } from '@/design/theme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider, useToast } from '@/components/Toast';

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

  // GestureHandlerRootView는 최외곽 — RNGH v2는 루트 래퍼 하위에서만 제스처가 동작한다.
  // expo-router(expo-router/entry)는 이를 자동 주입하지 않으므로 여기서 명시. 없으면
  // Android에서 시간 그리드 sweep Pan·지도 Pan이 무음 실패한다 (D12 회귀 가드: tests/regression).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            {/* 렌더 크래시 폴백 — Provider 하위라 테마·EmptyState 사용 가능, 앱 전체 커버 */}
            <ErrorBoundary>
              <StatusBar style="auto" />
              <CalendarSyncRootConnected />
              <PushRegistrationConnected />
              <AttributionRootConnected />
              <ColdStartBadge />
              <RootStack />
            </ErrorBoundary>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * 루트 Stack — ThemeProvider 하위 자식으로 분리해 useTheme 접근(루트 함수 본체는 Provider의
 * 조상이라 useTheme 불가). contentStyle=surface-0으로 다크 전환 시 라이트 배경 flash 제거(W2-2),
 * 루트 전환을 slide_from_right로 통일(§4).
 */
function RootStack(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.surface[0] },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="group" />
    </Stack>
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

// 모듈 레벨 상수 — AttributionRoot의 useEffect dep이므로 render마다 새 객체가 되면 안 된다.
const attributionStorage: AttributionStorage = {
  getItemAsync: SecureStore.getItemAsync,
  setItemAsync: SecureStore.setItemAsync,
};

function AttributionRootConnected(): React.JSX.Element {
  const userId = useAuth((s) => s.session?.user.id);
  const toast = useToast();
  const resolve = useCallback(
    (args: Parameters<typeof resolveAttribution>[1]) => resolveAttribution(supabase, args),
    [],
  );
  // 자동 합류 모먼트 — 시스템 Alert 대신 '보러 가기' 액션 토스트로 바로 그 모임으로 이동.
  // (존재하지 않는 '모임 탭' 안내 문구 제거 — groupId로 해당 모임 화면 직접 진입.)
  const onMatched = useCallback(
    (groupId: string) => {
      toast.show({
        message: '모임에 합류했어요!',
        variant: 'success',
        action: { label: '보러 가기', onPress: () => router.push(`/group/${groupId}`) },
      });
    },
    [toast],
  );
  return (
    <AttributionRoot
      userId={userId}
      resolve={resolve}
      onMatched={onMatched}
      storage={attributionStorage}
    />
  );
}
