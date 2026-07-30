#!/usr/bin/env bash
set -euo pipefail

IMAGE="${DOCKER_SMOKE_IMAGE:-todo2code:smoke}"
CONTAINER="t2c-smoke-$$"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build -t "$IMAGE" .
docker run --detach --name "$CONTAINER" \
  --env OPENROUTER_API_KEY= \
  --env T2C_NL_MODE=deterministic \
  --env T2C_MARKDOWN_MODE=deterministic \
  --env T2C_COMMUNICATION_MODE=deterministic \
  "$IMAGE" >/dev/null

ready=false
for _ in {1..30}; do
  if docker exec "$CONTAINER" node -e \
    "fetch('http://127.0.0.1:8787/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    ready=true
    break
  fi
  sleep 0.2
done

if [[ "$ready" != true ]]; then
  docker logs "$CONTAINER" >&2
  exit 1
fi

docker exec "$CONTAINER" node /app/dist/src/cli.js doctor >/dev/null
echo "docker smoke: PASS"
