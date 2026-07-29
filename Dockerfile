# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --include=dev --omit=optional
COPY src ./src
COPY test ./test
COPY python ./python
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
    T2C_ROOT=/workspace \
    T2C_OUTPUT_DIR=.intent \
    T2C_A2A_HOST=0.0.0.0 \
    T2C_A2A_PORT=8787 \
    T2C_A2A_PUBLIC_URL=http://localhost:8787/a2a
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY python ./python
COPY prompts ./prompts
COPY schemas ./schemas
RUN mkdir -p /workspace && chown -R node:node /app /workspace
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/src/interfaces/a2a.js"]
