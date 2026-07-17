#!/usr/bin/env bash
# scripts/seed-dev.sh — generate a seeded development database
#
# Usage:
#   ./scripts/seed-dev.sh                          # default: 120 employees, 2 years
#   ./scripts/seed-dev.sh --employees 50 --days 90  # small test dataset
#
# Generates dev.db in the project root with:
#   - Realistic employee names (Arabic first + last names)
#   - Biometric devices with realistic serial numbers and IPs
#   - Daily punches (check-in, break-out, break-in, check-out)
#   - Realistic anomalies: late arrivals, missing check-outs, weekend work
#   - Admin user (admin / admin)
#
# After seeding, start the server with:
#   RUST_LOG=info cargo run -- --db sqlite://dev.db

set -euo pipefail
cd "$(dirname "$0")/.."

echo "═══ timekeep dev seeder ═══"
echo ""

cargo run --bin seed --features seed -- \
    --output dev.db \
    --force \
    "$@"

echo ""
echo "Done. Start the server with:"
echo "  RUST_LOG=info cargo run -- --db sqlite://dev.db"
