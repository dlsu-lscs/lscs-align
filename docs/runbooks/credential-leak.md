# Credential Leak Runbook

1. Treat the credential as compromised and assign an incident owner.
2. Revoke it at the provider immediately; do not wait for repository cleanup.
3. Rotate the value in Bitwarden and every authorized consumer.
4. Inspect audit logs for misuse and invalidate dependent sessions when applicable.
5. Remove the secret from the current tree and rewrite Git history when committed. A follow-up deletion commit is insufficient because Git history retains it.
6. Delete exposed workflow logs or artifacts after evidence is preserved securely.
7. Run a full-history secret scan and verify the replacement credential works.
8. Document cause, exposure window, affected environments, and preventive control.

Never include the leaked value in the incident record or rotation notification.
