# Security Policy

## Reporting a security vulnerability

Do not open a public issue for a suspected vulnerability, exposed credential, privacy incident, or exploitable configuration. Email `tech@dlsu-lscs.org` with a concise description, affected component, reproduction steps, and impact. Do not include live credentials or personal student data in the message.

The LSCS Systems & Infrastructure team will acknowledge the report, assign an incident owner and severity, preserve evidence, and coordinate remediation. Public disclosure happens only after the issue is contained and the responsible team approves disclosure.

## Credential exposure

Treat a credential as compromised once it appears in Git, an issue, an Actions log, chat, or screenshot. Revoke and rotate it at the provider and in Bitwarden before rewriting Git history or deleting logs. Removing a line in a later commit is not remediation.

## Supported versions

Until the first production release, only the latest commit deployed through the documented promotion workflow is supported. Security updates are applied to `dev`, verified in staging, and promoted to production by immutable image digest.

## Sensitive data

Do not attach database exports, OAuth responses, session cookies, access logs containing identifiers, or screenshots containing student data to public issues or pull requests. Use the approved restricted incident channel and encrypted storage.
