#!/bin/sh
set -eu

: "${APP_ENV:?APP_ENV is required}"
: "${DATABASE_NAME:?DATABASE_NAME is required}"
: "${DATABASE_MIGRATION_USER:?DATABASE_MIGRATION_USER is required}"
: "${DATABASE_MIGRATION_PASSWORD:?DATABASE_MIGRATION_PASSWORD is required}"
: "${DATABASE_RUNTIME_USER:?DATABASE_RUNTIME_USER is required}"
: "${DATABASE_RUNTIME_PASSWORD:?DATABASE_RUNTIME_PASSWORD is required}"

validate_identifier() {
  case "$1" in
    ''|[!a-z]*|*[!a-z0-9_]*) echo "Invalid PostgreSQL identifier" >&2; exit 1 ;;
  esac
  [ "${#1}" -le 63 ] || { echo "PostgreSQL identifier is too long" >&2; exit 1; }
}

validate_identifier "$DATABASE_NAME"
validate_identifier "$DATABASE_MIGRATION_USER"
validate_identifier "$DATABASE_RUNTIME_USER"

psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set database_name="$DATABASE_NAME" \
  --set migration_user="$DATABASE_MIGRATION_USER" \
  --set migration_password="$DATABASE_MIGRATION_PASSWORD" \
  --set runtime_user="$DATABASE_RUNTIME_USER" \
  --set runtime_password="$DATABASE_RUNTIME_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'migration_user', :'migration_password') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'runtime_user', :'runtime_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'database_name', :'migration_user') \gexec
SQL

psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DATABASE_NAME" \
  --set database_name="$DATABASE_NAME" \
  --set app_environment="$APP_ENV" \
  --set migration_user="$DATABASE_MIGRATION_USER" \
  --set runtime_user="$DATABASE_RUNTIME_USER" <<'SQL'
REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO :"migration_user", :"runtime_user";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA align AUTHORIZATION :"migration_user";
GRANT USAGE ON SCHEMA align TO :"runtime_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_user" IN SCHEMA align GRANT SELECT ON TABLES TO :"runtime_user";
ALTER DATABASE :"database_name" SET align.environment = :'app_environment';
ALTER DATABASE :"database_name" SET align.runtime_role = :'runtime_user';
SQL
