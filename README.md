# LSCS Align

Align is the meeting availability and scheduling platform for DLSU student leaders and organizations, developed by the 41st La Salle Computer Society.

> **Project status:** foundation work is in progress. Staging and production are not yet declared operational.

## Repository structure

- `apps/web` — Next.js App Router placeholder and operational endpoints on port 3000.
- `apps/api` — Fastify application scaffold, operational endpoints, and migration tooling on port 4000.
- `packages/db` — Drizzle and PostgreSQL application database utilities.
- `packages/shared` — shared types and schemas.
- Root TypeScript and ESLint configuration — shared across applications and packages.
- `docs/adr` and `docs/runbooks` — accepted decisions and operational guidance.
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

Run `npm run dev:web` and `npm run dev:api` in separate terminals for the Next.js placeholder at `http://localhost:3000` and the Fastify health route at `http://localhost:4000/health`. These local app scaffolds start without a database connection.

The hosted API uses `/healthz` and `/readyz`; the hosted web service uses `/healthz` and `/revision.json`. Compose routes `/api` to the API and serves the Next.js app on the same origin.

See [architecture](docs/architecture.md) and [development](docs/development.md) for package boundaries and local conventions.

## Delivery flow

Code moves through `working branch -> dev -> main`. A trusted `main` merge builds immutable web and API images once and deploys them to staging. After acceptance, production receives the same GHCR image digests without rebuilding.

See `CONTRIBUTING.md`, `SECURITY.md`, `docs/environments.md`, `docs/configuration.md`, and `docs/operations.md` before contributing or operating the system.
