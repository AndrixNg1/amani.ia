#!/usr/bin/env bash
# Owner-run, read-only verification against an ALREADY RUNNING Compose stack.
# Never starts containers, creates tables, modifies grants, or removes data.
set +x
set -euo pipefail
postgres_verify_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$postgres_verify_dir/../.."

docker compose exec -T postgres bash -c '
  set +x
  set -euo pipefail
  export PGPASSWORD="$POSTGRES_PASSWORD"
  export PGCONNECT_TIMEOUT=5
  exec psql --no-psqlrc --no-password --set=ON_ERROR_STOP=1 \
    --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
' < "$postgres_verify_dir/verify.sql"

for service in core_platform knowledge data_analytics conversations connectors evaluation; do
  password_variable="${service^^}_DB_PASSWORD"
  docker compose exec -T postgres bash -c '
    set +x
    set -euo pipefail
    service="$1"
    password_variable="$2"
    export PGPASSWORD="${!password_variable}"
    export PGCONNECT_TIMEOUT=5
    result="$(psql --no-psqlrc --no-password --tuples-only --no-align \
      --set=ON_ERROR_STOP=1 --host=127.0.0.1 --username="amani_$service" \
      --dbname="$POSTGRES_DB" --command="SELECT current_user || '\''|'\'' || current_schema()")"
    if [[ "$result" != "amani_$service|$service" ]]; then
      printf "FAIL: unexpected service identity or default schema.\n" >&2
      exit 1
    fi
    # A successful connection here would reveal a trust/pg_hba authentication bypass.
    export PGPASSWORD="${PGPASSWORD}-amani-invalid-password-probe"
    if psql --no-psqlrc --no-password --host=127.0.0.1 \
      --username="amani_$service" --dbname="$POSTGRES_DB" \
      --command="SELECT 1" >/dev/null 2>&1; then
      printf "FAIL: a deliberately wrong service password was accepted.\n" >&2
      exit 1
    fi
    printf "PASS: %s login, schema and wrong-password rejection.\n" "$service"
  ' bash "$service" "$password_variable"
done
