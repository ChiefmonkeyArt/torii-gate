#!/usr/bin/env bash
# deploy/deploy.sh — pull latest code, rebuild the game image, restart the stack.
#
# Run on the VPS, from the repo root or this script:
#   ./deploy/deploy.sh
#
# The Dockerfile rebuilds dist/ inside the image, so NO Node.js is required on the host.
set -euo pipefail

# Resolve repo root (one level up from deploy/)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Pulling latest code…"
git pull --ff-only

echo "==> Loading .env…"
if [ -f .env ]; then
  set -a; . ./.env; set +a
else
  echo "ERROR: .env missing. Copy .env.example to .env and fill in DOMAIN/ACME_EMAIL." >&2
  exit 1
fi

echo "==> Rebuilding game image (web)…"
docker compose build --pull web

echo "==> Pulling strfry image…"
docker compose pull strfry

echo "==> Starting stack…"
docker compose up -d --remove-orphans

echo ""
echo "✅ Deployed."
echo "   Game:   https://${DOMAIN}"
echo "   Relay:  wss://${DOMAIN}/relay"
echo "   Logs:   docker compose logs -f web strfry"
