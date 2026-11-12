#!/usr/bin/env bash
# Applies stubs + migrations + seed to a throwaway database and runs security smoke tests.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=lv_test
psql -q -c "drop database if exists $DB" -c "create database $DB"
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f supabase/tests/supabase_stubs.sql
for f in supabase/migrations/*.sql; do $P -f "$f"; done
$P -f supabase/seed.sql
out=$(psql -d $DB -f supabase/tests/rls_smoke.sql 2>&1)
echo "$out"
grep -q "No autorizado para cambiar rol" <<<"$out"
grep -q 'violates row-level security policy for table "brands"' <<<"$out"
grep -qE '^\s*f\s*\|\s*pending' <<<"$out"
grep -qE '^\s*t\s*\|\s*t\s*\|\s*f' <<<"$out"
grep -q 'status_requires_verification' <<<"$out"
cout=$(psql -d $DB -q -f supabase/tests/community_smoke.sql 2>&1)
echo "$cout" | grep -E "PASS|FAIL"
if grep -q FAIL <<<"$cout" || [[ $(grep -c PASS <<<"$cout") -lt 12 ]]; then echo "Community tests failed"; echo "$cout" | grep -i error; exit 1; fi
echo "DB tests passed"
