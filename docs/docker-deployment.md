# 诗扶小筑 Docker 部署指南

本文档用于将当前项目以 Docker 容器化方式部署到 Linux 服务器。

快速结论（无旧数据迁移场景）：

- 数据库使用 PostgreSQL 18（Docker 容器）。
- 向量检索继续使用 Qdrant（Docker 容器）。
- 数据库初始化使用 Prisma Migration：`npm run db:deploy`。
- 首次上线后执行一次 `npm run db:seed` 初始化管理员账号。

适用架构：

- 前端：Vite + React
- 后端：Express（`server.ts`）
- 数据库：Prisma + PostgreSQL 18
- 向量检索：Qdrant + CLIP（Docker 容器）
- 鉴权：本地账号密码 + JWT Cookie
- 微信登录：微信小程序 `code2session`（支持 mock 联调）
- 容器编排：Docker Compose

---

## 1. 部署前准备

建议环境：

- Debian/Ubuntu Linux
- Docker 20.10+ & Docker Compose v2
- Nginx（用于域名和 HTTPS）
- 域名（可选，用于 HTTPS）

安装基础工具（Debian/Ubuntu）：

```bash
apt update
apt install -y git curl nginx
```

安装 Docker（如果未安装）：

```bash
# Debian 推荐直接安装 docker.io
apt install -y docker.io
systemctl enable --now docker

# 验证安装（新版 Docker 已内置 docker compose v2 命令）
docker --version
docker compose version
```

> **注意**：Debian 官方源的 `docker.io` 包可用，但不含 `docker-compose-plugin`。Docker v2+ 已内置 `docker compose` 命令（注意是空格不是横杠），无需单独安装 compose 插件。若需要 `docker-compose` 传统命令，可通过 `npm install -g docker-compose` 安装。

---

## 2. 创建项目目录

```bash
cd /root
git clone <你的仓库地址> huangshifu-wiki
cd /root/huangshifu-wiki
```

---

## 3. 配置环境变量

创建生产环境变量文件（注意：Docker 部署需要使用 `postgres` 服务名）：

```bash
cat > /root/huangshifu-wiki/.env <<'EOF'
VITE_GEMINI_API_KEY=""
DATABASE_URL="postgresql://hsf_wiki:请替换为强密码@postgres:5432/huangshifu_wiki"
JWT_SECRET="请替换为至少32位随机字符串"
SEED_SUPER_ADMIN_EMAIL="admin@example.com"
SEED_SUPER_ADMIN_PASSWORD="请替换为强密码"
SEED_SUPER_ADMIN_NAME="管理员"
CORS_ORIGIN="https://你的域名"
WECHAT_MP_APPID=""
WECHAT_MP_APP_SECRET=""
WECHAT_LOGIN_MOCK="false"
UPLOAD_SESSION_TTL_MINUTES="45"
QDRANT_URL="http://qdrant:6333"
QDRANT_API_KEY=""
QDRANT_COLLECTION="hsf_image_embeddings"
IMAGE_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
IMAGE_EMBEDDING_VECTOR_SIZE="512"
IMAGE_EMBEDDING_BATCH_SIZE="100"
IMAGE_SEARCH_RESULT_LIMIT="24"
MUSIC_PLAY_URL_CACHE_TTL_SECONDS="600"

# ============================================
# S3 对象存储配置（可选，用于图片主图床）
# ============================================
# 参考文档：docs/S3_SETUP_GUIDE.md

# 是否启用 S3（false=仅使用本地存储，true=启用 S3 图床）
S3_ENABLED="false"

# S3 兼容端点（Bitiful 使用 https://s3.bitiful.net）
S3_ENDPOINT_URL="https://s3.bitiful.net"
S3_REGION="cn-east-1"
S3_FORCE_PATH_STYLE="true"
S3_SSL_ENABLED="true"
S3_SIGNATURE_VERSION="v4"

# ============================================
# 写入凭证（机密 - 仅后端使用）
# ============================================
# 权限：上传、删除、列出
# 建议：创建专用子账户，仅授予 PutObject、DeleteObject、ListBucket 权限
S3_WRITE_ACCESS_KEY_ID=""
S3_WRITE_SECRET_ACCESS_KEY=""

# ============================================
# 读取凭证（可用于前端）
# ============================================
# 权限：读取、列出（无写入、删除）
# 用于生成下载签名，前端可使用
S3_READ_ACCESS_KEY_ID=""
S3_READ_SECRET_ACCESS_KEY=""

# 存储桶名称（私有桶，用于存储图片）
S3_PUBLIC_BUCKET_NAME="your-bucket-name"
S3_PUBLIC_BUCKET_REGION="auto"
S3_PUBLIC_BUCKET_PREFIX="wiki/"

# 自定义域名（可选，用于公开访问）
# 如果配置了 CDN 或自定义域名，填在这里
S3_PUBLIC_DOMAIN=""

# 安全配置
S3_MAX_FILE_SIZE="10485760"  # 10MB
S3_ALLOWED_CONTENT_TYPES="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp"
S3_ENABLE_MD5_VERIFICATION="true"

# 预签名 URL 过期时间（秒）
S3_EXPIRES_IN="3600"
EOF
```

> **重要**：Docker 部署时 `DATABASE_URL` 必须使用 `postgres:5432`（Docker 服务名），不能使用 `127.0.0.1:5432`。

说明：

- `VITE_GEMINI_API_KEY` 为空时，AI 功能会自动降级（不报致命错）。
- 修改任何 `VITE_*` 变量后都需要重新构建前端：`npm run build`。
- 小程序联调阶段可临时设置 `WECHAT_LOGIN_MOCK="true"`，用 mock code 验证闭环。
- 正式环境建议固定 `WECHAT_LOGIN_MOCK="false"`，并配置真实 `WECHAT_MP_APPID` / `WECHAT_MP_APP_SECRET`。
- `JWT_SECRET` 必须设置，否则服务无法启动。
- Cookie 的 `Secure` 标记在 HTTP 部署时会自动关闭（由 `trust proxy` + `X-Forwarded-Proto` 判断），HTTPS 部署时自动启用。如需强制覆盖，可设置 `COOKIE_SECURE=true` 或 `COOKIE_SECURE=false`。
- `UPLOAD_SESSION_TTL_MINUTES` 控制图集上传会话有效期（分钟，默认 45）。
- `QDRANT_URL` 指向 Docker 内部服务名 `qdrant`（Docker Compose 服务名）。
- `IMAGE_EMBEDDING_MODEL` 当前实现默认 `Xenova/clip-vit-base-patch32`（CPU 友好）。
- `MUSIC_PLAY_URL_CACHE_TTL_SECONDS` 控制音乐实时播放链接缓存时长（秒，默认 600，最小 60）。

### 3.1 S3 对象存储配置（可选）

如需使用 S3 兼容对象存储（如 Bitiful）作为图片主图床，请配置以下环境变量：

| 变量 | 说明 |
|------|------|
| `S3_ENABLED` | 是否启用 S3（false=本地，true=S3） |
| `S3_ENDPOINT_URL` | S3 兼容端点地址（Bitiful 使用 `https://s3.bitiful.net`） |
| `S3_REGION` | 区域（Bitiful 使用 `cn-east-1`） |
| `S3_WRITE_ACCESS_KEY_ID` | 写入凭证 AccessKey（机密，仅后端使用） |
| `S3_WRITE_SECRET_ACCESS_KEY` | 写入凭证 SecretKey（机密，仅后端使用） |
| `S3_READ_ACCESS_KEY_ID` | 读取凭证 AccessKey（可用于前端） |
| `S3_READ_SECRET_ACCESS_KEY` | 读取凭证 SecretKey（可用于前端） |
| `S3_PUBLIC_BUCKET_NAME` | 存储桶名称 |
| `S3_MAX_FILE_SIZE` | 最大文件大小（字节），默认 10MB |
| `S3_ALLOWED_CONTENT_TYPES` | 允许的文件类型（逗号分隔） |
| `S3_ENABLE_MD5_VERIFICATION` | 是否启用 MD5 校验（推荐 true） |
| `S3_EXPIRES_IN` | 预签名 URL 过期时间（秒） |

详细配置指南请参考：`docs/S3_SETUP_GUIDE.md`

---

## 4. 一键部署（推荐）

项目提供了 Docker 一键部署脚本，会自动创建 `docker-compose.yml` 和 `Dockerfile` 并完成部署。

```bash
cd /root/huangshifu-wiki
chmod +x scripts/deploy-docker.sh
DB_PASSWORD=你的强密码 ./scripts/deploy-docker.sh
```

常用选项：

```bash
# 拉取最新代码后部署
PULL_LATEST=1 DB_PASSWORD=你的密码 ./scripts/deploy-docker.sh

# 跳过数据库初始化（已有数据）
SKIP_DB_INIT=1 DB_PASSWORD=你的密码 ./scripts/deploy-docker.sh

# 跳过 seed
SKIP_SEED=1 DB_PASSWORD=你的密码 ./scripts/deploy-docker.sh
```

部署完成后访问：
- 应用：`http://127.0.0.1:3000`
- Qdrant：`http://127.0.0.1:6333`

查看日志：`docker compose logs -f`

---

## 5. 手动部署（可选）

如需手动配置，可按以下步骤操作。

### 5.1 创建 Docker Compose 配置

```bash
cat > /root/huangshifu-wiki/docker-compose.yml <<'EOF'
services:
  postgres:
    image: postgres:18
    container_name: hsf-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: hsf_wiki
      POSTGRES_PASSWORD: 请替换为强密码
      POSTGRES_DB: huangshifu_wiki
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
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
      - "127.0.0.1:3000:3000"
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
```

---

### 5.2 创建 Dockerfile

在项目根目录创建 `Dockerfile`：

```bash
cat > /root/huangshifu-wiki/Dockerfile <<'EOF'
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmmirror.com

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
EOF
```

> **注意**：生产构建使用 `dist/server.js`（由 `npm run build` 生成），而非开发模式的 `npx tsx server.ts`。

---

### 5.3 启动基础服务（PostgreSQL + Qdrant）

```bash
cd /root/huangshifu-wiki
docker compose up -d postgres qdrant
docker compose ps
```

验证服务状态：

```bash
# 验证 PostgreSQL
docker exec -it hsf-postgres pg_isready -U hsf_wiki -d huangshifu_wiki

# 验证 Qdrant
curl http://127.0.0.1:6333/healthz
```

应返回 `{"status":"ok"}`。

---

### 5.4 安装依赖并初始化数据库

在宿主机安装依赖（用于运行 Prisma 命令）：

```bash
cd /root/huangshifu-wiki
npm ci --registry=https://registry.npmmirror.com
npm run db:generate
npm run db:deploy
npm run db:seed
```

> **重要：Prisma 版本兼容性**
>
> 本项目使用 Prisma 6.x（见 `package.json` 中的 `prisma` 版本），不支持 Prisma 7.x。
>
> 如果 `npm run db:generate` 报 `prisma: not found` 或 Prisma 7.x 特有的 schema 错误（如 `The datasource property url is no longer supported`），说明全局 `npx prisma` 调用了错误版本。
>
> 解决方法：
> ```bash
> # 方案一：重新安装依赖
> cd /root/huangshifu-wiki
> npm install --registry=https://registry.npmmirror.com
>
> # 方案二：显式安装正确版本
> npm install prisma@^6.7.0 @prisma/client@^6.7.0
>
> # 验证版本
> npx prisma --version  # 应显示 6.x
> ```

### 7.1 行政区划数据导入（v4.0+ 特性）

> **注意**：如果不需要地点标签功能，可跳过此步骤。

首次部署时需要导入行政区划数据（如需要地点标签功能）：

```bash
cd /root/huangshifu-wiki
npm run regions:import
```

该命令会从 `slightlee/regions-data` GitHub 仓库下载最新行政区划数据并导入。

> **高德地图 API 配置（如需地点功能）**：
> - `VITE_AMAP_JS_API_KEY`：前端地图选点组件用
> - `AMAP_API_KEY`：后端经纬度解析行政区划用

建议迁移后快速检查核心表是否创建成功：

```bash
docker exec -it hsf-postgres psql -U hsf_wiki -d huangshifu_wiki -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

返回应包含 `User`、`WikiPage`、`MusicTrack`、`Album`、`ImageEmbedding`、`SongCover`、`Region` 等表。

---

### 5.5 构建并启动应用

#### 5.5.1 构建应用镜像

```bash
cd /root/huangshifu-wiki
docker compose build app
```

#### 5.5.2 启动应用

```bash
docker compose up -d app
docker compose ps
```

验证健康检查：

```bash
curl http://127.0.0.1:3000/api/health
```

应返回 `{"status":"ok"}`。

---

### 5.6 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看应用日志
docker compose logs -f app

# 查看 PostgreSQL 日志
docker compose logs -f postgres

# 查看 Qdrant 日志
docker compose logs -f qdrant
```

---

### 5.7 配置 Nginx 反向代理

创建站点配置：`/etc/nginx/sites-available/huangshifu-wiki.conf`

```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN_OR_IP>;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用配置：

```bash
ln -sf /etc/nginx/sites-available/huangshifu-wiki.conf /etc/nginx/sites-enabled/huangshifu-wiki.conf
nginx -t
systemctl restart nginx
```

建议关闭 3000 对公网暴露，仅保留 80/443。

---

### 5.8 配置 HTTPS（Let's Encrypt）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

自动续期检查：

```bash
certbot renew --dry-run
```

---

## 12. 更新发布流程（后续版本）

```bash
cd /root/huangshifu-wiki
git pull

# 重新安装依赖并生成 Prisma Client
npm ci --registry=https://registry.npmmirror.com
npm run db:generate
npm run db:deploy

# 重新构建并启动
docker compose build app
docker compose up -d app

# 查看日志确认启动成功
docker compose logs -f app
```

> **地点标签功能（v4.0+）**：如果需要更新行政区划数据，可执行：
> ```bash
> npm run regions:import
> ```

发布后建议补一条数据库状态检查：

```bash
docker exec -it hsf-app npx prisma migrate status
```

---

## 13. 常见问题排查

### 13.1 `API key should be set when using the Gemini API`

表示未配置 `VITE_GEMINI_API_KEY`。

- 若不需要 AI，可忽略（功能会降级）。
- 若需要 AI：补上 key 后重新构建：

```bash
cd /root/huangshifu-wiki
npm run build
docker compose build app
docker compose up -d app
```

### 13.2 PostgreSQL 连接失败

- 检查 PostgreSQL 服务状态：`docker compose ps postgres`
- 检查容器日志：`docker compose logs postgres`
- 确认 `DATABASE_URL` 配置正确（注意 Docker 内部使用服务名 `postgres` 而非 `127.0.0.1`）
- 确认用户可登录：

```bash
docker exec -it hsf-postgres psql -U hsf_wiki -d huangshifu_wiki -c "SELECT 1;"
```

### 13.3 `permission denied for schema public`

在 PostgreSQL 容器内执行授权：

```bash
docker exec -it hsf-postgres psql -U hsf_wiki -d huangshifu_wiki -c "GRANT ALL ON SCHEMA public TO hsf_wiki;"
docker exec -it hsf-postgres psql -U hsf_wiki -d huangshifu_wiki -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hsf_wiki;"
docker exec -it hsf-postgres psql -U hsf_wiki -d huangshifu_wiki -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hsf_wiki;"
```

### 13.4 `listen EADDRINUSE: address already in use 0.0.0.0:3000`

```bash
docker compose down
docker compose up -d
```

### 13.5 图片语义搜索失败

- 检查 Qdrant 是否在线：

```bash
docker compose ps qdrant
curl http://127.0.0.1:6333/healthz
```

- 检查向量是否已生成：

```bash
curl http://127.0.0.1:3000/api/embeddings/status
```

### 13.6 前端页面 404（访问根路径）

确认 Dockerfile 使用了正确的构建输出：

- `npm run build` 必须在构建前执行
- `CMD ["node", "dist/server.js"]` 使用 `dist/` 目录中的产物
- 检查容器内是否存在 `dist/` 目录：

```bash
docker exec -it hsf-app ls -la /app/dist/
```

### 13.7 `prisma: not found`

宿主机依赖安装不完整：

```bash
cd /root/huangshifu-wiki
npm install --registry=https://registry.npmmirror.com
npx prisma --version  # 确认是 6.x
npm run db:generate
```

---

## 14. 备份建议

### 14.1 数据库备份

```bash
docker exec -it hsf-postgres pg_dump -U hsf_wiki huangshifu_wiki > /root/backup/huangshifu_wiki_$(date +%F).sql
```

### 14.2 上传文件备份

```bash
tar -czf /root/backup/uploads_$(date +%F).tar.gz /root/huangshifu-wiki/uploads
```

### 14.3 Docker 卷备份

```bash
docker run --rm -v huangshifu-wiki_postgres_data:/data -v /root/backup:/backup alpine tar czf /backup/postgres_vol_$(date +%F).tar.gz -C /data .
docker run --rm -v huangshifu-wiki_qdrant_storage:/data -v /root/backup:/backup alpine tar czf /backup/qdrant_vol_$(date +%F).tar.gz -C /data .
```

建议配合 `crontab` 做每日自动备份。

---

## 15. 常用操作

### 15.1 一键部署脚本

项目提供两个部署脚本：

**deploy-docker.sh（推荐用于 Docker 部署）**：

```bash
chmod +x scripts/deploy-docker.sh
DB_PASSWORD=你的密码 ./scripts/deploy-docker.sh
```

可选参数：
- `PULL_LATEST=1` - 拉取最新代码
- `SKIP_DB_INIT=1` - 跳过数据库初始化
- `SKIP_SEED=1` - 跳过 seed
- `APP_PORT` - 应用端口（默认 3000）

**deploy.sh（通用部署脚本）**：

```bash
# 非 Docker 模式（PM2）
./scripts/deploy.sh

# Docker 模式
USE_DOCKER=1 ./scripts/deploy.sh
```

### 15.2 Docker 特定操作

### 15.3 进入容器内部

```bash
# 进入应用容器
docker exec -it hsf-app sh

# 进入 PostgreSQL 容器
docker exec -it hsf-postgres psql -U hsf_wiki -d huangshifu_wiki

# 进入 Qdrant 容器（调试用）
docker exec -it hsf-qdrant sh
```

### 15.4 重启服务

```bash
# 重启单个服务
docker compose restart app
docker compose restart postgres
docker compose restart qdrant

# 重启所有服务
docker compose restart
```

### 15.5 停止服务

```bash
# 停止所有服务（保留卷）
docker compose down

# 停止所有服务并删除卷（危险！会丢失数据）
docker compose down -v
```

### 15.6 查看资源使用

```bash
docker stats
docker compose ps
```

---

## 16. 生产环境安全建议

1. **不要将端口暴露给公网**：所有服务只绑定到 `127.0.0.1`，通过 Nginx 对外服务
2. **定期更新镜像版本**：关注 PostgreSQL、Qdrant、Node.js 的安全更新
3. **使用 Docker 网络隔离**：确认 `docker-compose.yml` 使用默认 bridge 网络
4. **保护 `.env` 文件**：`chmod 600 .env`，不将其提交到版本控制
5. **配置日志轮转**：编辑 `/etc/docker/daemon.json`：

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

然后重启 Docker：`systemctl restart docker`

---

## 17. 环境变量参考

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_GEMINI_API_KEY` | Gemini API Key | 空 |
| `DATABASE_URL` | PostgreSQL 连接地址 | `postgresql://...` |
| `JWT_SECRET` | JWT 签名密钥 | - |
| `SEED_SUPER_ADMIN_EMAIL` | 初始管理员邮箱 | `admin@example.com` |
| `SEED_SUPER_ADMIN_PASSWORD` | 初始管理员密码 | - |
| `CORS_ORIGIN` | 允许的请求来源 | - |
| `WECHAT_MP_APPID` | 微信小程序 AppID | 空 |
| `WECHAT_MP_APP_SECRET` | 微信小程序 AppSecret | 空 |
| `WECHAT_LOGIN_MOCK` | 微信登录 Mock 模式 | `false` |
| `QDRANT_URL` | Qdrant 服务地址 | `http://qdrant:6333` |
| `QDRANT_API_KEY` | Qdrant API Key | 空 |
| `VITE_AMAP_JS_API_KEY` | 高德地图 JS API Key | 空 |
| `AMAP_API_KEY` | 高德地图 Web Service Key | 空 |
