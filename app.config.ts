// Expo config. app.json 대체. Kakao native app key를 .env에서 읽어 plugin에 전달하기 위해 .ts로 전환.
// (app.json은 정적 — env 보간 불가. EAS Build도 app.config.ts/js를 권장.)

import type { ConfigContext, ExpoConfig } from 'expo/config';

// 색은 DESIGN 토큰 단일 진실에서 가져온다 (절대 규칙 1 — hex 직접 작성 금지).
// tokens.ts는 import 0개의 순수 객체라 RN 런타임 없이 config 평가 시점에도 안전하다.
//
// require + 확장자 명시인 이유: Expo config 로더는 app.config.ts **자신만** 트랜스파일하고
// 그 안의 import는 CJS로 해석한다 → 확장자 없으면 "Cannot find module"로 config 읽기 실패.
// 확장자를 붙인 import 구문은 TS5097(allowImportingTsExtensions)에 걸리므로,
// 런타임은 require(문자열), 타입은 typeof import로 분리한다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tokens } = require('./src/design/tokens.ts') as typeof import('./src/design/tokens');

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

// 네이버 지도 플러그인도 Kakao와 동일 — Maps Client ID(placeholder 아님) + MAP_ENABLED 일 때만
// 포함. 키 없으면 미포함 → 현 빌드 무영향. 키 도착 시 prebuild에서 자동 주입(코드 변경 0). (D38)
const NAVER_MAP_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? '';
const naverMapPlugin: [string, unknown] | null =
  NAVER_MAP_CLIENT_ID && NAVER_MAP_CLIENT_ID !== 'your-naver-client-id'
    ? ['@mj-studio/react-native-naver-map', { client_id: NAVER_MAP_CLIENT_ID }]
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
  // EAS Update (OTA) — eas.json build profile의 channel과 연결. expo-updates 설정.
  // fallbackToCacheTimeout: 0 → 임베드된 번들로 즉시 실행 + 업데이트는 백그라운드 확인
  // (launch 지연 0 → D25 cold start 측정 왜곡 방지).
  updates: {
    url: 'https://u.expo.dev/8bea6af1-7bec-4df3-a60d-74a548b43cb6',
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.denda.app',
    // TestFlight/App Store 제출 시 "수출 규정(암호화)" 문답 자동 면제.
    // 표준 HTTPS(Supabase)·expo-crypto 해시만 사용 → Apple 면제 대상.
    // ITSAppUsesNonExemptEncryption=false 를 Info.plist에 주입 (매 빌드 수동 문답 제거).
    config: {
      usesNonExemptEncryption: false,
    },
    // S15-deeplink — D28 자체 deferred deep link Universal Links.
    // AASA 파일은 web-guest/public/.well-known/apple-app-site-association에서 호스팅.
    // Apple 캐시 24-48h — TestFlight build로 실제 device 검증 의무.
    associatedDomains: ['applinks:denda.vercel.app'],
  },
  android: {
    package: 'com.denda.app',
    adaptiveIcon: {
      // DESIGN 토큰 참조 (절대 규칙 1 — hex 직접 작성 금지).
      // 값은 6자리 hex여야 한다: '#fff' 축약형은 네이티브 빌드는 통과하지만
      // eas update 매니페스트 검증이 거부한다 (tests/env/appConfigManifest.test.ts가 가드).
      backgroundColor: tokens.light.surface[0],
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
    // 권한 사용 문구(Info.plist NS*UsageDescription)는 plugin을 명시 선언해야 제어된다.
    // 미선언 시 autolink된 plugin이 영문 기본값("Allow $(PRODUCT_NAME) to ...")을 박고,
    // 안 쓰는 권한까지 딸려 들어간다 → 한국어 전용 베타 위반 + App Store 심사 문의 사유.
    // 회귀 가드: tests/env/iosPermissions.test.ts
    ['expo-secure-store', { faceIDPermission: false }], // requireAuthentication 미사용
    [
      'expo-calendar',
      {
        // S06 — 모임 확정 시 캘린더에 일정 추가. getDefaultCalendarAsync/getCalendarsAsync를
        // 쓰므로 write-only 접근으로는 부족 (full access 유지).
        calendarPermission: '확정된 모임 일정을 캘린더에 자동으로 추가하기 위해 사용해요.',
        remindersPermission: false, // EKReminder 미사용
      },
    ],
    [
      'expo-image-picker',
      {
        // S03b — 에브리타임 시간표 스크린샷 OCR. 라이브러리 선택만 (촬영 없음).
        photosPermission: '시간표 사진에서 수업 시간을 읽어오기 위해 사진 접근이 필요해요.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    ...(kakaoPlugin ? [kakaoPlugin] : []),
    ...(naverMapPlugin ? [naverMapPlugin] : []),
    // 카카오 SDK는 자체 Nexus 저장소 (devrepo.kakao.com)에서 제공 — settings.gradle에 추가
    './plugins/withKakaoMaven.js',
    // 네이버 지도 SDK도 자체 저장소(repository.map.naver.com)에서 제공 — 키 있을 때만 추가
    ...(naverMapPlugin ? ['./plugins/withNaverMaven.js'] : []),
    // S15-deeplink (D28) — iOS 14+ ATT(App Tracking Transparency).
    // 자체 deferred deep link fingerprint(IP/UA 해시) 매칭이 Apple 정의상 "tracking"에 해당 →
    // 첫 launch 시 ATT 프롬프트 의무. 거부해도 매칭은 server-side에서 동작(IDFA 미사용)하지만
    // App Store 심사 통과를 위해 프롬프트는 표시. 카피는 PIPA 처리방침과 정합 (docs/privacy).
    [
      'expo-tracking-transparency',
      {
        userTrackingPermission:
          '친구가 보낸 초대 링크로 들어왔는지 확인해 모임에 자동으로 합류시키기 위해 사용해요.',
      },
    ],
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
