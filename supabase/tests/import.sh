#!/usr/bin/env bash
# Integration test for the catalog importer against a throwaway database.
# Requires libpq env (PGHOST, PGPORT, PGUSER[, PGPASSWORD]).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=lv_import_test
psql -q -c "drop database if exists $DB" -c "create database $DB"
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f supabase/tests/supabase_stubs.sql
for f in supabase/migrations/*.sql; do $P -f "$f"; done
$P -f supabase/seed.sql
host=${PGHOST:-localhost}
if [[ "$host" == /* ]]; then export DATABASE_URL="postgres://${PGUSER:-postgres}:${PGPASSWORD:-}@localhost:${PGPORT:-5432}/$DB?host=$host";
else export DATABASE_URL="postgres://${PGUSER:-postgres}:${PGPASSWORD:-}@$host:${PGPORT:-5432}/$DB"; fi
unset REVALIDATE_URL REVALIDATE_SECRET
q() { psql -d $DB -tAc "$1"; }
fail() { echo "FAIL: $1"; exit 1; }
F=supabase/tests/fixtures

echo "1. invalid file is rejected with readable errors"
out=$(npx tsx scripts/import-catalog.mts $F/invalid.json 2>&1) && fail "invalid accepted"
for msg in "slug" "exige verified_at y source" "SKU duplicado" "has_dgpu=false" "RAM soldada" "no declarada" "foto oficial requiere"; do
  grep -q "$msg" <<<"$out" || fail "missing error: $msg"; done

echo "2. dry run changes nothing"
npx tsx scripts/import-catalog.mts $F/valid.json --dry-run >/dev/null
[[ $(q "select count(*) from models") == 0 ]] || fail "dry run wrote data"

echo "3. import"
npx tsx scripts/import-catalog.mts $F/valid.json >/dev/null
[[ $(q "select count(*) from variants") == 2 ]] || fail "variants"
[[ $(q "select count(*) from spec_sources where verified") == 3 ]] || fail "spec_sources"
[[ $(q "select display_resolution from variants where sku='T1-A'") == "2560×1600" ]] || fail "resolution normalisation"
[[ $(q "select has_dgpu from variants where sku='T1-A'") == "t" ]] || fail "has_dgpu inferred"
[[ $(q "select has_dgpu from variants where sku='T1-B'") == "f" ]] || fail "has_dgpu false"
[[ $(q "select array_to_string(ports, ',') from variants where sku='T1-A'") == "USB-C,HDMI" ]] || fail "array column"
[[ $(q "select commercial_status from models") == "current" ]] || fail "status"
[[ $(q "select count(*) from audit_log where table_name='models'") -ge 1 ]] || fail "audit"

echo "4. re-import is idempotent"
npx tsx scripts/import-catalog.mts $F/valid.json >/dev/null
[[ $(q "select count(*) from variants") == 2 ]] || fail "duplicated variants"
[[ $(q "select count(*) from images") == 1 ]] || fail "duplicated images"
[[ $(q "select count(*) from spec_sources") == 3 ]] || fail "duplicated provenance"
[[ $(q "select count(*) from sources where name='TEST Fabricante'") == 1 ]] || fail "duplicated sources"

echo "5. unknown component reference rolls back the whole file"
npx tsx scripts/import-catalog.mts $F/bad-reference.json >/dev/null 2>&1 && fail "bad reference accepted"
[[ $(q "select count(*) from models where slug='test-laptop-2'") == 0 ]] || fail "partial write"

echo "6. sync_runs recorded"
[[ $(q "select count(*) from sync_runs where job='catalog_import' and status='success'") -ge 2 ]] || fail "sync_runs success"
[[ $(q "select count(*) from sync_runs where job='catalog_import' and status='failed'") == 1 ]] || fail "sync_runs failed"
echo "Import tests passed"
