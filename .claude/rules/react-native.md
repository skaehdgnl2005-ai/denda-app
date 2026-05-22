---
description: RN/Expo 패턴 — 60fps worklet, FlashList, lazy loading. RN 코드 작성 시 자동 로드.
globs:
  - "src/**/*.tsx"
  - "src/**/*.ts"
  - "src/screens/**"
  - "src/components/**"
  - "src/lib/**"
  - "App.tsx"
  - "app.json"
---

# React Native / Expo Rules

→ 결정: [D22 Tech Stack](../../docs/DECISIONS.md#d22--phase-12-tech-stack), [D12 60fps spec](../../docs/DECISIONS.md#d12--60fps-시간-그리드-구현-spec), [D25 Cold start](../../docs/DECISIONS.md#d25--cold-start-target--2초--lazy-loading)

## 스택 (Phase 1+2)

전체 패키지 표: [DECISIONS.md#d22](../../docs/DECISIONS.md#d22--phase-12-tech-stack) (Expo SDK 53+, expo-router, zustand, expo-secure-store, gesture-handler+reanimated, FlashList, naver-map, expo-calendar, expo-notifications, expo-font+Pretendard, lucide-react-native+svg)

## 절대 규칙

### D12 — 60fps 시간 그리드 (회사 운명)

- Drag = `Gesture.Pan()` + Reanimated worklet (UI thread)
- 셀 상태 = `useSharedValue` (JS state 금지)
- 매 cell touch마다 `setState` 금지 — 60fps 무너짐
- Vote commit = drag 종료 시 1회 + 100ms debounce
- 420 cells 가상화 = `FlashList` 또는 `React.memo` 셀
- Heatmap receive도 별도 shared value (`useSharedValue`)

코드 예제 (❌/✅) · 근거: [DECISIONS.md#d12](../../docs/DECISIONS.md#d12--60fps-시간-그리드-구현-spec)

### D25 — Cold start < 2초

**Always load** (앱 startup):
- expo-router, react-native, supabase-js, zustand, expo-secure-store

**Lazy load** (route 진입 시 `import()`):
- `@mj-studio/react-native-naver-map` — 지도 탭 진입 시
- `expo-calendar` — 모임 확정 + Calendar push 시점
- Gemini Vision — OCR 진입
- 토스 webview — 🔒 Phase 3 (현재 미import)

D28 (자체 deferred deep link)은 클라이언트 SDK 없음 — `supabase-js` (always load)로 attribution_match Edge Function 호출. lazy load 대상 아님.

`lazy(() => import(...))` 예제: [DECISIONS.md#d25](../../docs/DECISIONS.md#d25--cold-start-target--2초--lazy-loading)

### 타입 안전 + Strict

- TypeScript strict 모드
- `any` 사용 금지 (제3자 type 부족 시 `unknown` + type guard)
- 모든 함수에 명시적 return type
- 모든 component props에 interface

### Native modules

- Expo SDK 제공 모듈 우선
- Bare workflow 진입은 마지막 수단 (EAS Build 호환성 점검)

## 디렉토리 구조

상세: [ARCHITECTURE.md §3](../../docs/ARCHITECTURE.md) (src/app, components, design tokens, lib/auth·places·calendar·coords·supabase·push·attribution·analytics)

## 외부 통합 패턴

- **API key는 항상 서버 (Edge Function) 통과** — 클라이언트 expose 금지 (Kakao REST/Admin·Naver Local·Gemini·HMAC secret). 예외: Naver Map SDK key, Kakao Native app key (SDK 초기화)
- **`PlaceSearchProvider` interface** — Kakao Local + Naver Search plug-in (S16 fallback 대비)
- **`AuthProvider` interface** — `KakaoOIDCProvider` ([D29](../../docs/DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)) + `AppleAuthProvider` plug-in (S16 Phase 3 대비)
- **`coords/normalize.ts`** 단일 진입점 — 모든 외부 좌표 WGS84로 정규화 ([D18](../../docs/DECISIONS.md#d18--좌표계-정규화))

## 금지 패턴

- 시간 그리드 cell touch마다 setState (60fps 무너짐)
- `new Date()` 직접 사용 → KST 명시 강제 (rules/ko-kr.md)
- hex 색 직접 작성 → tokens 참조 (rules/design.md)
- `console.log` production 코드에 남기기 → Sentry/logger 사용
- 동기 AsyncStorage 호출 (느림) → expo-secure-store 또는 zustand persist
- 불필요한 re-render 유발 inline 함수 (List item props)
