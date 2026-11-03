# GitHub control plane

Use this runbook to configure and prove the repository controls required by issue #16. Run every authenticated command as an authorized LSCS operator. Do not copy tokens, secret values, or private infrastructure data into command output or issue comments.

## Prerequisites

1. Select a production reviewer who is not the person triggering the deployment.
2. Authenticate GitHub CLI with repository administration and Actions access:

   ```text
   gh auth login -h github.com
   gh auth status
   ```

3. Confirm the four required checks exist on a recent successful `dev` run:

   - `Repository & Workflow Policy`
   - `Quality & Unit Tests`
   - `PostgreSQL Integration`
   - `Container Security`

## Preview and apply the policy

Preview the exact non-sensitive policy payload:

```text
npm run policy:github-control-plane -- --production-reviewer REVIEWER_LOGIN
```

Apply it through the authenticated operator account:

```text
npm run policy:github-control-plane -- --production-reviewer REVIEWER_LOGIN --apply
```

The command is idempotent. It verifies that `Leznerr`, `Ejaayy`, and `RissyBen` are accessible repository collaborators before relying on them as individual CODEOWNERS, protects `dev` and `main`, includes administrators, requires a fresh CODEOWNER-approved review and conversation resolution, blocks force pushes and deletion, and requires the four fixed checks. It preserves a higher existing review count, existing push restrictions, and compatible linear-history protection. It creates `staging` and `production` environments, restricts both to `main`, enables prevent self-review for production, and assigns the selected production reviewer. It verifies each protection before making `main` the default branch as the final mutation.

The command stops if an environment already contains an unexpected deployment branch policy. Review unexpected policy entries instead of deleting them automatically.

## Verify the configured state

Write a non-sensitive API evidence file:

```text
npm run policy:github-control-plane -- --production-reviewer REVIEWER_LOGIN --verify > control-plane-evidence.json
```

The command exits nonzero unless the default branch, required checks, review requirements, administrator enforcement, conversation resolution, force-push/deletion controls, environments, production reviewer, prevent self-review, and main-only deployment policies exactly match the contract.

Review the output before attaching it to issue #16. It may contain public GitHub numeric identifiers but never credentials.

## Run negative controls

Merge the Environment Protection Probe workflow through `dev` and `main`, then run it from the Actions page with `production` selected.

1. Have the designated production reviewer trigger the first run and confirm the job enters `Waiting`.
2. Have that same reviewer attempt self-approval and confirm GitHub rejects it.
3. Have a different operator trigger a second run, then have the designated reviewer reject it and confirm the job never executes.
4. Have the different operator trigger a third run, then have the designated reviewer approve it and confirm the permissionless probe executes.
5. Record all three workflow URLs and their outcomes.

To prove failed required checks block merging, open a disposable pull request into `dev` containing one deliberate failing test. Record the PR URL and disabled merge state, then close the pull request without merging and delete its source branch. Do not weaken a required check to perform this test.

The verified branch-protection API output must show administrator enforcement, required pull-request review, required checks, conversation resolution, and disabled force pushes/deletion for both branches. This is the evidence that direct updates, administrative bypass, force pushes, and branch deletion are blocked.

## Verify hosted protections

Issue #16 remains open until the hosted environments exist and these external checks pass:

1. `https://staging-align.dlsu-lscs.org` is behind deny-by-default Cloudflare Access.
2. `https://align.dlsu-lscs.org` is the approved public production origin.
3. Both origins use valid TLS with Cloudflare Full Strict mode.
4. Direct-origin requests and public database/service ports fail.
5. Authorized CORS returns only the configured origin; an unapproved origin receives no access-control permission.
6. Production deployment cannot start without the designated GitHub environment approval.

## Closure evidence for issue #16

Attach only non-sensitive evidence:

- control-plane verification output;
- current `dev` and `main` protection API URLs;
- the failed-check pull request;
- rejected and approved production probe workflow runs;
- Cloudflare Access, TLS, origin-isolation, and CORS verification results;
- operator and UTC timestamps.

Close issue #16 only after every acceptance criterion has a corresponding evidence link or redacted command result.
