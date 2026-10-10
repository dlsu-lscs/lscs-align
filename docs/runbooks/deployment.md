# Deployment Runbook

## Preconditions

Confirm the `main` source commit, target environment, successful required checks, approved release PR, exact release manifest, image digests, schema version, host capacity, rollback target, and operator. Production also requires successful staging evidence, protected deployment approval, and a verified pre-migration backup.

## Procedure

1. Build once after the trusted `main` merge. Record immutable web and API digests.
2. Deploy the new release manifest to staging only after CI passes.
3. Verify `APP_ENV=staging` and the `align_staging` database identity before the one-shot migration starts.
4. Wait for migration completion, container health, API readiness, external revision checks, security headers, and smoke tests.
5. Obtain staging acceptance and the protected production deployment approval.
6. Verify `APP_ENV=production` and the `align_production` database identity, then promote the exact staging-proven digests without rebuilding.
7. Record each GitHub deployment result and send a credential-free Discord notification.

If a guard, migration, health check, revision check, or smoke check fails, mark the deployment failed and preserve the prior release as the recovery target.
