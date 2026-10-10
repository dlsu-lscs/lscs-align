# ALIGN

ALIGN is a scheduling and availability management platform in its initial development setup. This repository currently contains only a placeholder frontend, a health-check API, and shared development foundations. Product features are future work.

## Stack

- pnpm workspaces and Turborepo
- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui configuration, TanStack Query, Zustand, date-fns, and date-fns-tz
- Fastify, Zod, and `@fastify/cors`
- PostgreSQL connection utilities, Drizzle ORM, and Drizzle Kit
- ESLint and Prettier

## Repository

```text
apps/web       Next.js placeholder and frontend dependencies
apps/api       Fastify server and GET /health
packages/db    PostgreSQL and Drizzle foundation
packages/shared  Shared types, Zod schemas, and utilities
packages/config  Shared TypeScript and ESLint configuration
docs           Architecture and developer guidance
```

## Prerequisites

Node.js 22 or later and pnpm 10.21.0. PostgreSQL is needed only when database migrations or future database features are used.

## Install and run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` for the placeholder page and `http://localhost:3001/health` for the API health response. Both apps start without a database connection.

For local variables, copy `.env.example` to `.env` at the repository root. The API reads `PORT` and the database tooling reads `DATABASE_URL` from that file. Copy `NEXT_PUBLIC_API_URL` into `apps/web/.env.local` when frontend code needs it. A blank `DATABASE_URL` is valid for this initial setup.

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm format
pnpm format:check
```

Run an app alone with `pnpm --filter @align/web dev` or `pnpm --filter @align/api dev`. For a production-style local run, build first, then use `pnpm --filter @align/web start` or `pnpm --filter @align/api start`.

See [architecture](docs/architecture.md) and [development](docs/development.md) for package boundaries and development conventions.
