---
name: run-denda-device
description: Denda 앱을 USB 연결 실기기(Android 폰)에서 실행·디버그·검증. 실기기 테스트, 폰에서 실행, preview/release 빌드 검증, cold start 측정, logcat 에러 수집, 실기기 스크린샷 요청 시 호출. 에뮬레이터는 run-denda 사용.
---

# /run-denda-device

USB 연결 실기기에서 Denda를 돌리는 runbook. 두 모드:

- **dev** — dev client + Metro 핫리로드. 평소 버그 잡기·수정 루프 (JS 저장 → 즉시 반영).
- **preview** — EAS preview(release) APK. 배포 동일 환경. **60fps·cold start 측정은 반드시 이 모드** (testing 규칙: dev 모드 측정 금지).

체크리스트: [docs/DEVICE_TEST_CHECKLIST.md](../../../docs/DEVICE_TEST_CHECKLIST.md) — 테스트 세션 시작 시 필요한 섹션 골라 진행.

패키지명 `com.denda.app`. adb는 `$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe` (이하 `adb`로 표기).

## 0. 기기 연결 확인 (모든 모드 공통 첫 단계)

```bash
adb devices
```

| 출력 | 의미 → 조치 |
|---|---|
| `<serial>  device` | 정상 |
| `<serial>  unauthorized` | 폰 화면의 "USB 디버깅 허용" 팝업 승인 필요 (사용자에게 요청) |
| 목록 비어 있음 | USB 연결·개발자 옵션·케이블(충전 전용 케이블 주의) 확인 요청 |
| 기기 여러 대 | 이후 모든 adb에 `-s <serial>` 지정 (에뮬 동시 실행 시 흔함) |

## 1. dev 모드 (핫리로드 루프)

```bash
# dev client 설치 여부
adb shell pm list packages | grep com.denda.app

# 미설치 또는 네이티브 변경 후 → 빌드+설치 (JAVA_HOME은 run-denda와 동일하게 Android Studio JBR)
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
npx expo run:android --device   # 기기 선택 프롬프트 뜨면 실기기 선택

# 설치돼 있으면 Metro만
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client     # 백그라운드 실행 권장 (run_in_background)
adb shell am start -n com.denda.app/.MainActivity
```

**루프**: JS/TSX 수정 → 저장 → Fast Refresh 자동. 재빌드는 네이티브 의존성·patch-package 변경 시에만.

**USB 재연결·폰 화면 꺼짐 후 Metro 안 붙으면**: `adb reverse tcp:8081 tcp:8081` 재실행 (reverse 매핑은 재연결 시 풀림).

## 2. preview 모드 (배포 동일 환경)

```bash
npx eas-cli build --profile preview --platform android   # 클라우드 빌드, ~15-20분
# 완료 후 APK URL 다운로드 → 설치 (dev client와 서명 다르면 먼저 adb uninstall com.denda.app)
adb install <다운로드한.apk>
```

측정 (S05e·S13 잔여):

```bash
# cold start 전체 권위 숫자 (S13) — TotalTime 항목
adb shell am force-stop com.denda.app
adb shell am start -W com.denda.app/.MainActivity

# 60fps 그리드 (S05e) — 드래그 sweep 직후 실행, Janky frames 비율 확인
adb shell dumpsys gfxinfo com.denda.app
```

## 3. 버그 발견 시 수집 (모드 무관)

```bash
# 에러 로그 (dev 모드는 Metro 터미널이 우선, preview는 이것만)
adb logcat -d *:E | tail -50                      # 최근 에러 스냅샷
adb logcat -c && adb logcat ReactNativeJS:* *:E   # 클리어 후 라이브 재현

# 스크린샷
adb exec-out screencap -p > "$TMPDIR/device.png"  # 이후 Read로 확인
```

수정 루프: 로그·스크린샷으로 원인 파악 → 수정 → dev 모드면 저장 즉시 재확인, preview에서만 재현되는 버그면 수정 후 preview 재빌드 전에 dev에서 로직 검증 먼저.

## Gotchas

- **카카오 로그인이 실기기에서만 실패 (`keyHash validation failed`)** — 빌드 트랙별 서명이 다름: 로컬 debug / EAS development / EAS preview 각각 keyHash가 다르고 **전부 카카오 콘솔에 등록**돼야 함. hash 추출법은 [run-denda SKILL.md](../run-denda/SKILL.md) Gotchas 참조 (`apksigner verify --print-certs` → base64).
- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`** — dev client와 preview APK 서명 불일치. `adb uninstall com.denda.app` 후 설치. (설치 앱 데이터 날아감 — 로그인 다시 필요.)
- **폰이 Metro 못 찾음 / Dev Client launcher 화면** — `adb reverse` 누락. 걸어준 뒤 launcher에서 `http://localhost:8081` 탭.
- **`expo run:android --device`가 에뮬에 설치함** — 에뮬이 떠 있으면 프롬프트 없이 에뮬로 갈 수 있음. 실기기만 대상일 땐 에뮬 종료 또는 시리얼 지정.
- **preview 빌드 없이 성능 결론 내리기 금지** — dev client의 프레임 드랍·느린 cold start는 버그가 아닐 수 있음. 성능 이슈는 preview에서 재확인 후에만 보고.
