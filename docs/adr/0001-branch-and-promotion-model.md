# ADR 0001: Branch and Promotion Model

**Status:** Accepted

Use `working branch -> dev -> main` with two long-lived branches. Working branches are squash-merged into `dev`; the `dev` to `main` release pull request uses a merge commit. A trusted `main` merge deploys to the staging environment, and a protected approval promotes the same release to the production environment. Direct updates, force pushes, and deletion are blocked on both long-lived branches. This keeps code history simple while separating branch review from deployment acceptance.
