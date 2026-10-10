# Architecture

The pnpm workspace contains two applications and three supporting packages. Turborepo orders package builds so applications can import compiled workspace packages.

`apps/web` owns the browser experience. It uses the Next.js App Router, Tailwind CSS, and a TanStack Query provider. shadcn/ui is initialized for future components; no product interface exists yet. Zustand and date utilities are installed for later use.

`apps/api` owns HTTP endpoints. `src/app.ts` creates and configures Fastify, while `src/server.ts` validates local environment variables and starts the listener. Routes live under `src/routes`. The only route is `GET /health`. The API can import `@align/db` without opening a connection at startup.

`packages/db` owns PostgreSQL connection creation and Drizzle configuration. `src/schema.ts` contains no tables. Drizzle Kit is configured to generate SQL migrations from future table definitions and to apply them only when explicitly invoked. No database is contacted during installation, build, or normal startup.

`packages/shared` is the place for code that must be used by multiple applications: general TypeScript types, Zod schemas, and utilities. Application-specific code should remain in its owning application until sharing is justified. `packages/config` contains common TypeScript and ESLint rules; Prettier configuration is at the repository root.

Future authentication, email, calendar, AI, storage, and monitoring integrations belong behind explicit application boundaries when those features are approved. They are not configured in this repository setup. Deployment, infrastructure, and repository governance are handled separately by the DevSecOps team.
