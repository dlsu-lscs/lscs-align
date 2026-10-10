# Contributing to LSCS Align

## Branches and pull requests

Create a short-lived working branch from `dev` using `feat/`, `fix/`, `docs/`, or `chore/`. Never commit directly to `dev` or `main`.

The repository has two long-lived branches. The code path is `working branch -> dev -> main`; staging and production are deployment environments, not branches:

- Squash merge working branches into `dev` after the required checks and review pass.
- Use a merge commit for the `dev` to `main` release pull request so the release boundary remains traceable.
- A trusted `main` merge builds one immutable release and automatically deploys it to the staging environment.
- Promote the exact staging-proven image digests to the production environment only after the protected deployment approval and acceptance checks pass.
- A production hotfix starts at `main`, uses `hotfix/*`, follows the same staging-to-production path, and is merged back into `dev` after release.

Keep pull requests focused. State the user impact, risk tier, test evidence, security and privacy impact, migration impact, deployment plan, and rollback target. Resolve every review conversation before merge.

## Local quality gate

Use Node.js 24 LTS and the committed lockfile. Before opening a pull request, run:

```text
npm ci
npm run check
```

Integration tests require PostgreSQL 16. Container and Compose changes also require a successful image build and `docker compose config` validation.

## Security and data

Never commit credentials, real `.env` files, production data, student identifiers, access tokens, or private infrastructure records. Bitwarden is the secret source of truth; Dokploy injects runtime values. Follow `SECURITY.md` for vulnerability reports.

## Database changes

Migrations must be ordered, backward-compatible, safe to repeat, and covered by fresh-schema and upgrade tests. Use expand/contract changes. The runtime role must never own or alter the schema.

## Definition of done

A change is done only when its acceptance criteria, automated tests, documentation, observability, security review, migration evidence, and rollback evidence are complete. A merged commit is not deployment evidence.
