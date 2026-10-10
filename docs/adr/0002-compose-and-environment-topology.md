# ADR 0002: Compose and Environment Topology

**Status:** Accepted

Each hosted environment is an isolated Docker Compose project containing `web`, `api`, one-shot `migrate`, and PostgreSQL 16 `db` services. There are exactly two hosted databases: `align_staging` on `lscsdev1` and `align_production` on `lscsprod1`. They never share networks, volumes, identities, credentials, backups, or OAuth clients. Local development may use a disposable `align_local` database, but it is not a hosted environment. No database has a published host port.
