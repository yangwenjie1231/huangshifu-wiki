#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
PULL_LATEST="${PULL_LATEST:-0}"
SKIP_SEED="${SKIP_SEED:-0}"
SKIP_DB_INIT="${SKIP_DB_INIT:-0}"
APP_PORT="${APP_PORT:-3000}"
DB_PASSWORD="${DB_PASSWORD:-}"
USE_CHINA_MIRROR="${USE_CHINA_MIRROR:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
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
info() {
  printf "${CYAN}[deploy]${NC} %s\n" "$*"
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

is_port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -tuln 2>/dev/null | grep -q ":${1} "
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tuln 2>/dev/null | grep -q ":${1} "
  else
    return 1
  fi
}

detect_china_mirror() {
  if [[ -n "$USE_CHINA_MIRROR" ]]; then
    return
  fi

  if command -v curl >/dev/null 2>&1; then
    if curl -s --max-time 3 https://registry.npmmirror.com >/dev/null 2>&1; then
      info "detected China network (npmmirror.com is reachable)"
      USE_CHINA_MIRROR="1"
      return
    fi
  fi

  USE_CHINA_MIRROR="0"
}

ask_china_mirror() {
  if [[ -n "$USE_CHINA_MIRROR" && "$USE_CHINA_MIRROR" =~ ^[01]$ ]]; then
    return
  fi

  info ""
  info "========================================"
  info "  部署环境配置"
  info "========================================"
  info ""

  while true; do
    printf "是否在中国大陆服务器部署？[y/n] (默认: n): "
    read -r answer
    answer="${answer:-n}"

    case "$answer" in
      [yY])
        USE_CHINA_MIRROR="1"
        break
        ;;
      [nN])
        USE_CHINA_MIRROR="0"
        break
        ;;
      *)
        warn "请输入 y 或 n"
        ;;
    esac
  done
}

get_npm_registry() {
  if [[ "$USE_CHINA_MIRROR" == "1" ]]; then
    echo "https://registry.npmmirror.com"
  else
    echo "https://registry.npmjs.org"
  fi
}

require_cmd docker
require_cmd curl
check_env

cd "$ROOT_DIR"

detect_china_mirror
ask_china_mirror

NPM_REGISTRY=$(get_npm_registry)
if [[ "$USE_CHINA_MIRROR" == "1" ]]; then
  info "using China mirror: $NPM_REGISTRY"
else
  info "using default registry: $NPM_REGISTRY"
fi

log "loading environment from $ENV_FILE"
set -a
source "$ENV_FILE"
set +a

if [[ "$PULL_LATEST" == "1" ]]; then
  require_cmd git
  log "pulling latest code"
  git pull --ff-only
fi

detect_and_fix_env() {
  log "detecting environment configuration..."

  local needs_fix=false
  local db_url=""

  if grep -q 'postgresql://hsf_app:' "$ENV_FILE" 2>/dev/null; then
    warn "DATABASE_URL uses hsf_app (host mode), Docker may not connect properly"
    needs_fix=true
  elif grep -q 'postgresql://hsf_wiki:' "$ENV_FILE" 2>/dev/null; then
    log "DATABASE_URL already uses docker service name (hsf_wiki)"
  fi

  if [[ ! -s "$ENV_FILE" ]] || ! grep -q 'DATABASE_URL' "$ENV_FILE" 2>/dev/null; then
    warn "DATABASE_URL not found in .env"
    needs_fix=true
  fi

  if [[ "$needs_fix" == "true" ]]; then
    if [[ -z "$DB_PASSWORD" ]]; then
      DB_PASSWORD=$(openssl rand -base64 24 2>/dev/null || head -c 32 /dev/urandom | base64 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
      warn "generated random DB_PASSWORD (you should save this): $DB_PASSWORD"
    fi

    warn "updating DATABASE_URL in .env for Docker mode"
    if grep -q 'DATABASE_URL' "$ENV_FILE" 2>/dev/null; then
      sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://hsf_wiki:${DB_PASSWORD}@postgres:5432/huangshifu_wiki\"|" "$ENV_FILE"
    else
      echo "" >> "$ENV_FILE"
      echo "DATABASE_URL=\"postgresql://hsf_wiki:${DB_PASSWORD}@postgres:5432/huangshifu_wiki\"" >> "$ENV_FILE"
    fi
  fi

  if ! grep -q 'QDRANT_URL' "$ENV_FILE" 2>/dev/null || grep -q 'QDRANT_URL.*127.0.0.1' "$ENV_FILE" 2>/dev/null; then
    warn "fixing QDRANT_URL for Docker mode"
    if grep -q 'QDRANT_URL' "$ENV_FILE" 2>/dev/null; then
      sed -i 's|QDRANT_URL=.*|QDRANT_URL="http://qdrant:6333"|' "$ENV_FILE"
    else
      echo 'QDRANT_URL="http://qdrant:6333"' >> "$ENV_FILE"
    fi
  fi
}

detect_and_fix_env

log "checking docker-compose.yml"
COMPOSE_NEEDS_SETUP=false
DOCKERFILE_NEEDS_CREATE=false

if [[ ! -f "$ROOT_DIR/docker-compose.yml" ]]; then
  warn "docker-compose.yml not found, will create it"
  COMPOSE_NEEDS_SETUP=true
else
  if docker compose config --services 2>/dev/null | grep -q "^postgres$"; then
    log "docker-compose.yml with postgres service found"
  else
    warn "existing docker-compose.yml missing postgres service, will update it"
    COMPOSE_NEEDS_SETUP=true
  fi
fi

if [[ ! -f "$ROOT_DIR/Dockerfile" ]]; then
  warn "Dockerfile not found, will create it"
  DOCKERFILE_NEEDS_CREATE=true
fi

if [[ "$COMPOSE_NEEDS_SETUP" == "true" ]]; then
  if [[ -z "$DB_PASSWORD" ]]; then
    DB_PASSWORD=$(grep 'hsf_wiki:' "$ENV_FILE" 2>/dev/null | sed -n 's/.*hsf_wiki:\([^@]*\)@.*/\1/p')
    if [[ -z "$DB_PASSWORD" ]]; then
      error "DB_PASSWORD not set and could not be extracted from DATABASE_URL"
      error "please run: DB_PASSWORD=your_strong_password ./scripts/deploy-docker.sh"
      exit 1
    fi
    warn "extracted DB_PASSWORD from existing .env"
  fi

  PG_PORT=""
  for port in 5432 5433 5434 5435; do
    if ! is_port_in_use "$port"; then
      PG_PORT="$port"
      break
    fi
  done

  if [[ -z "$PG_PORT" ]]; then
    error "no available port found for postgres (tried 5432-5435)"
    exit 1
  fi

  if [[ "$PG_PORT" != "5432" ]]; then
    warn "port 5432 is in use, using port ${PG_PORT} for Docker postgres"
    warn "updating DATABASE_URL to use port ${PG_PORT}"
    sed -i "s|@postgres:[0-9]*|@postgres:${PG_PORT}|g" "$ENV_FILE"
  fi

  warn "creating docker-compose.yml with postgres + qdrant + app services"

  cat > "$ROOT_DIR/docker-compose.yml" << EOF
services:
  postgres:
    image: postgres:18
    container_name: hsf-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: hsf_wiki
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: huangshifu_wiki
    volumes:
      - postgres_data:/var/lib/postgresql
    ports:
      - "127.0.0.1:${PG_PORT}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hsf_wiki -d huangshifu_wiki"]
      interval: 5s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:v1.9.4
    container_name: hsf-qdrant
    restart: unless-stopped
    ports:
      - "127.0.0.1:6333:6333"
      - "127.0.0.1:6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hsf-app
    restart: unless-stopped
    ports:
      - "127.0.0.1:${APP_PORT}:3000"
    environment:
      NODE_ENV: production
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      qdrant:
        condition: service_started
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

volumes:
  postgres_data:
  qdrant_storage:
EOF
fi

if [[ "$DOCKERFILE_NEEDS_CREATE" == "true" ]]; then
  log "creating Dockerfile"
  cat > "$ROOT_DIR/Dockerfile" << 'DOCKERFILE_EOF'
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=${NPM_REGISTRY}

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/server.ts ./

RUN mkdir -p /app/uploads && chown -R appuser:nodejs /app/uploads

USER appuser
EXPOSE 3000

CMD ["node", "dist/server.js"]
DOCKERFILE_EOF
fi

if is_port_in_use 6333; then
  warn "port 6333 is already in use, qdrant container may fail to start"
fi

if is_port_in_use 3000; then
  warn "port 3000 is already in use, app container may fail to start"
fi

log "creating uploads directory if not exists"
mkdir -p "$ROOT_DIR/uploads"

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
  log "installing system dependencies for sharp (libvips)"
  if command -v apt >/dev/null 2>&1; then
    apt update && apt install -y libvips-dev --no-install-recommends 2>/dev/null || true
  fi

  log "installing dependencies"
  npm ci --registry="${NPM_REGISTRY}" || npm install --registry="${NPM_REGISTRY}"

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
for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    log "app is healthy"
    break
  fi
  if [[ $i -eq 60 ]]; then
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
log "postgres: 127.0.0.1:5432 (internal: postgres:5432)"
echo ""
log "view logs: docker compose logs -f"
log "view app:  docker compose logs -f app"
echo ""