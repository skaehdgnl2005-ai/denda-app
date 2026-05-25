#!/usr/bin/env bash
# Denda app launcher for Android emulator.
# 사용:
#   ./launch.sh                  — 풀 콜드스타트 (에뮬 부팅 → 빌드 → 설치 → 런치 → 스크린샷)
#   ./launch.sh screenshot [name] — 현재 화면 스크린샷 (기본 /tmp/denda.png)
#   ./launch.sh metro             — Metro만 별도 기동 (JS edit hot reload용)
#   ./launch.sh reload            — 앱 RN 리로드 (Metro에 RR 시그널)
#   ./launch.sh stop              — 앱 종료 (에뮬은 유지)
#
# 환경:
# - Windows + Git Bash 가정 (또는 WSL bash)
# - ANDROID_HOME 환경변수 (~/.bashrc) 또는 기본 경로 fallback
# - JAVA_HOME 자동 탐지 (Android Studio JBR 우선)

set -e

# --- 환경 셋업 -----------------------------------------------------

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AVD_NAME="${DENDA_AVD:-Pixel_7}"
APP_ID="com.denda.app"
APK_PATH="$REPO_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

: "${ANDROID_HOME:=$HOME/AppData/Local/Android/Sdk}"
export ANDROID_HOME

# Windows bash 경로 정규화 — C:\Users → /c/Users
case "$ANDROID_HOME" in
  [A-Za-z]:*) ANDROID_HOME="/$(echo "$ANDROID_HOME" | sed 's|\\|/|g; s|^\([A-Za-z]\):|\L\1|')" ;;
esac

ADB="$ANDROID_HOME/platform-tools/adb.exe"
EMU="$ANDROID_HOME/emulator/emulator.exe"

# JAVA_HOME 자동 탐지 — Android Studio JBR 우선
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java.exe" ] && [ ! -x "$JAVA_HOME/bin/java" ]; then
  for cand in \
    "/c/Program Files/Android/Android Studio/jbr" \
    "/c/Program Files/Eclipse Adoptium/jdk-17.0.0.7-hotspot" \
    "$HOME/AppData/Local/Programs/Eclipse Adoptium"; do
    if [ -x "$cand/bin/java.exe" ] || [ -x "$cand/bin/java" ]; then
      export JAVA_HOME="$cand"
      break
    fi
  done
fi
if [ -z "${JAVA_HOME:-}" ]; then
  echo "ERROR: JAVA_HOME 미탐지. Android Studio JBR 또는 JDK 17 설치 필요." >&2
  exit 1
fi
export PATH="$JAVA_HOME/bin:$PATH"

# --- 헬퍼 ----------------------------------------------------------

device_id() {
  "$ADB" devices 2>/dev/null | awk 'NR>1 && /\tdevice$/ {print $1; exit}'
}

wait_boot() {
  local d
  echo "에뮬레이터 부팅 대기..."
  until d=$(device_id) && [ -n "$d" ]; do sleep 2; done
  until "$ADB" -s "$d" shell getprop sys.boot_completed 2>/dev/null | grep -q 1; do sleep 3; done
  echo "부팅 완료 ($d)"
}

ensure_emulator() {
  if [ -n "$(device_id)" ]; then
    echo "에뮬레이터 이미 실행 중"
    return
  fi
  echo "AVD '$AVD_NAME' 부팅..."
  ( "$EMU" -avd "$AVD_NAME" -no-snapshot-save >/tmp/denda-emu.log 2>&1 & )
  wait_boot
}

metro_listening() {
  netstat -ano 2>/dev/null | grep -q "0.0.0.0:8081.*LISTENING"
}

start_metro() {
  if metro_listening; then
    echo "Metro 이미 8081에서 listening"
    return
  fi
  echo "Metro 기동..."
  ( cd "$REPO_ROOT" && npx expo start --dev-client >/tmp/denda-metro.log 2>&1 & )
  local n=0
  until metro_listening; do
    sleep 1; n=$((n+1))
    [ $n -gt 60 ] && { echo "Metro 60s 내 기동 실패. /tmp/denda-metro.log 확인" >&2; exit 1; }
  done
  echo "Metro ready"
}

install_apk() {
  local d=$1
  echo "APK 설치..."
  if ! "$ADB" -s "$d" install -r "$APK_PATH" 2>&1 | tee /tmp/denda-install.log | grep -q Success; then
    if grep -q INSTALL_FAILED_UPDATE_INCOMPATIBLE /tmp/denda-install.log; then
      echo "서명 불일치 — 기존 패키지 uninstall 후 재설치"
      "$ADB" -s "$d" uninstall "$APP_ID" || true
      "$ADB" -s "$d" install "$APK_PATH"
    else
      echo "ERROR: 설치 실패" >&2; cat /tmp/denda-install.log >&2; exit 1
    fi
  fi
}

launch_app() {
  local d=$1
  "$ADB" -s "$d" reverse tcp:8081 tcp:8081
  "$ADB" -s "$d" shell am force-stop "$APP_ID" || true
  "$ADB" -s "$d" shell am start -n "$APP_ID/.MainActivity"
}

screenshot() {
  local d name
  d=$(device_id) || { echo "ERROR: 디바이스 없음" >&2; exit 1; }
  name="${1:-denda}"
  local out="/tmp/${name}.png"
  "$ADB" -s "$d" exec-out screencap -p > "$out"
  echo "$out"
}

# --- 서브커맨드 ---------------------------------------------------

cmd="${1:-up}"
case "$cmd" in
  up)
    ensure_emulator
    DEV=$(device_id)

    # 빌드. 한글 경로 leak 가능성 있는 stale cache는 사용자에게 알림.
    if grep -rq "된다 앱" "$REPO_ROOT/android/build" 2>/dev/null; then
      echo "WARN: android/build/ 에 stale 한글 경로 있음. 정리 후 빌드:" >&2
      echo "  rm -rf android/build android/app/build android/.gradle" >&2
    fi

    echo "Gradle 빌드 시작..."
    ( cd "$REPO_ROOT" && npx expo run:android --device "$DEV" --no-install 2>&1 | tail -20 ) || {
      # expo run:android 가 설치 단계에서 fail 해도 APK는 빌드됐을 가능성 큼.
      [ -f "$APK_PATH" ] || { echo "ERROR: APK 빌드 실패" >&2; exit 1; }
    }

    install_apk "$DEV"
    start_metro
    launch_app "$DEV"
    sleep 10
    out=$(screenshot "denda-launch")
    echo ""
    echo "✓ 앱 실행 중. 스크린샷: $out"
    echo "  JS만 변경 시: ./launch.sh reload"
    echo "  스크린샷:     ./launch.sh screenshot [name]"
    ;;

  screenshot|ss)
    screenshot "${2:-denda}"
    ;;

  metro)
    start_metro
    DEV=$(device_id) && "$ADB" -s "$DEV" reverse tcp:8081 tcp:8081
    ;;

  reload)
    DEV=$(device_id) || { echo "ERROR: 디바이스 없음" >&2; exit 1; }
    # Dev menu → Reload. RR는 키 이벤트 두 번.
    "$ADB" -s "$DEV" shell input keyevent 82  # KEYCODE_MENU = dev menu
    sleep 1
    "$ADB" -s "$DEV" shell input keyevent 46  # KEYCODE_R
    "$ADB" -s "$DEV" shell input keyevent 46
    echo "Reload 시그널 전송"
    ;;

  stop)
    DEV=$(device_id) || exit 0
    "$ADB" -s "$DEV" shell am force-stop "$APP_ID"
    echo "앱 종료. 에뮬은 유지."
    ;;

  *)
    echo "사용법: $0 [up|screenshot [name]|metro|reload|stop]" >&2
    exit 2
    ;;
esac
