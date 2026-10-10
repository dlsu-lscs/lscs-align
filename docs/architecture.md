# Application architecture

The npm workspace contains two applications and two supporting packages. The
deployment, environment, migration, and operational contracts are defined by the
DevSecOps foundation in `docs/adr`, `docs/configuration.md`, and `docs/operations.md`.

`apps/web` contains the Next.js App Router placeholder, React, Tailwind CSS,
TanStack Query provider, and shadcn/ui configuration. Routes and layouts live in
`src/app`. The production web process also exposes `/healthz` and
`/revision.json` from the operational server. Browser API calls should use the
same-origin `/api` route provided by Compose.

`apps/api` contains the Fastify application scaffold. Application routes live in
`src/routes`; `GET /health` is its only route. The production API process owns
`/healthz` and `/readyz` and keeps the DevSecOps database readiness probe and
migration runner. Its application routes are dispatched through Fastify after
the operational endpoints.

`packages/db` wraps the DevSecOps runtime PostgreSQL pool with Drizzle for future
application queries. Its schema currently has no application tables. DevSecOps owns SQL
migrations and role provisioning under `apps/api/migrations` and `docker/postgres`.
`packages/shared` contains reusable types and Zod utilities. TypeScript and
ESLint configuration are shared from the repository root. Add an application
dependency on a package only when its code is used.

This repository has only framework scaffolding and operational endpoints. It
does not contain product features.
