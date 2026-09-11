# EAS Build · 인증서 · TestFlight Runbook (S13)

> Founder가 직접 실행하는 운영 절차. AI는 인터랙티브 `eas` CLI(2FA·클라우드 빌드·실기기)를
> 대신 못 돌리므로 명령어·순서·체크리스트만 정리. 설정·계측 코드는 레포에 이미 있음.
>
> 관련: [eas.json](../eas.json), [app.config.ts](../app.config.ts), [.env.eas.example](../.env.eas.example),
> [D25 Cold start](DECISIONS.md#d25--cold-start-target--2초--lazy-loading), [Q-B20](OPEN_QUESTIONS.md#q-b20--apple-developer--google-play-console-가입-timing)

---

## 0. 계정 상태 (Q-B20)

| 계정 | 상태 | 지금 필요? |
|---|---|---|
| **Expo / EAS** | ✅ 있음 (`app.config.ts` projectId 존재) | 예 |
| **Apple Developer Program** ($99/년) | ✅ 있음 | iOS 빌드·TestFlight에 필요 |
| **Google Play Console** ($25 1회) | ❌ 없음 | **아니오** — 베타는 APK 사이드로드로 충분. Play 배포 시점에만 |

> **핵심**: 내 안드로이드 폰에서 테스트하는 데 Google Play Console은 불필요.
> Expo Go도 불가(Kakao 네이티브 모듈 + 커스텀 maven 플러그인). **개발/프리뷰 빌드**를 써야 함.

---

## 1. 일회성 셋업

```bash
# EAS CLI 설치 + 로그인
npm i -g eas-cli
eas login
eas whoami          # 로그인 확인

# (이미 eas init 됨 — projectId가 app.config.ts에 있음. 재실행 불필요)
```

### 1.1 환경변수 등록 (EAS Environment Variables)

[.env.eas.example](../.env.eas.example)의 (A) 그룹을 각 환경에 등록:

```bash
# 예: production 환경
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxx.supabase.co" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..." --visibility sensitive
eas env:create --environment production --name EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY --value "..." --visibility sensitive
eas env:create --environment production --name EXPO_PUBLIC_NAVER_MAP_CLIENT_ID --value "..." --visibility sensitive
eas env:create --environment production --name EXPO_PUBLIC_EAS_PROJECT_ID --value "8bea6af1-..." --visibility plaintext
# development / preview 환경에도 동일 (값은 dev Supabase project 등으로 다를 수 있음)

eas env:list --environment production    # 확인
```

> Edge Function secret((B) 그룹: NAVER_CLIENT_SECRET·GEMINI_API_KEY·HMAC_SECRET·GOOGLE_CALENDAR_* 등)은
> **EAS가 아니라 Supabase**에: `supabase secrets set NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=...`

### 1.2 인증서 / keystore

```bash
# iOS — Apple Developer 계정으로 distribution cert + provisioning profile 자동 생성·관리
eas credentials --platform ios

# Android — keystore는 첫 build에서 EAS가 자동 생성 (별도 작업 불필요).
# 명시적으로 보거나 백업하려면:
eas credentials --platform android
```

---

## 2. 빌드

| 프로파일 | 용도 | Android 산출물 | 배포 |
|---|---|---|---|
| `development` | dev client (JS 빠른 반복) | APK | 사이드로드 |
| `preview` | QA·실기기 테스트 | **APK** | 사이드로드 (Play Console 불필요) |
| `production` | 스토어 출시 | AAB(app-bundle) | TestFlight / Play |

```bash
# 내 안드로이드 폰에서 테스트 (Play Console 없이) — 추천
eas build --platform android --profile preview
#   → 완료되면 다운로드 링크/QR. 폰에서 열어 APK 설치 ("출처를 알 수 없는 앱" 허용)

# iOS 실기기 / TestFlight
eas build --platform ios --profile production

# 둘 다
eas build --platform all --profile preview
```

### 2.1 로컬 빌드 대안 (클라우드 없이)
```bash
# Android Studio SDK + USB 연결 폰 필요
npx expo run:android --variant release
# (에뮬레이터는 docs상 run-denda 스킬로도 가능하나, D25 측정은 실기기 권장)
```

---

## 3. 제출 (선택 — 테스터 배포)

```bash
# iOS → TestFlight (Apple Developer ✅ 있으므로 가능. 내부 테스터 100명 심사 없이 즉시)
eas submit --platform ios --profile production
#   App Store Connect API key 권장 (App Store Connect → Users and Access → Integrations)

# Android → Play Internal Testing  ⚠️ Google Play Console 가입 후에만
eas submit --platform android --profile production
#   eas.json submit.production.android.track = "internal" 로 설정됨
#   Play service account JSON 필요
```

---

## 4. Cold start < 2초 측정 (D25) ★

계측 코드는 이미 레포에 있음: [src/lib/perf/coldStart.ts](../src/lib/perf/coldStart.ts) →
`app/_layout.tsx`가 폰트 로드 + 첫 렌더(splash hide) 시점에 `markInteractive()` 호출.

### 판독 방법 ① 화면 배지 (기본 — adb 불필요)
[src/components/perf/ColdStartBadge.tsx](../src/components/perf/ColdStartBadge.tsx)가 앱 첫 화면 상단에
pill을 띄움: `✅ 콜드스타트 1480ms / 2000ms` (예산 초과 시 `⚠️`).

- **게이팅**: `development`·`preview` 빌드 프로파일에 `env.EXPO_PUBLIC_PERF_OVERLAY="1"`이 박혀 있어 자동 노출.
  **`production` 프로파일엔 없음 → 배지 안 뜸** (UX 영향 0). dev 서버(`expo start`)에선 `__DEV__`로 항상 노출.
- 즉 `eas build --profile preview`로 빌드한 APK를 폰에 깔면 **그냥 화면에 숫자가 보임.** adb 불필요.

### 판독 방법 ② adb logcat / Console.app (배지 없이)
앱 시작 시 콘솔에도 동일 측정이 찍힘:
```
[cold-start] 1480ms / 2000ms ✅ 예산 내 (D25)
[cold-start] 2310ms / 2000ms ⚠️ 예산 초과 (D25)
```
```bash
# Android — 폰 USB 연결 후
adb logcat | grep cold-start

# iOS — Mac의 Console.app에서 기기 선택 → "cold-start" 필터
#       또는 Xcode → Devices and Simulators → 기기 콘솔
```

### 측정 기준 (TEST_PLAN / D25)
- **production binary** (dev mode 측정 금지 — 번들러·HMR 오버헤드로 무의미)
- 저사양 실기기: **Galaxy A14** (P1 페르소나) + **iPhone SE 2nd gen**
- 앱 완전 종료 후 cold launch 여러 번 → 중앙값 기록

### 계측 범위의 정직한 한계
본 계측은 **JS 번들 평가 시작 → 첫 화면 interactive** 구간. 진짜 cold start의
앞부분(OS process spawn → JS 시작)은 native 계측(`expo-application` 또는 native 모듈)이
필요 — 본 숫자에 그 native 구간을 더해야 전체 cold start. 베타는 JS 구간만으로 회귀 추적,
정밀 측정은 native 계측 도입 시(별도 트랙).

---

## 5. 딥링크 자격증명 채우기 (S15-deeplink 연동)

빌드 후 placeholder 두 개를 실제 값으로:

```bash
# Android: keystore SHA256 지문 추출 → web-guest/public/.well-known/assetlinks.json
eas credentials --platform android      # SHA256 fingerprint 확인
#   → assetlinks.json의 "sha256_cert_fingerprints" placeholder 교체
adb shell pm verify-app-links --re-verify com.denda.app   # 검증

# iOS: Apple Team ID → web-guest/public/.well-known/apple-app-site-association
#   AASA의 "TEAMID" placeholder를 Apple Developer Team ID로 교체 (Apple 캐시 24~48h)
```

---

## 6. 디자이너 UI 피드백용 iOS 배포 (TestFlight)

> 목적: 외부 UI/UX 디자이너가 **본인 아이폰**에서 실제로 써보고 피드백.
> 시뮬레이터(맥북)는 부적합 — 마우스 드래그로는 [D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec) 시간 그리드 sweep·햅틱·44pt 터치 타깃을 평가할 수 없다.

### 6.1 빌드 전 외부 콘솔 점검 (이거 안 하면 디자이너가 로그인에서 막힘) ★

| # | 확인 | 안 했을 때 증상 |
|---|---|---|
| 1 | **카카오 개발자 콘솔 → 내 앱 → 플랫폼 → iOS 등록** (번들 ID `com.denda.app`) | **로그인 자체 불가.** 로그인 없이는 화면 0개 (`src/lib/auth/gate.ts`) → 피드백 세션 전멸 |
| 2 | **네이버 클라우드 플랫폼 → Maps → iOS 번들 ID 등록** | 지도 탭 인증 실패. 등록 안 할 거면 EAS `production` 환경의 `EXPO_PUBLIC_MAP_ENABLED=false`로 두고 리스트 fallback으로 내보낼 것 |
| 3 | **APNs 키** (`eas credentials -p ios`) | 푸시 F1~F5 안 옴. 알림 피드백까지 받을 거면 필수 |
| 4 | **AASA `TEAMID` 치환 + web-guest 재배포** (§5) | 초대 링크가 앱이 아니라 사파리로 열림. 초대→자동 합류 플로우 피드백 불가 (Apple 캐시 24~48h — **빌드보다 먼저** 해둘 것) |

> iOS Info.plist 권한 문구는 코드에서 이미 한국어로 고정됨 (`app.config.ts` plugin props +
> 회귀 가드 `tests/env/iosPermissions.test.ts`). 안 쓰는 카메라·마이크·미리 알림·Face ID 권한도 제거 완료.

### 6.2 빌드 → 제출

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
#   App Store Connect API key 권장 (ASC → Users and Access → Integrations)
#   빌드 처리(processing) 10~30분 소요
```

> **주의 — 디자이너 테스트 데이터가 어느 DB로 가는가**: `production` 프로파일은 EAS
> `production` 환경변수를 쓴다. 실서비스 Supabase와 분리하고 싶으면 `preview` 환경 값을 쓰는
> TestFlight 전용 프로파일을 따로 만들 것. 또 `production`엔 `EXPO_PUBLIC_PERF_OVERLAY`가
> 없어 콜드스타트 배지가 안 뜬다 (UI 피드백용으론 이게 맞음 — 화면이 깨끗함).

### 6.3 테스터 초대 — 내부 vs 외부

| | 내부 테스터 | 외부 테스터 |
|---|---|---|
| 조건 | App Store Connect **사용자로 초대** (역할 제한 가능: 마케팅/고객지원) | 이메일만 |
| 심사 | 없음 — 업로드 후 바로 | 첫 빌드만 베타 앱 심사 (보통 24h 내), 이후 자동 |
| 인원 | 100명 | 10,000명 |

외부 디자이너 1명이면 **내부 테스터가 가장 빠름**(즉시). ASC 접근 권한을 주기 싫으면 외부 테스터 + 1회 심사 대기.

- 디자이너가 할 일: TestFlight 앱 설치 → 초대 메일의 코드 입력 → 설치. Xcode·맥북 불필요
- 빌드는 **90일 후 만료** → 피드백 기간이 길면 재업로드 필요
- 첫 실행 시 **ATT 프롬프트**(추적 허용)가 뜬다 — 거부해도 정상 동작. 디자이너에게 미리 알려줄 것

---

## 7. 아직 막혀 있음 / 미루는 것 (운영 트랙)

- [ ] **Google Play Console 가입** — Play 배포·Internal Testing 트랙 원할 때 ($25, 본인인증)
- [ ] **실기기 cold-start 측정** — production binary + Galaxy A14 / iPhone SE 2 (founder 실행)
- [ ] **TestFlight 실배포** — `eas submit -p ios` 후 내부 테스터 초대
- [ ] **assetlinks.json SHA256 / AASA TEAMID** — 빌드 후 §5
- [ ] **ATT 모달** (iOS 14+) + PIPA 처리방침 — expo-tracking-transparency 설치 (S15 D28 risk)
- [ ] native cold-start 구간 정밀 계측 — §4 한계 참조
