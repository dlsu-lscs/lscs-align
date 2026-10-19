# Rollback Runbook

Rollback accepts only a signed-off known-good release manifest whose web and API images still exist by digest. Confirm schema compatibility before changing services.

1. Declare an incident and stop additional promotions.
2. Identify the last healthy manifest and current schema version.
3. Compare application compatibility with the deployed schema.
4. If compatible, deploy the known-good image digests, wait for health/readiness, and run external smoke tests.
5. If incompatible after a destructive migration, do not attempt blind rollback. Prefer forward recovery using a reviewed corrective migration.
6. Record the decision, operator, manifests, timestamps, evidence, and follow-up actions.

Never restore an old database over a newer production database without an approved data-loss decision and verified backup.
