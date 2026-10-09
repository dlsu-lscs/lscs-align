# Failed Migration Runbook

The migrator takes a PostgreSQL advisory lock and verifies the expected environment and database identity before changing schema.

1. Stop the deployment and prevent the new API revision from becoming ready.
2. Capture the migration version, safe error code, database identity, and timestamps without credentials or row data.
3. Determine whether the transaction rolled back completely and whether any non-transactional operation ran.
4. Compare against the pre-migration backup and migration design.
5. Prefer reviewed forward recovery. Use rollback only when schema compatibility and data preservation are proven.
6. Test the corrective migration against an isolated copy before retrying.
7. Verify constraints, record counts, readiness, and the application smoke flow.

Do not manually edit the migration history table to force success.
