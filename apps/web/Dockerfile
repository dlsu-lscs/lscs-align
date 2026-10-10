# syntax=docker/dockerfile:1.7
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

FROM dependencies AS build
COPY tsconfig.json tsconfig.base.json tsconfig.typecheck.json ./
COPY packages packages
COPY apps/web apps/web
RUN npm run build --workspace=@align/shared
RUN npm run build --workspace=@align/web

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e AS runtime
ARG SOURCE_COMMIT=0000000000000000000000000000000000000000
LABEL org.opencontainers.image.source="https://github.com/dlsu-lscs/lscs-align" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}"
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=65532:65532 /workspace/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /workspace/packages/shared ./packages/shared
COPY --from=build --chown=65532:65532 /workspace/apps/web/dist ./dist
COPY --from=build --chown=65532:65532 /workspace/apps/web/.next ./.next
COPY --from=build --chown=65532:65532 /workspace/apps/web/next.config.ts ./next.config.ts
COPY --from=build --chown=65532:65532 /workspace/apps/web/package.json ./package.json
USER nonroot
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["dist/index.js"]
