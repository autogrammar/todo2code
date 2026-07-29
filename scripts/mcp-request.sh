#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
META='{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"t2c-smoke","version":"1.0.0"},"io.modelcontextprotocol/clientCapabilities":{}}'
printf '%s\n%s\n%s\n%s\n' \
  "{\"jsonrpc\":\"2.0\",\"id\":\"modern-discover\",\"method\":\"server/discover\",\"params\":{\"_meta\":$META}}" \
  "{\"jsonrpc\":\"2.0\",\"id\":\"modern-tools\",\"method\":\"tools/list\",\"params\":{\"_meta\":$META}}" \
  '{"jsonrpc":"2.0","id":"legacy-init","method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"t2c-legacy-smoke","version":"1.0.0"}}}' \
  '{"jsonrpc":"2.0","id":"legacy-tools","method":"tools/list","params":{}}' \
  | node "$PROJECT_ROOT/dist/src/interfaces/mcp.js"
