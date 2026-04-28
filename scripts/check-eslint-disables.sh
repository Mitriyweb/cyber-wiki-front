#!/bin/bash

# Check eslint-disable directives count against baseline
# Fails if count exceeds baseline, preventing uncontrolled growth

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASELINE_FILE="$SCRIPT_DIR/eslint-disable-baseline.json"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$BASELINE_FILE" ]; then
  echo "❌ Error: Baseline file not found at $BASELINE_FILE"
  exit 1
fi

BASELINE_COUNT=$(grep -o '"count":[[:space:]]*[0-9]*' "$BASELINE_FILE" | grep -o '[0-9]*')

if [ -z "$BASELINE_COUNT" ]; then
  echo "❌ Error: Could not read baseline count from $BASELINE_FILE"
  exit 1
fi

CURRENT_COUNT=$(grep -r "eslint-disable" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  "$PROJECT_ROOT/src" 2>/dev/null | wc -l | tr -d ' ')

echo "ESLint Disable Directive Check"
echo "==============================="
echo "Baseline: $BASELINE_COUNT"
echo "Current:  $CURRENT_COUNT"

if [ "$CURRENT_COUNT" -gt "$BASELINE_COUNT" ]; then
  echo ""
  echo "❌ FAILED: Current count ($CURRENT_COUNT) exceeds baseline ($BASELINE_COUNT)"
  echo ""
  grep -rn "eslint-disable" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    "$PROJECT_ROOT/src" 2>/dev/null | head -20
  echo ""
  echo "Please fix the code instead of disabling ESLint rules."
  exit 1
elif [ "$CURRENT_COUNT" -lt "$BASELINE_COUNT" ]; then
  echo ""
  echo "✓ PASSED: Current count is below baseline"
  echo "Consider updating the baseline to: $CURRENT_COUNT"
  exit 0
else
  echo ""
  echo "✓ PASSED: Current count matches baseline"
  exit 0
fi
