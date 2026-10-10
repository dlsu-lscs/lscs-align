# Operational Controls

Structured application logs include UTC timestamp, environment, service, source revision, request ID, method, route, status, duration, and a safe error code. Query strings, credentials, cookies, and exception internals are excluded. Each environment uses its own OpenTelemetry ingestion identity and service name in SigNoz.

| Signal                 | Initial trigger                                 | Severity | Primary owner               | Required response                                           |
| ---------------------- | ----------------------------------------------- | -------- | --------------------------- | ----------------------------------------------------------- |
| Readiness failure      | two consecutive probes                          | Sev 2    | Backend Tech Lead           | stop promotion and inspect database/migration state         |
| Container restart loop | three restarts in ten minutes                   | Sev 2    | Senior DevSecOps            | preserve logs and use deployment or server-recovery runbook |
| HTTP 5xx               | above 2% for five minutes                       | Sev 2    | Backend Tech Lead           | inspect revision, route, and database health                |
| p95 latency            | above 500 ms for ten minutes                    | Sev 3    | Tech Lead                   | compare against the last release and capacity               |
| Database unavailable   | any sustained readiness failure for two minutes | Sev 1    | Database operator           | open incident and protect data integrity                    |
| Host disk              | above 80%                                       | Sev 2    | Infrastructure operator     | stop unsafe deployments and reclaim reviewed data           |
| Backup failure         | any scheduled or pre-deployment failure         | Sev 1    | Independent backup operator | block production deployment and restore backup service      |

Production backups run daily and before deployment, retain seven daily and four weekly encrypted off-host copies, target RPO at most 24 hours and RTO at most 4 hours, and undergo an isolated restore before launch and every quarter. The independent backup operator must not be the sole developer or deployment approver.

Every alert links to an owner, service, environment, severity, dashboard, and runbook. Alert tests, restore tests, rollback drills, and credential rotations record only non-sensitive evidence in the release record.
