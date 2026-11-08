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
COPY apps/api apps/api
RUN npm run build --workspace=@align/shared
RUN npm run build --workspace=@align/db
RUN test -f packages/shared/dist/index.js && \
    test -f packages/shared/dist/index.d.ts && \
    test -f packages/db/dist/index.js && \
    test -f packages/db/dist/index.d.ts
RUN npm run build --workspace=@align/api

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS runtime
ARG SOURCE_COMMIT=0000000000000000000000000000000000000000
LABEL org.opencontainers.image.source="https://github.com/dlsu-lscs/lscs-align" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}"
RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /opt/yarn-v* \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg && \
    addgroup -g 65532 -S nonroot && \
    adduser -u 65532 -S -D -H -G nonroot nonroot
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=65532:65532 /workspace/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /workspace/packages/shared ./packages/shared
COPY --from=build --chown=65532:65532 /workspace/packages/db ./packages/db
COPY --from=build --chown=65532:65532 /workspace/apps/api/dist ./dist
COPY --from=build --chown=65532:65532 /workspace/apps/api/migrations ./migrations
COPY --from=build --chown=65532:65532 /workspace/apps/api/package.json ./package.json
USER nonroot
EXPOSE 4000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/usr/local/bin/node", "-e", "fetch('http://127.0.0.1:4000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/node"]
CMD ["dist/index.js"]
