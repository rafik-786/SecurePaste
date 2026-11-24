#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

git pull --ff-only

# One image at a time: building them together needs more memory than an e2-micro has.
docker compose build migrate
docker compose build api
docker compose build web

docker compose up -d
docker image prune -f
