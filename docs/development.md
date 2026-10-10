# Development

## Getting started

Install Node.js 22 or later and pnpm 10.21.0, then run `pnpm install` and `pnpm dev` from the repository root. The web app runs on port 3000 and the API on port 3001. Check `http://localhost:3001/health` for `{ "status": "ok" }`.

The root `.env.example` lists local variables. Copy it to `.env` if you need to change the API port or use a local PostgreSQL database. Keep `DATABASE_URL` blank until a database is needed. Next.js reads its public variable from `apps/web/.env.local`; copy `NEXT_PUBLIC_API_URL=http://localhost:3001` there when frontend code begins using the API. Do not commit either local environment file.

## Commands

| Command                        | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| `pnpm dev`                     | Run both applications                                    |
| `pnpm build`                   | Build workspace packages and applications                |
| `pnpm lint`                    | Lint application and package source                      |
| `pnpm typecheck`               | Check TypeScript across the workspace                    |
| `pnpm format`                  | Format repository files with Prettier                    |
| `pnpm format:check`            | Check formatting without changes                         |
| `pnpm --filter @align/web dev` | Run only the frontend                                    |
| `pnpm --filter @align/api dev` | Run only the API                                         |
| `pnpm db:generate`             | Generate migrations after a schema is added              |
| `pnpm db:migrate`              | Apply migrations to the database named by `DATABASE_URL` |

The database commands are prepared for future schema work. There are currently no tables or migrations to generate or apply. Set `DATABASE_URL` to a local PostgreSQL URL before running `db:migrate`; it changes that database.

## Package imports

Use `@align/shared` for cross-application types, schemas, and utilities, and `@align/db` for database connections in the API. Workspace dependencies are declared with `workspace:*`. TypeScript and ESLint configurations are shared through `@align/config`; frontend-local imports use `@/` for `apps/web/src`.

The web app should keep pages and layouts under `src/app`, components under `src/components`, hooks under `src/hooks`, state stores under `src/stores`, and other client utilities under `src/lib` as those files become necessary. Keep Fastify routes under `apps/api/src/routes` and supporting code under `src/lib` or `src/plugins`. Add a Drizzle schema and generated migration only when a feature requires persistence.

To add a shadcn/ui component later, run `pnpm dlx shadcn@latest add <component> -c apps/web` from the repository root. The setup intentionally includes no UI components yet.

## Future integration variables

No integration variables are required today. When a corresponding feature is approved, its team can settle the exact variable names and add them to the relevant example file. Likely groups are Google OAuth client credentials and a JWT signing secret; a Resend API key; Google API credentials; Cloudflare R2 account, bucket, and access credentials; a Gemini API key; and a Sentry DSN. React Email is a rendering library and does not need its own credential. These integrations have not been installed or configured.
