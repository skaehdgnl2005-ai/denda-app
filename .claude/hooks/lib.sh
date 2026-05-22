#!/usr/bin/env bash
# Common helpers for Claude Code hooks.
# Source: bash .claude/hooks/lib.sh

# Extract a field from the JSON payload that Claude Code passes via stdin to PostToolUse hooks.
# Usage: value=$(extract_field "tool_input.file_path")
extract_field() {
  local field="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r ".${field} // empty" 2>/dev/null
  else
    # Fallback: naive grep (single-line, top-level keys only).
    python -c "import json,sys; d=json.load(sys.stdin); k='${field}'.split('.'); o=d
for p in k:
    o = o.get(p) if isinstance(o, dict) else None
    if o is None: break
print(o if o is not None else '')" 2>/dev/null
  fi
}

# Print red error message + exit 2 (Claude Code reads stderr + recognizes exit 2 as hard stop).
fail() {
  echo "[design-guard] BLOCKED: $*" >&2
  exit 2
}

# Print warning (continues — exit 0).
warn() {
  echo "[design-guard] WARN: $*" >&2
}

# Check if a file path matches Phase 1+2 source code we want to lint.
# Excludes: node_modules, .expo, dist, build, archive docs, hooks themselves.
is_source_file() {
  local file="$1"
  case "$file" in
    *node_modules*|*.expo*|*/dist/*|*/build/*|*archive/*|*\.claude/hooks/*)
      return 1 ;;
  esac
  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.css|*.scss)
      return 0 ;;
    *)
      return 1 ;;
  esac
}
