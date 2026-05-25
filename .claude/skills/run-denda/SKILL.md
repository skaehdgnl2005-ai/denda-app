---
name: run-denda
description: Denda 앱을 Android 에뮬레이터에서 빌드·실행·스크린샷. UI 변경 확인, 앱 실행, 에뮬레이터 띄우기, 화면 캡처 요청 시 호출.
---

# /run-denda

Expo dev-client RN 앱. 드라이버는 [.claude/skills/run-denda/launch.sh](./launch.sh) — `adb` + `expo run:android`를 감싸서 에뮬레이터 부팅·빌드·설치·Metro·런치·screenshot까지 처리.

모든 path는 repo root (`<repo>/`) 기준.

## Prerequisites

Windows + Android Studio 설치 가정. 다음이 있어야 함:

- **Android SDK** at `%LOCALAPPDATA%\Android\Sdk` (또는 `$ANDROID_HOME` 환경변수 export)
- **AVD** 이름 `Pixel_7` (또는 `DENDA_AVD` env var로 override)
- **Android Studio JBR** at `C:\Program Files\Android\Android Studio\jbr` (스크립트가 자동 탐지)
- **node + npm** (이미 프로젝트 셋업됨)

검증:

```bash
"$ANDROID_HOME/emulator/emulator.exe" -list-avds   # Pixel_7 포함되어야 함
ls "C:/Program Files/Android/Android Studio/jbr/bin/java.exe"
```

## Setup

`.env.local`이 repo root에 있어야 함 (Supabase URL, Kakao key 등). 이미 셋업된 경우 추가 작업 없음.

## Run (agent path)

```bash
.claude/skills/run-denda/launch.sh
```

전체 콜드 스타트: 에뮬레이터 부팅 → JAVA_HOME 셋업 → Gradle 빌드 → APK 설치 (서명 mismatch 시 자동 uninstall+재설치) → Metro 기동 (이미 떠 있으면 skip) → `adb reverse 8081` → MainActivity 런치 → 10초 대기 → 스크린샷 `/tmp/denda-launch.png`.

첫 빌드는 ~3-4분. 캐시 후 ~30초.

### 서브커맨드

| 명령 | 동작 |
|---|---|
| `launch.sh` 또는 `launch.sh up` | 풀 콜드스타트 (위 흐름) |
| `launch.sh screenshot [name]` | 현재 에뮬 화면 → `/tmp/<name>.png` (기본 `denda`) |
| `launch.sh metro` | Metro만 별도 기동 (이미 떠 있으면 no-op) + `adb reverse` |
| `launch.sh reload` | RN dev menu → Reload (JS 변경 hot reload) |
| `launch.sh stop` | 앱 force-stop. 에뮬·Metro는 유지. |

### 일반 작업 흐름

- **처음 세션**: `launch.sh` → 스크린샷 확인.
- **JS만 수정**: `launch.sh reload` 후 `launch.sh screenshot after-change` 비교.
- **native 의존성 추가** (package.json의 RN 모듈): `launch.sh` 재실행 — Gradle 캐시 활용해 빠름.
- **prebuild 재생성 필요시** (config plugin 변경): `rm -rf android ios && npx expo prebuild` 후 `launch.sh`.

## Run (human path)

```bash
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
npm run android   # expo run:android — 한 번 성공한 뒤로는 ok
```

설치 실패하면 launch.sh의 recovery 로직이 필요해짐 → 에이전트 path 권장.

## Test

```bash
npm test           # Jest (RN unit/integration)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

Maestro E2E는 아직 셋업 전 — TASK_BACKLOG에서 후속.

## Gotchas

- **`JAVA_HOME is not set`** — `npm run android` 직접 실행 시 발생. launch.sh는 Android Studio JBR을 자동 탐지하지만, 다른 JDK를 쓰려면 export 후 npm 호출. 시스템 PATH의 `java`는 사용 안 됨 — `JAVA_HOME` 환경변수가 진실의 단일 위치.

- **`Configuring project ':react-native-screens' without an existing directory ... C:\dev\된다 앱\node_modules\...`** — 폴더가 이전에 한글 이름 (`된다 앱`)이었을 때 빌드된 stale Gradle 캐시(`android/build/autolinking.json`)가 남은 상태. 해결: `rm -rf android/build android/app/build android/.gradle` 후 재빌드. launch.sh가 잔재 감지 시 경고만 — 자동 삭제는 안 함 (파괴적 작업이라 사용자 확인 필요).

- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match`** — 이전에 다른 keystore로 설치된 앱이 있을 때. launch.sh가 자동으로 uninstall 후 재설치. 수동 처리 시: `adb uninstall com.denda.app`.

- **`npm run android`가 install 실패로 죽으면 Metro도 같이 죽음** — expo CLI는 install 단계에서 fail 하면 자식 Metro도 종료. launch.sh는 별도로 `npx expo start --dev-client`로 Metro 띄움. 수동 복구도 같은 명령.

- **에뮬레이터가 Metro 못 찾음** (`http://10.0.2.2:8081` 또는 LAN IP 보임). `adb reverse tcp:8081 tcp:8081`로 호스트 Metro를 에뮬레이터의 localhost에 매핑. launch.sh가 처리. 재부팅 시 reverse 매핑이 풀리므로 `launch.sh metro` 또는 `up` 재실행.

- **카카오 로그인 → `Android keyHash validation failed`** — 카카오 개발자 콘솔 (앱 → 플랫폼 → Android)에 debug 빌드 keystore의 SHA1 keyHash가 등록 안 됨. **정확한 hash는 설치된 APK에서 직접 추출**해야 함 (keytool은 stderr warning이 stdout에 섞이면 hash 오염됨):
  ```bash
  adb -s emulator-5554 shell pm path com.denda.app  # APK 경로
  adb pull <path> /tmp/installed.apk
  "$ANDROID_HOME/build-tools/37.0.0/apksigner.bat" verify --print-certs /tmp/installed.apk
  # "certificate SHA-1 digest: <hex>" 라인 → hex를 base64로 변환:
  echo -n "<hex>" | xxd -r -p | openssl base64
  ```
  결과 base64 hash를 카카오 콘솔에 등록. (S01 후속 — 카카오 로그인 e2e 검증 차단 요소)

- **Expo Dev Client launcher 화면이 먼저 뜸** — 처음 앱을 열면 dev server 목록 화면이 뜨고, 서버 entry 탭해야 실제 앱 로드. launch.sh는 `am start MainActivity`로 직진하지만, Metro와 ConnectionLost된 경우 launcher가 뜰 수 있음. 해결: 한 번 launcher에서 server 탭하면 다음 런치부터 자동.

## Troubleshooting

- **`adb devices`에 아무것도 안 보임**: 에뮬레이터가 죽었거나 부팅 중. `launch.sh up`이 자동 재부팅. 수동: `"$ANDROID_HOME/emulator/emulator.exe" -avd Pixel_7`.

- **빌드 13초만에 실패 + `configuring project ... directory does not exist`**: stale 한글 경로 캐시. Gotchas의 두 번째 항목 참조.

- **앱이 흰 화면에서 멈춤**: Metro 연결 끊김. `launch.sh metro` 재시도 (adb reverse 다시 걸어줌) + `launch.sh reload`.

- **`The result of getSnapshot should be cached`** (RN 빨간 경고): `useAuth`/`useSyncExternalStore` selector가 매 호출 새 객체 리턴할 때 발생. zustand v5 `useStore`는 selector 결과를 캐싱하지 않음 (단순 useSyncExternalStore wrapper). 해결: selector는 primitive/stable ref만 리턴 → derived 객체는 render 본문에서 계산. 예: [app/index.tsx](../../../app/index.tsx)는 `useAuth((s) => decideGate({...}))` 대신 status·hasAgreedToTerms·hasCompletedOnboarding 3개를 따로 구독 후 decideGate 호출.
