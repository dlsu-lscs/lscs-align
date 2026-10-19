# ADR 0003: Build-Once Artifact Promotion

**Status:** Accepted

Trusted `main` merges build web and API images once. GHCR stores immutable `sha-<commit>` tags and the release manifest records their digests. The release is deployed to staging, then production promotes those exact staging-proven digests and must not rebuild. This removes source/dependency drift between acceptance and production.
