#!/usr/bin/env bash
# Executed by the PostgreSQL image only when PGDATA is empty.
# It is intentionally not a migration runner or credential rotation tool.
set +x
set -euo pipefail

postgres_init_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

for variable in POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD \
  CORE_PLATFORM_DB_PASSWORD KNOWLEDGE_DB_PASSWORD DATA_ANALYTICS_DB_PASSWORD \
  CONVERSATIONS_DB_PASSWORD CONNECTORS_DB_PASSWORD EVALUATION_DB_PASSWORD; do
  if [[ -z "${!variable:-}" ]]; then
    printf 'PostgreSQL bootstrap: required variable %s is missing.\n' "$variable" >&2
    exit 1
  fi
done

for variable in POSTGRES_USER POSTGRES_DB; do
  if [[ ! "${!variable}" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]]; then
    printf 'PostgreSQL bootstrap: %s must be a simple SQL identifier (max 63 characters).\n' "$variable" >&2
    exit 1
  fi
done
password_names=(POSTGRES_PASSWORD CORE_PLATFORM_DB_PASSWORD KNOWLEDGE_DB_PASSWORD
  DATA_ANALYTICS_DB_PASSWORD CONVERSATIONS_DB_PASSWORD CONNECTORS_DB_PASSWORD EVALUATION_DB_PASSWORD)
for ((i = 0; i < ${#password_names[@]}; i++)); do
  for ((j = i + 1; j < ${#password_names[@]}; j++)); do
    first="${password_names[i]}"
    second="${password_names[j]}"
    if [[ "${!first}" == "${!second}" ]]; then
      printf 'PostgreSQL bootstrap: every administrator/service password must be distinct.\n' >&2
      exit 1
    fi
  done
done

# Reserve SQL role names and administrative databases; never turn a service into admin.
case "$POSTGRES_USER" in
  amani_core_platform|amani_knowledge|amani_data_analytics|amani_conversations|amani_connectors|amani_evaluation)
    printf 'PostgreSQL bootstrap: POSTGRES_USER must be a separate administrator.\n' >&2
    exit 1 ;;
esac
case "$POSTGRES_DB" in
  postgres|template0|template1)
    printf 'PostgreSQL bootstrap: choose a dedicated POSTGRES_DB, e.g. amani.\n' >&2
    exit 1 ;;
esac

# Secrets reach psql through its environment (\getenv), never through argv or eval.
# Avoid printing SQL/errors that might contain interpolated passwords.
if ! psql --no-psqlrc --no-password --quiet --single-transaction \
  --set=ON_ERROR_STOP=1 --set=ECHO=none --set=VERBOSITY=terse \
  --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
  --file="$postgres_init_dir/sql/bootstrap.sql" >/dev/null 2>&1; then
  printf 'PostgreSQL service bootstrap failed; transaction rolled back. Review configuration and SQL privately; do not enable SQL echo with secrets.\n' >&2
  exit 1
fi
printf 'PostgreSQL service ownership bootstrap completed (six isolated schemas).\n'
