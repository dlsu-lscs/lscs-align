# Environment and Secret Contract

Staging and production are configured independently. Values in one column must never be copied to the other except the immutable release image digests. Bitwarden is authoritative for secrets; Dokploy injects application runtime values; GitHub receives only deployment capabilities and notification credentials.

## Dokploy project values

| Name                          | Classification          | Staging value or rule                 | Production value or rule                    | Owner                   |
| ----------------------------- | ----------------------- | ------------------------------------- | ------------------------------------------- | ----------------------- |
| `COMPOSE_PROJECT_NAME`        | configuration           | `align-staging`                       | `align-production`                          | Senior DevSecOps        |
| `DATABASE_NAME`               | configuration           | `align_staging`                       | `align_production`                          | Database operator       |
| `DATABASE_RUNTIME_USER`       | configuration           | unique staging role                   | unique production role                      | Database operator       |
| `DATABASE_RUNTIME_PASSWORD`   | secret                  | unique random value                   | different unique random value               | Database operator       |
| `DATABASE_MIGRATION_USER`     | configuration           | unique staging role                   | unique production role                      | Database operator       |
| `DATABASE_MIGRATION_PASSWORD` | secret                  | unique random value                   | different unique random value               | Database operator       |
| `POSTGRES_ADMIN_PASSWORD`     | secret                  | unique bootstrap value                | different unique bootstrap value            | Senior DevSecOps        |
| `SESSION_SECRET`              | secret                  | at least 32 random bytes              | different value of at least 32 random bytes | Backend Tech Lead       |
| `APP_ORIGIN`                  | configuration           | `https://staging-align.dlsu-lscs.org` | `https://align.dlsu-lscs.org`               | Senior DevSecOps        |
| `APP_DOMAIN`                  | configuration           | `staging-align.dlsu-lscs.org`         | `align.dlsu-lscs.org`                       | Senior DevSecOps        |
| `ROUTER_PREFIX`               | configuration           | `align-staging`                       | `align-production`                          | Senior DevSecOps        |
| `TRAEFIK_NETWORK`             | configuration           | approved `lscsdev1` edge network      | approved `lscsprod1` edge network           | Infrastructure operator |
| `GOOGLE_OAUTH_CLIENT_ID`      | sensitive configuration | staging-only OAuth client             | production-only OAuth client                | Backend Tech Lead       |
| `GOOGLE_OAUTH_CLIENT_SECRET`  | secret                  | staging-only secret                   | production-only secret                      | Backend Tech Lead       |
| `GOOGLE_OAUTH_REDIRECT_URI`   | configuration           | staging callback origin               | production callback origin                  | Backend Tech Lead       |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | sensitive configuration | staging SigNoz endpoint               | production SigNoz endpoint                  | Observability operator  |
| `OTEL_EXPORTER_OTLP_HEADERS`  | secret                  | staging ingestion identity            | production ingestion identity               | Observability operator  |

The release renderer pins `APP_ENV`, `SOURCE_COMMIT`, `EXPECTED_DATABASE_NAME`, `WEB_IMAGE`, `API_IMAGE`, and `OTEL_SERVICE_NAME` from the selected protected environment and signed-off release manifest. Operators must not override those values in Dokploy.

## GitHub protected-environment values

Each GitHub environment has its own `DOKPLOY_URL` and `DOKPLOY_COMPOSE_ID` variables and its own narrowly scoped `DOKPLOY_API_KEY` and `DISCORD_WEBHOOK_URL` secrets. Staging additionally has a Cloudflare Access service token in `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET`. Production defines `DOKPLOY_BACKUP_ID`, `DOKPLOY_BACKUP_DESTINATION_ID`, and `DOKPLOY_BACKUP_SEARCH` variables. A Dokploy key may update and deploy only the matching Compose project; it must not administer hosts, users, or the other environment.

Pull-request workflows reference no secrets. GitHub must not store database, OAuth, session, PostgreSQL administration, or telemetry ingestion credentials.

## Bitwarden records and rotation

Use separate restricted Bitwarden items named `Align / Staging / Runtime`, `Align / Staging / OAuth`, `Align / Staging / Telemetry`, `Align / Production / Runtime`, `Align / Production / OAuth`, and `Align / Production / Telemetry`. Record owner, consumer, creation time, last rotation, next review, revocation procedure, and emergency contact without copying values into issues.

Rotate a credential in this order: create a replacement, update its authorized consumer, verify readiness and authentication, revoke the old value, test that the old value fails, and record non-sensitive evidence. For a database role, use `ALTER ROLE ... PASSWORD`, update only the matching Dokploy project, redeploy, verify readiness, then prove the old credential cannot connect. Treat emergency replacement as an incident and follow the credential-leak runbook.
