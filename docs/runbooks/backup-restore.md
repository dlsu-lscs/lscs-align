# Backup and Restore Runbook

Production is backed up daily and before every migration. Keep seven daily and four weekly encrypted copies off-host. The target RPO is at most 24 hours and the target RTO is at most 4 hours.

## Backup

Use `pg_dump` with a least-privilege backup identity, encrypt before transfer, verify the archive checksum, copy it off `lscsprod1`, and alert on failure. A file existing is not proof of a usable backup.

## Isolated restore test

1. Provision an isolated PostgreSQL 16 database with no application traffic.
2. Verify archive checksum and decrypt into temporary restricted storage.
3. Restore schema and data.
4. Run migration status, constraint checks, important record counts, and a read-only application validation.
5. Record actual recovery time, achieved recovery point, backup identifier, operator, and cleanup.
6. Destroy the isolated copy securely after evidence is approved.

Perform a restore before launch and quarterly thereafter. The backup operator must be independent of the original developer.
