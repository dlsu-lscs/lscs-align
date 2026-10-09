# syntax=docker/dockerfile:1.7
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

FROM dependencies AS build
COPY tsconfig.json tsconfig.base.json tsconfig.typecheck.json ./
COPY apps/api apps/api
RUN npm run build --workspace=@align/api

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runtime
ARG SOURCE_COMMIT=0000000000000000000000000000000000000000
LABEL org.opencontainers.image.source="https://github.com/dlsu-lscs/lscs-align" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}"
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/apps/api/migrations ./migrations
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./package.json
USER node
EXPOSE 4000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
