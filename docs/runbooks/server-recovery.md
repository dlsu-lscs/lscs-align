# Server Recovery Runbook

This runbook covers `lscsdev1` and `lscsprod1`. Preserve forensic evidence before rebuilding when compromise is suspected.

1. Confirm host identity, incident severity, disk/memory pressure, Docker state, firewall state, and recent changes.
2. Restore SSH key-only access, deny direct root login, and verify UFW exposes only approved SSH, HTTP, and HTTPS ports.
3. Restore Docker log rotation, Dokploy, Traefik, Cloudflare origin restrictions, and monitoring before application traffic.
4. Recreate application projects from version-controlled Compose definitions and Bitwarden-backed secrets.
5. Restore PostgreSQL from the approved off-host backup into the correct environment only.
6. Verify database identity, schema, record counts, application readiness, revision identity, TLS, and external smoke tests.
7. Keep production traffic disabled until the incident commander approves recovery evidence.
