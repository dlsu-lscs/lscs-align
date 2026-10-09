# Align Environments

| Source branch | Environment | Host        | Public origin                         | Database           | Access            |
| ------------- | ----------- | ----------- | ------------------------------------- | ------------------ | ----------------- |
| `main`        | Staging     | `lscsdev1`  | `https://staging-align.dlsu-lscs.org` | `align_staging`    | Cloudflare Access |
| `main`        | Production  | `lscsprod1` | `https://align.dlsu-lscs.org`         | `align_production` | Public            |

These are the only two hosted databases. Each row is a separate Dokploy Compose project with its own network, PostgreSQL database and volume, runtime role, migration role, OAuth client, application origin, session secret, telemetry identity, and backup scope. No environment may connect to the other environment's database. Local development uses a disposable `align_local` database and never production data.

A trusted `main` merge builds one release and deploys it to staging. Production promotion consumes the same release manifest and exact same image digests only after staging acceptance and protected approval; it never rebuilds.

Traefik sends `/api/*` to `api:4000` and all other routes to `web:3000`. PostgreSQL has no published host port. Cloudflare proxying and Full Strict TLS are mandatory. Staging is deny-by-default behind Cloudflare Access.

Do not cache API, authentication, health, readiness, HTML, or revision responses. Cache only immutable, content-addressed static assets. Do not trust Cloudflare client-IP headers until a direct-origin test proves the origin and service ports are unreachable from the Internet.

Bitwarden is the source of truth. Dokploy injects runtime secrets. GitHub stores only narrowly scoped per-environment deployment capabilities and the notification webhook needed by workflows.
