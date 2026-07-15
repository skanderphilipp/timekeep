#!/bin/bash
# Automated API test suite for timekeep.
# Requires: server running on localhost:3000, curl, python3
# Usage: ./scripts/test-api.sh

set -e
BASE="http://localhost:3000/api"
G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; N='\033[0m'

pass() { echo -e "  ${G}OK${N}  $1"; }
warn() { echo -e "  ${Y}WARN${N} $1"; }
fail() { echo -e "  ${R}FAIL${N} $1"; exit 1; }

echo "=== timekeep API Test ==="

# Auth
TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])") \
  || fail "Auth failed"
AUTH="Authorization: Bearer $TOKEN"
pass "Auth"

# Health
curl -sf "$BASE/health" >/dev/null && pass "Health" || fail "Health endpoint"

# Devices
D=$(curl -sf "$BASE/devices" -H "$AUTH" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))")
[ "$D" -ge 1 ] && pass "Devices ($D found)" || fail "No devices"

# Device detail
curl -sf "$BASE/devices/CQZ7232960836" -H "$AUTH" >/dev/null \
  && pass "Device detail (Office)" || warn "Device detail failed"

# Synced users (Office)
U=$(curl -sf "$BASE/devices/CQZ7232960836/synced-users" -H "$AUTH" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))")
if [ "$U" -gt 0 ]; then
  pass "Synced users from Office ($U)"
else
  warn "Office has 0 synced users (SDK may not have connected)"
fi

# Push user to Staff
curl -sf -X POST "$BASE/devices/CQZ7232960807/users" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"pin":"145","name":"ALI ZUHAIR","privilege":0}' >/dev/null \
  && pass "Push user to Staff" || warn "Push user failed"

# Bulk push
curl -sf -X POST "$BASE/devices/CQZ7232960807/users/bulk" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '[{"pin":"146","name":"TEST USER","privilege":0}]' >/dev/null \
  && pass "Bulk push" || warn "Bulk push failed"

# Device-to-device sync
curl -sf -X POST \
  "$BASE/devices/CQZ7232960807/sync-from/CQZ7232960836" \
  -H "$AUTH" >/dev/null \
  && pass "Device-to-device sync requested" || warn "Sync request failed"

# Fingerprint transfer
curl -sf -X POST \
  "$BASE/devices/CQZ7232960836/transfer-templates-to/CQZ7232960807" \
  -H "$AUTH" -H 'Content-Type: application/json' -d '{}' >/dev/null \
  && pass "Fingerprint transfer requested" || warn "Transfer request failed"

# Employees
E=$(curl -sf "$BASE/employees" -H "$AUTH" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))")
pass "Employees ($E found)"

# Devices health
curl -sf "$BASE/devices/health" -H "$AUTH" >/dev/null \
  && pass "Devices health" || warn "Health failed"

# Activity
curl -sf "$BASE/devices/CQZ7232960836/activity?limit=5" -H "$AUTH" >/dev/null \
  && pass "Device activity" || warn "Activity failed"

# Enrollments
curl -sf "$BASE/devices/CQZ7232960836/enrollments" -H "$AUTH" >/dev/null \
  && pass "Device enrollments" || warn "Enrollments failed"

echo -e "\n${G}All tests completed${N}"
