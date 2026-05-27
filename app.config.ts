// Expo config. app.json 대체. Kakao native app key를 .env에서 읽어 plugin에 전달하기 위해 .ts로 전환.
// (app.json은 정적 — env 보간 불가. EAS Build도 app.config.ts/js를 권장.)

import type { ConfigContext, ExpoConfig } from 'expo/config';

const KAKAO_NATIVE_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? '';

// Kakao 플러그인은 nativeAppKey 누락 시 throw — eas build:configure / expo config 같은
// 메타 명령에서는 키가 없어도 동작해야 하므로 조건부로 포함.
// 실제 native build (eas build --platform ...) 시 키가 없으면 명시적으로 실패.
const kakaoPlugin: [string, unknown] | null = KAKAO_NATIVE_APP_KEY
  ? [
      '@react-native-kakao/core',
      {
        nativeAppKey: KAKAO_NATIVE_APP_KEY,
        android: { authCodeHandlerActivity: true },
        ios: { handleKakaoOpenUrl: true },
      },
    ]
  : null;

export default ({ config: _ }: ConfigContext): ExpoConfig => ({
  name: 'denda',
  slug: 'denda',
  scheme: 'denda',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  // newArchEnabled는 SDK 53+에서 default — 명시 불필요
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.denda.app',
    // S15-deeplink — D28 자체 deferred deep link Universal Links.
    // AASA 파일은 web-guest/public/.well-known/apple-app-site-association에서 호스팅.
    // Apple 캐시 24-48h — TestFlight build로 실제 device 검증 의무.
    associatedDomains: ['applinks:denda.vercel.app'],
  },
  android: {
    package: 'com.denda.app',
    adaptiveIcon: {
      backgroundColor: '#fff',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // S15-deeplink — D28 자체 deferred deep link Android App Links.
    // assetlinks.json은 web-guest/public/.well-known/assetlinks.json에서 호스팅.
    // sha256 cert fingerprint는 EAS Build 시점 keystore에서 추출하여 assetlinks.json에 추가.
    // 검증: adb shell pm verify-app-links com.denda.app
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'denda.vercel.app',
            pathPattern: '/g/.*',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ...(kakaoPlugin ? [kakaoPlugin] : []),
    // 카카오 SDK는 자체 Nexus 저장소 (devrepo.kakao.com)에서 제공 — settings.gradle에 추가
    './plugins/withKakaoMaven.js',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      // EAS dashboard에서 생성된 project id — `eas init` 또는 `eas env:create` 첫 실행 시
      // EAS CLI가 알려준 값을 여기 입력 (dynamic config라 EAS가 자동 쓰기 불가).
      projectId: '8bea6af1-7bec-4df3-a60d-74a548b43cb6',
    },
  },
});
