#!/usr/bin/env bash
set -euo pipefail

# Enforces file size limits from AGENTS.md rules:
#   Pages     <= 80 lines
#   TSX files <= 250 lines
#   Hooks     <= 150 lines

PAGE_MAX=80
TSX_MAX=250
HOOK_MAX=150

ROOT="${1:-src}"
EXIT_CODE=0
VIOLATIONS=0

check_lines() {
  local file="$1"
  local max="$2"
  local kind="$3"
  local lines
  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$max" ]; then
    echo "  [FAIL] $file: $lines lines (max $max) -- $kind"
    VIOLATIONS=$((VIOLATIONS + 1))
    EXIT_CODE=1
  fi
}

echo "File size check"
echo "  Pages <= $PAGE_MAX lines | TSX <= $TSX_MAX lines | Hooks <= $HOOK_MAX lines"
echo ""

# Pages
echo "Pages:"
for f in "$ROOT"/modules/*/pages/*.tsx; do
  [ -f "$f" ] || continue
  check_lines "$f" "$PAGE_MAX" "page exceeds limit"
done

echo ""
echo "All TSX files:"
while IFS= read -r -d '' f; do
  [[ "$f" == *.d.ts ]] && continue
  [[ "$f" == *.d.scss.ts ]] && continue
  [[ "$f" == */pages/* ]] && continue
  check_lines "$f" "$TSX_MAX" "TSX exceeds limit"
done < <(find "$ROOT" -name '*.tsx' -not -path '*/node_modules/*' -not -path '*/dist/*' -print0)

echo ""
echo "Hooks:"
while IFS= read -r -d '' f; do
  check_lines "$f" "$HOOK_MAX" "hook exceeds limit"
done < <(find "$ROOT" -name 'use-*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -print0)

echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "All files within limits."
else
  echo "$VIOLATIONS violation(s) found."
fi

exit $EXIT_CODE
