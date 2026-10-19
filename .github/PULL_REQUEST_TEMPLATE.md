## Summary

<!-- Explain the user-visible outcome and why this change is needed. -->

## Risk tier

- [ ] Tier 1
- [ ] Tier 2
- [ ] Tier 3

## Acceptance criteria

- [ ] The linked issue criteria are satisfied.
- [ ] Scope is limited to this change.

## Test evidence

<!-- Link exact CI runs and include relevant local commands/results. -->

- [ ] Formatting, lint, typecheck, unit tests, and build pass.
- [ ] Real PostgreSQL migration/integration tests pass when applicable.
- [ ] Browser and load evidence is attached when the critical flow changes.

## Security impact

- [ ] No secrets, personal data, or privileged logs are introduced.
- [ ] Authentication, authorization, input validation, and dependency impact were reviewed.
- [ ] Workflow permissions and untrusted pull-request behavior were reviewed.

## Database and deployment

- [ ] No schema change, or the migration is expand/contract compatible.
- [ ] Deployment evidence identifies the exact source commit and image digests.

## Rollback

<!-- Name the known-good release manifest and state schema compatibility. -->

## Reviewer sign-off

- [ ] Product acceptance
- [ ] Technical validation
- [ ] Senior DevSecOps approval when required by CODEOWNERS
