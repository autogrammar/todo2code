# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json .intentignore ./
RUN npm ci --include=dev
COPY src ./src
COPY sdk/typescript/src ./sdk/typescript/src
COPY test ./test
COPY python ./python
COPY golang ./golang
COPY java ./java
COPY rust-ast ./rust-ast
COPY prompts ./prompts
COPY schemas ./schemas
COPY scripts ./scripts
RUN npm run build && npm prune --omit=dev --omit=optional

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends git python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    T2C_ROOT=/workspace
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json .env.example .intentignore ./
# The runtime image ships git and python3. Go, Java and Rust adapters degrade to
# explicit warnings when matching sources exist; install their toolchains in a
# derived image to enable them.
COPY python ./python
COPY golang ./golang
COPY java ./java
COPY rust-ast ./rust-ast
COPY adapters/tensorflow/package*.json ./adapters/tensorflow/
COPY prompts ./prompts
COPY schemas ./schemas
RUN mkdir -p /workspace && chown -R node:node /app /workspace
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/src/interfaces/a2a.js"]
