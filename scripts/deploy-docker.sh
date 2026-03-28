#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
PULL_LATEST="${PULL_LATEST:-0}"
SKIP_SEED="${SKIP_SEED:-0}"
SKIP_DB_INIT="${SKIP_DB_INIT:-0}"
APP_PORT="${APP_PORT:-3000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  printf "${GREEN}[deploy]${NC} %s\n" "$*"
}
warn() {
  printf "${YELLOW}[deploy]${NC} %s\n" "$*"
}
error() {
  printf "${RED}[deploy]${NC} %s\n" "$*" >&2
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "missing required command: $1"
    exit 1
  fi
}

check_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    error "env file not found: $ENV_FILE"
    error "please create .env file first (see docs/docker-deployment.md)"
    exit 1
  fi
}

require_cmd docker
require_cmd curl
check_env

cd "$ROOT_DIR"

log "loading environment from $ENV_FILE"
set -a
source "$ENV_FILE"
set +a

if [[ "$PULL_LATEST" == "1" ]]; then
  require_cmd git
  log "pulling latest code"
  git pull --ff-only
fi

log "ensuring .env has correct DATABASE_URL for docker"
if grep -q 'postgresql://hsf_wiki:' "$ENV_FILE" 2>/dev/null; then
  warn "DATABASE_URL already uses docker service name (hsf_wiki)"
elif grep -q 'postgresql://hsf_app:' "$ENV_FILE" 2>/dev/null; then
  warn "DATABASE_URL uses hsf_app (host mode), docker may not connect properly"
  warn "expected format: postgresql://hsf_wiki:<password>@postgres:5432/huangshifu_wiki"
fi

log "starting postgres and qdrant containers"
docker compose up -d postgres qdrant

log "waiting for postgres to be ready..."
for i in {1..30}; do
  if docker exec hsf-postgres pg_isready -U hsf_wiki -d huangshifu_wiki >/dev/null 2>&1; then
    log "postgres is ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    error "postgres did not become ready in time"
    docker compose logs postgres
    exit 1
  fi
  sleep 2
done

if [[ "$SKIP_DB_INIT" != "1" ]]; then
  log "installing dependencies"
  npm ci --registry=https://registry.npmmirror.com

  log "generating prisma client"
  npm run db:generate

  log "applying prisma migrations"
  npm run db:deploy

  if [[ "$SKIP_SEED" != "1" ]]; then
    log "seeding database"
    npm run db:seed
  else
    log "skipping seed"
  fi
else
  log "skipping database initialization"
fi

log "building app Docker image"
docker compose build app

log "starting app container"
docker compose up -d app

log "waiting for app to be healthy..."
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    log "app is healthy"
    break
  fi
  if [[ $i -eq 30 ]]; then
    error "app did not become healthy in time"
    docker compose logs app
    exit 1
  fi
  sleep 2
done

echo ""
log "========================================"
log "  deployment completed successfully!"
log "========================================"
echo ""
log "app:     http://127.0.0.1:${APP_PORT}"
log "qdrant:  http://127.0.0.1:6333"
log "postgres: 127.0.0.1:5432"
echo ""
log "view logs: docker compose logs -f"
log "view app:  docker compose logs -f app"
echo ""