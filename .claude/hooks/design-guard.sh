#!/usr/bin/env bash
# PostToolUse hook for Edit/Write/MultiEdit.
# Reads tool input via stdin, grep new file content for anti-patterns from DESIGN.md / DECISIONS.md.
# Exits 2 on violation → Claude Code shows the message back to the model.
#
# Patterns covered (referenced in docs/DECISIONS.md):
#   D4  토스 풍 절제      — no gradients, no glassmorphism
#   D5  Purple discipline — no indigo, no random purples
#   D6  다크모드           — system auto only (no manual toggle)
#   D7  Pretendard         — banned fonts, no CDN
#   D13 KST timezone       — no bare new Date()
#   D14 15-min slots       — no hard-coded 30 in slot logic (heuristic)
#   D18 좌표 정규화        — Kakao Local API call must go through coords/normalize.ts (warn)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

# Read tool payload from stdin.
PAYLOAD="$(cat || true)"

# Extract the file being modified.
FILE_PATH="$(echo "$PAYLOAD" | extract_field 'tool_input.file_path')"
if [ -z "${FILE_PATH:-}" ]; then
  exit 0
fi

# Skip non-source files (docs, archives, node_modules, hook itself).
if ! is_source_file "$FILE_PATH"; then
  exit 0
fi

# OS-independent: is_source_file() filters by extension and directory exclusion.
# Removed Windows-only path matching that would silently disable hook on macOS/Linux.

# File may have just been written — read its current state.
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

CONTENT="$(cat "$FILE_PATH" 2>/dev/null || true)"
if [ -z "$CONTENT" ]; then
  exit 0
fi

# Track violations.
violations=()

check() {
  local pattern="$1"
  local message="$2"
  if echo "$CONTENT" | grep -E -q "$pattern" 2>/dev/null; then
    violations+=("$message")
  fi
}

# --- D4: 토스 풍 절제 ---
check '(^|[^a-zA-Z])bg-gradient-to-' \
  "D4: Tailwind gradient (bg-gradient-to-*) — 그라데이션 금지. tokens 사용."
check 'linear-gradient\(|radial-gradient\(' \
  "D4: CSS gradient — 그라데이션 금지."
check 'backdrop-(filter|blur)' \
  "D4: backdrop-filter/blur — 글래스모피즘 금지."

# --- D5: Purple discipline ---
check '(bg|text|border|from|to|via)-indigo-[0-9]' \
  "D5: Tailwind indigo-* — indigo 금지. brand-500(#7C3AED)만 사용."
# Direct hex colors (3, 6, or 8 hex chars). Allow in tokens.ts / theme.ts itself.
case "$FILE_PATH" in
  *tokens.ts|*tokens.tsx|*theme.ts|*theme.tsx) ;;
  *)
    if echo "$CONTENT" | grep -E -q "#[0-9a-fA-F]{6}([^0-9a-fA-F]|$)" 2>/dev/null; then
      violations+=("D5: Direct hex color (#RRGGBB) detected — tokens 참조 사용 (tokens.light.brand[500] 등). file: $FILE_PATH")
    fi
    ;;
esac

# --- D6: 다크모드 시스템 자동 ---
check 'Appearance\.set|setColorScheme\(|toggleColorScheme' \
  "D6: 다크모드 수동 토글 금지 (Phase 1+2). 시스템 자동만."

# --- D7: Banned fonts ---
check "font-family[^;]*['\"]?(Inter|Roboto|Noto Sans|Apple SD Gothic Neo|Spoqa Han Sans)" \
  "D7: 금지 폰트 (Inter/Roboto/Noto/Apple SD/Spoqa). Pretendard Variable만."
check "fontFamily:[^,]*['\"]?(Inter|Roboto|Noto Sans|Apple SD Gothic Neo|Spoqa Han Sans)" \
  "D7: 금지 폰트 (fontFamily). Pretendard Variable만."
check 'fonts\.googleapis\.com' \
  "D7: CDN 폰트 로딩 금지. 셀프호스팅 WOFF2."

# --- D13: KST timezone ---
# Bare `new Date()` calls (no Asia/Seoul context). Allow `new Date(string)` and `new Date(0)`.
# Allow in test files (mocks) and in luxon/date-fns-tz wrappers themselves.
case "$FILE_PATH" in
  *.test.*|*.spec.*|*tests/*|*lib/time*|*lib/kst*) ;;
  *)
    if echo "$CONTENT" | grep -E -q '[^a-zA-Z_]new Date\(\s*\)' 2>/dev/null; then
      violations+=("D13: bare 'new Date()' detected — KST 미명시. luxon DateTime.now().setZone('Asia/Seoul') 사용. file: $FILE_PATH")
    fi
    # Date().toLocaleString() without timezone option
    if echo "$CONTENT" | grep -E -q '\.toLocaleString\(\s*\)' 2>/dev/null; then
      violations+=("D13: toLocaleString() without locale/timezone — { timeZone: 'Asia/Seoul', locale: 'ko-KR' } 명시.")
    fi
    ;;
esac

# --- D18: Kakao Local API direct calls ---
# Warn (not block) if dapi.kakao.com is called outside lib/places/ or coords/.
case "$FILE_PATH" in
  *lib/places/*|*lib/coords/*|*supabase/functions/*) ;;
  *)
    if echo "$CONTENT" | grep -E -q 'dapi\.kakao\.com/v2/local' 2>/dev/null; then
      warn "D18: Direct Kakao Local API call detected outside lib/places/ — PlaceSearchProvider interface 경유 권장. file: $FILE_PATH"
    fi
    ;;
esac

# --- Phase 3 코드 누출 검출 (PROJECT_CONTEXT.md §6 절대 금지) ---
# Gate #2 ≥25% 통과 전까지 다음 패턴은 모두 차단.
# reviewer.md가 이 책임을 hook으로 이관함.
case "$FILE_PATH" in
  *.test.*|*.spec.*|*tests/*|*.md|*archive/*) ;;  # 테스트·문서·archive 제외
  *)
    # 1. 토스페이먼츠 SDK / 위젯 코드
    check '@tosspayments|tosspayments|TossPayments' \
      "🔒 Phase 3: 토스페이먼츠 SDK import 금지 (PROJECT_CONTEXT §6). Gate #2 ≥25% 후 commit."

    # 2. 금지 테이블 schema 참조 (D3 — Phase 3 schema lock-in 회피)
    # 두 가지 패턴: ORM quoted (`from('reservations')`) + SQL 키워드 + 공백
    check "['\"\`](reservations|payments|payouts)['\"\`]|(FROM|JOIN|INSERT INTO|UPDATE)[[:space:]]+(reservations|payments|payouts)[^a-zA-Z_]" \
      "🔒 Phase 3: reservations/payments/payouts 테이블 참조 금지 (D3). Phase 1+2은 partnerships만."

    # 3. groups.reservation_id column (Phase 3에서 추가) — group./groups. 양쪽 잡음
    check 'groups?\.reservation_id|reservation_id[[:space:]]*:' \
      "🔒 Phase 3: groups.reservation_id column은 Phase 3에서 추가 (D3)."

    # 4. F6/F7 push 알림 (Phase 1+2은 F1~F5만)
    check 'notify_f6|notify_f7|F6_|F7_|"f6"|"f7"|'\''f6'\''|'\''f7'\''' \
      "🔒 Phase 3: F6/F7 푸시 알림 금지 (Phase 1+2은 F1~F5)."

    # 5. 캐치테이블 직결 (D2 폐기)
    check 'catchtable|캐치테이블' \
      "🔒 폐기 결정 (D2): 캐치테이블 직결 금지."
  ;;
esac

# --- Non-Korean UI labels (Phase 1+2 한국어 only) ---
# Match common English UI words that frequently slip in. Allow in code comments and tests.
case "$FILE_PATH" in
  *.test.*|*.spec.*|*tests/*|*.md) ;;
  *)
    # Look for English UI strings in JSX text content or common prop values.
    if echo "$CONTENT" | grep -E -q '>(Loading\.\.\.|Submit|Cancel|Confirm|Continue|Done|OK|Sign in|Sign up|Log in|Log out)<' 2>/dev/null; then
      warn "ko-KR: 영문 UI 라벨 감지 — 한국어 라벨 사용 (베타 한국어 only). file: $FILE_PATH"
    fi
    ;;
esac

# Report.
if [ ${#violations[@]} -gt 0 ]; then
  echo "[design-guard] $FILE_PATH" >&2
  for v in "${violations[@]}"; do
    echo "  ❌ $v" >&2
  done
  echo "" >&2
  echo "  관련 결정: docs/DECISIONS.md · 단일 시각 진실: docs/DESIGN.md" >&2
  exit 2
fi

exit 0
