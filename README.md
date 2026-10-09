# LSCS Align

Align is the meeting availability and scheduling platform for DLSU student leaders and organizations, developed by the 41st La Salle Computer Society.

> **Project status:** foundation work is in progress. Staging and production are not yet declared operational.

## Repository structure

- `apps/web` — public web service and operational endpoints on port 3000.
- `apps/api` — API, readiness, and migration tooling on port 4000.
- `docs/adr` — accepted architecture decisions.
- `docs/runbooks` — deployment and incident operations.
- `.github/workflows` — validation, release, and promotion automation.

## Local requirements

- Node.js 24 LTS and npm 11
- Docker with Compose for PostgreSQL integration and container checks

```text
copy .env.example .env
npm ci
npm run check
```

The committed example values are local-only placeholders. Staging and production secrets come from the approved LSCS Bitwarden vault; never commit `.env` files.

## Delivery flow

Code moves through `working branch -> dev -> main`. A trusted `main` merge builds immutable web and API images once and deploys them to staging. After acceptance, production receives the same GHCR image digests without rebuilding.

See `CONTRIBUTING.md`, `SECURITY.md`, and `docs/environments.md` before contributing or operating the system.
