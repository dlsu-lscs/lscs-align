# ADR 0005: Same-Origin Routing

**Status:** Accepted

Cloudflare and Traefik expose one origin per environment. Traefik routes `/api/` traffic to the API and all other paths to the web service. Same-origin routing simplifies secure session cookies and CORS. API, authentication, HTML, health, readiness, and revision responses are not cached; immutable static assets may be cached.
