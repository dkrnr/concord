#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
export PORT="${PORT:-8791}"

for command in systemd-inhibit cloudflared node npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

echo "Starting Concord presentation mode."
echo "Local presentation server: http://127.0.0.1:$PORT"
echo "Lid-close, idle sleep, and suspend are blocked until you press Ctrl+C."
echo "Keep this terminal open and share the Cloudflare URL printed below."

exec systemd-inhibit \
  --what=handle-lid-switch:sleep:idle \
  --who=Concord \
  --why="Keep the Concord presentation relay online" \
  --mode=block \
  npm run relay
