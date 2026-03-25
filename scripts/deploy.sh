#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-huangshifu-wiki}"
APP_PORT="${APP_PORT:-3000}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
MIGRATION_FILE="${MIGRATION_FILE:-$ROOT_DIR/prisma/migrate.sql}"
USE_PM2="${USE_PM2:-1}"
PULL_LATEST="${PULL_LATEST:-0}"
SKIP_SEED="${SKIP_SEED:-0}"
INSTALL_MODE="${INSTALL_MODE:-ci}"
ENABLE_VECTOR_SYNC="${ENABLE_VECTOR_SYNC:-1}"
VECTOR_SYNC_LIMIT="${VECTOR_SYNC_LIMIT:-100}"

log() {
  printf '[deploy] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[deploy] missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd npm
require_cmd node
require_cmd npx
require_cmd curl

if [[ ! -f "$ENV_FILE" ]]; then
  printf '[deploy] env file not found: %s\n' "$ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$MIGRATION_FILE" ]]; then
  printf '[deploy] migration file not found: %s\n' "$MIGRATION_FILE" >&2
  exit 1
fi

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

if [[ "$INSTALL_MODE" == "ci" && -f "$ROOT_DIR/package-lock.json" ]]; then
  log "installing dependencies with npm ci"
  npm ci
else
  log "installing dependencies with npm install"
  npm install
fi

log "generating prisma client"
npm run db:generate

log "executing schema migration SQL"
npx prisma db execute --file "$MIGRATION_FILE" --schema "$ROOT_DIR/prisma/schema.prisma"

if [[ "$SKIP_SEED" != "1" ]]; then
  log "running seed"
  npm run db:seed
else
  log "skip seed enabled"
fi

log "building frontend"
npm run build

if [[ "$ENABLE_VECTOR_SYNC" == "1" ]]; then
  log "running initial embedding sync batch (limit=${VECTOR_SYNC_LIMIT})"
  npm run embeddings:sync -- --limit="$VECTOR_SYNC_LIMIT" || log "embedding sync failed, continue deployment"
else
  log "skip embedding sync (ENABLE_VECTOR_SYNC=$ENABLE_VECTOR_SYNC)"
fi

if [[ "$USE_PM2" == "1" ]]; then
  require_cmd pm2
  log "starting or restarting pm2 service: $APP_NAME"
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
  else
    pm2 start "NODE_ENV=production npx tsx server.ts" --name "$APP_NAME" --cwd "$ROOT_DIR"
  fi
  pm2 save >/dev/null 2>&1 || true
else
  log "starting with nohup (pm2 disabled)"
  pkill -f 'tsx server.ts' || true
  nohup env NODE_ENV=production npx tsx server.ts > "$ROOT_DIR/app.log" 2>&1 &
fi

log "health check: http://127.0.0.1:${APP_PORT}/api/health"
curl -fsS "http://127.0.0.1:${APP_PORT}/api/health"
printf '\n'

log "deploy completed"
