# Application development

Use Node.js 24 and npm 11, as specified by the DevSecOps foundation. From the
repository root, run `npm ci`, then `npm run check` for formatting, lint,
typechecks, tests, and production builds. The committed `.env.example` contains
local placeholders; never commit a populated `.env` file.

The two application development servers can run in separate terminals:

```text
npm run dev:web
npm run dev:api
```

The Next.js placeholder runs at `http://localhost:3000`. Fastify's local
`GET /health` route runs at `http://localhost:4000/health` by default. The
application development servers do not require a database connection. The
production API process uses the DevSecOps database variables, serves `/healthz`
and `/readyz`, and starts after the migration service in Compose. Consult
`docs/configuration.md` and `docs/operations.md` for deployment variables and
database operations.

Frontend routes and layouts belong in `apps/web/src/app`. Place future Fastify
routes in `apps/api/src/routes`. Use `@align/shared` for code needed by multiple
applications and `@align/db` for application queries. The database schema has
no product tables yet. DevSecOps owns migration execution and SQL migrations;
do not run a separate application migration tool against hosted databases.
