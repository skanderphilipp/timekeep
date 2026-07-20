#!/usr/bin/env bash
# ── Nesting Depth Check (Rule 9) ────────────────────────────────────
#
# Checks that no function exceeds 3 levels of brace nesting.
# A "nesting level" is an indent-producing block:
#   if, match, for, while, loop, async blocks, closures
#
# We count brace depth. A well-structured function has:
#   Depth 1: fn body {
#   Depth 2:   if condition {
#   Depth 3:     match value {
#   Depth 4:       VIOLATION — action inside match
#
# False positives possible: deeply nested struct literals, macros.
# These are rare in practice and worth flagging for review anyway.
#
# Usage:
#   ./scripts/check-nesting-depth.sh          # check all crates
#   ./scripts/check-nesting-depth.sh -v       # verbose (show max depth per file)
#   ./scripts/check-nesting-depth.sh -f FILE  # check single file
#
# Exit 0 if all functions pass. Exit 1 with violations.

set -euo pipefail

MAX_BRACE_DEPTH=4   # fn body { + 3 nested blocks = depth 4 = violation
VERBOSE=false
TARGET_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--verbose) VERBOSE=true; shift ;;
    -f|--file) TARGET_FILE="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

VIOLATIONS=0
FILES_CHECKED=0

check_file() {
  local file="$1"
  local depth=0
  local max_depth=0
  local line_num=0
  local max_line=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))

    # Count braces on this line (pipefail safe — grep -c always succeeds)
    local opens
    opens=$(echo "$line" | grep -c '{' || true)
    local closes
    closes=$(echo "$line" | grep -c '}' || true)

    depth=$((depth + opens - closes))

    if [ "$depth" -gt "$max_depth" ]; then
      max_depth=$depth
      max_line=$line_num
    fi

    if [ "$depth" -gt "$MAX_BRACE_DEPTH" ]; then
      echo "  VIOLATION: $file:$line_num — brace depth $depth (max allowed: $MAX_BRACE_DEPTH)"
      # Only show first 5 violations per file to avoid noise
      VIOLATIONS=$((VIOLATIONS + 1))
      if [ "$VIOLATIONS" -ge 5 ] && [ "$VERBOSE" != "true" ]; then
        echo "  ... (suppressing further violations in this file, use -v for all)"
        break
      fi
    fi
  done < "$file"

  if [ "$VERBOSE" = "true" ]; then
    echo "  $file — max depth: $max_depth (line $max_line)"
  fi
}

echo "Checking nesting depth (max $MAX_BRACE_DEPTH brace levels)..."

if [ -n "$TARGET_FILE" ]; then
  if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: file not found: $TARGET_FILE"
    exit 1
  fi
  check_file "$TARGET_FILE"
  FILES_CHECKED=1
else
  # Find all production .rs files, exclude tests and generated code
  while IFS= read -r file; do
    check_file "$file"
    FILES_CHECKED=$((FILES_CHECKED + 1))
  done < <(find crates -name '*.rs' ! -path '*/tests/*' ! -name '*test*' -type f 2>/dev/null)
fi

echo ""

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $VIOLATIONS nesting violation(s) found in $FILES_CHECKED file(s)."
  echo ""
  echo "  Fix strategies:"
  echo "    1. Guard clauses (early return/continue) to flatten if-chains"
  echo "    2. Extract inner blocks into named helper functions"
  echo "    3. Use let-else or ? to eliminate error-handling nesting"
  echo "    4. Use iterator combinators (map, filter, find) instead of loops"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

echo "  ✅ No violations in $FILES_CHECKED file(s)."
