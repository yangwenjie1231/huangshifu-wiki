# 诗扶小筑服务器部署指南

本文档用于将项目部署到 Linux 服务器，包含数据库、进程守护、反向代理和 HTTPS 配置。

## 项目架构

| 层级 | 技术 |
|------|------|
| 前端 | Vite 6 + React 19 + TypeScript + Tailwind CSS 4 |
| 后端 | Express（`server.ts`） |
| 数据库 | Prisma 6.x + PostgreSQL 18 |
| 向量检索 | Qdrant + CLIP（`Xenova/clip-vit-base-patch32`） |
| 进程守护 | PM2 |
| 反向代理 | Nginx |
| AI 集成 | Gemini（`@google/genai`） |
| ORM | Prisma（SQLite 用于本地开发，PostgreSQL 用于生产） |

> 数据访问说明：当前前端业务页面（Wiki/Forum/Gallery/Admin/Music）统一走 REST API（`/api/*`）+ Prisma，`src/lib/firebaseCompat/` 已移除。

## 快速开始（无旧数据迁移场景）

```bash
# 1. 克隆项目
git clone <仓库地址> huangshifu-wiki
cd huangshifu-wiki

# 2. 一键部署（推荐）
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

一键部署脚本会自动完成：环境检测、依赖安装、数据库迁移、前端构建、PM2 启动。

---

## 1. 环境要求

- Debian/Ubuntu Linux
- Node.js 20+
- npm 9+
- PostgreSQL 18
- Docker + Docker Compose（用于 Qdrant）
- Nginx

### 1.1 安装基础工具

```bash
apt update
apt install -y git curl nginx
```

### 1.2 安装 Docker（如未安装）

使用 Docker 官方安装脚本（推荐，比 Debian 源更完整）：

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# 安装 Docker Compose v2 插件（官方安装脚本不包含 compose 插件）
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# 验证安装
docker --version
docker compose version
```

> **注意**：Docker Compose 使用 `docker compose` 子命令（注意是空格不是横杠），是 v2+ 内置的插件形式。

### 1.3 安装 Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

### 1.4 安装 PostgreSQL 18

```bash
apt install -y gnupg ca-certificates lsb-release

install -d /usr/share/keyrings

curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/postgresql-archive-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

apt update
apt install -y postgresql-18 postgresql-client-18
systemctl enable --now postgresql
```

---

## 2. 数据库初始化

### 2.1 创建数据库和用户

建议使用独立数据库用户，不要让应用直接使用 `postgres` 超级用户。

```bash
sudo -u postgres psql

CREATE DATABASE huangshifu_wiki;
CREATE USER hsf_app WITH ENCRYPTED PASSWORD '请替换为强密码';
GRANT ALL PRIVILEGES ON DATABASE huangshifu_wiki TO hsf_app;
\q
```

### 2.2 授予 schema 权限

```bash
sudo -u postgres psql -d huangshifu_wiki -c "GRANT ALL ON SCHEMA public TO hsf_app;"
sudo -u postgres psql -d huangshifu_wiki -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hsf_app;"
sudo -u postgres psql -d huangshifu_wiki -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hsf_app;"
```

---

## 3. 配置环境变量

```bash
cat > /root/huangshifu-wiki/.env <<'EOF'
VITE_GEMINI_API_KEY=""
DATABASE_URL="postgresql://hsf_app:请替换为强密码@127.0.0.1:5432/huangshifu_wiki"
JWT_SECRET="请替换为至少32位随机字符串"
SEED_SUPER_ADMIN_EMAIL="admin@example.com"
SEED_SUPER_ADMIN_PASSWORD="请替换为强密码"
SEED_SUPER_ADMIN_NAME="管理员"
CORS_ORIGIN="https://你的域名"
WECHAT_MP_APPID=""
WECHAT_MP_APP_SECRET=""
WECHAT_LOGIN_MOCK="false"
UPLOAD_SESSION_TTL_MINUTES="45"
QDRANT_URL="http://127.0.0.1:6333"
QDRANT_API_KEY=""
QDRANT_COLLECTION="hsf_image_embeddings"
IMAGE_EMBEDDING_MODEL="Xenova/clip-vit-base-patch32"
IMAGE_EMBEDDING_VECTOR_SIZE="512"
IMAGE_EMBEDDING_BATCH_SIZE="100"
IMAGE_SEARCH_RESULT_LIMIT="24"
MUSIC_PLAY_URL_CACHE_TTL_SECONDS="600"

# 数据库备份（必须设置，否则备份功能不可用）
BACKUP_PASSWORD="请替换为备份加密密码"
BACKUP_RETAIN_COUNT="20"

# 高德地图 - 前端 JS API（地点选择、地图展示）
VITE_AMAP_JS_API_KEY=""
VITE_AMAP_SECURITY_JS_CODE=""
# 高德地图 - 后端 API（地理编码、逆地理编码）
AMAP_API_KEY=""

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

### 环境变量说明

| 变量 | 说明 |
|------|------|
| `VITE_GEMINI_API_KEY` | 空时 AI 功能自动降级 |
| `JWT_SECRET` | 必须设置，否则服务无法启动 |
| `WECHAT_LOGIN_MOCK` | 联调阶段可设 `true`，正式环境设 `false` |
| `COOKIE_SECURE` | HTTP 部署自动关闭，HTTPS 自动启用 |
| `QDRANT_URL` | 指向本机 Qdrant 时保持 `http://127.0.0.1:6333` |
| `S3_ENABLED` | 是否启用 S3 存储（false=本地，true=S3） |
| `S3_ENDPOINT_URL` | S3 兼容端点地址 |
| `S3_WRITE_ACCESS_KEY_ID` | 写入凭证 AccessKey（机密，仅后端使用） |
| `S3_WRITE_SECRET_ACCESS_KEY` | 写入凭证 SecretKey（机密，仅后端使用） |
| `S3_READ_ACCESS_KEY_ID` | 读取凭证 AccessKey（可用于前端） |
| `S3_READ_SECRET_ACCESS_KEY` | 读取凭证 SecretKey（可用于前端） |
| `S3_PUBLIC_BUCKET_NAME` | 存储桶名称 |
| `S3_MAX_FILE_SIZE` | 最大文件大小（字节），默认 10MB |
| `S3_ALLOWED_CONTENT_TYPES` | 允许的文件类型（逗号分隔） |
| `S3_ENABLE_MD5_VERIFICATION` | 是否启用 MD5 校验（推荐 true） |
| `S3_EXPIRES_IN` | 预签名 URL 过期时间（秒） |
| `VITE_AMAP_JS_API_KEY` | 高德地图 JS API Key（Web 平台） |
| `VITE_AMAP_SECURITY_JS_CODE` | 高德地图安全密钥（JS API 2.0 必须） |
| `AMAP_API_KEY` | 高德地图 Web 服务 API Key（服务端地理编码用） |
| `BACKUP_PASSWORD` | 数据库备份加密密码（必须设置，否则备份功能不可用） |
| `BACKUP_RETAIN_COUNT` | 备份文件保留数量（默认 20），超过后自动删除最旧备份 |

### 3.1 微信小程序 WebView 登录相关

本仓库已提供最小化小程序壳工程：`miniprogram-webview/`。

- 小程序端流程：`wx.login()` 获取 `code` → 打开 `<web-view>`。
- WebView URL 会追加 `wx_code` 查询参数，Web 端自动调用 `POST /api/auth/wechat/login` 完成登录。
- 生产环境必须配置：`WECHAT_MP_APPID`、`WECHAT_MP_APP_SECRET`，并确保 `WECHAT_LOGIN_MOCK=false`。
- 小程序后台需完成：业务域名配置（HTTPS）、request 合法域名配置（后端 API 域名）。

开发调试可将 `WECHAT_LOGIN_MOCK=true`，并在 Web 端直接访问：

```text
https://你的域名/?wx_code=mock:openId
```

> **注意**：修改 `VITE_*` 变量后需要重新构建前端：`npm run build`

---

## 4. 启动 Qdrant 向量数据库

项目根目录已包含 `docker-compose.yml`，可直接启动：

```bash
cd /root/huangshifu-wiki
docker compose up -d qdrant
docker compose ps
curl http://127.0.0.1:6333/healthz
```

返回 `{"status":"ok"}` 表示正常。

---

## 5. 初始化 Prisma 与数据库

```bash
cd /root/huangshifu-wiki
npm ci --registry=https://registry.npmmirror.com  # 如在国内
npm run db:generate
npm run db:deploy
npm run db:seed
```

> **Prisma 版本注意**：本项目使用 Prisma 6.x，不支持 7.x。若报 `prisma: not found` 或 schema 错误，重新安装：
> ```bash
> npm install prisma@^6.7.0 @prisma/client@^6.7.0
> npx prisma --version  # 应显示 6.x
> ```

### 5.1 验证数据库表

```bash
psql "postgresql://hsf_app:请替换为强密码@127.0.0.1:5432/huangshifu_wiki" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

### 5.2 数据库重建（仅适用于无旧数据）

```bash
psql "postgresql://hsf_app:请替换为强密码@127.0.0.1:5432/huangshifu_wiki" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:deploy
npm run db:seed
```

### 5.3 导入行政区划数据（v4.0+ 地点标签功能）

地点标签功能需要导入中国行政区划数据：

```bash
npm run regions:import
```

此命令从 [slightlee/regions-data](https://github.com/slightlee/regions-data) 获取最新行政区划数据并写入 `Region` 表。

---

## 6. 构建并启动服务

> **重要**：必须先构建前端，否则服务只能提供 API，前端页面会 404。

```bash
cd /root/huangshifu-wiki
npm run build
NODE_ENV=production npx tsx server.ts
```

验证健康检查：

```bash
curl http://127.0.0.1:3000/api/health
# 返回: {"status":"ok"}
```

---

## 7. 使用 PM2 守护进程

```bash
npm i -g pm2
cd /root/huangshifu-wiki
pm2 delete huangshifu-wiki || true
pm2 start "NODE_ENV=production npx tsx server.ts" --name huangshifu-wiki --cwd /root/huangshifu-wiki
pm2 save
pm2 startup systemd -u root --hp /root
```

常用命令：

```bash
pm2 status
pm2 logs huangshifu-wiki
pm2 restart huangshifu-wiki --update-env  # 更新 .env 后使用
pm2 stop huangshifu-wiki
```

---

## 8. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/huangshifu-wiki.conf`：

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

建议关闭 3000 端口对公网暴露，仅保留 80/443。

---

## 9. 配置 HTTPS（Let's Encrypt）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

自动续期检查：

```bash
certbot renew --dry-run
```

---

## 10. 部署脚本参数

项目提供的一键部署脚本 `scripts/deploy.sh`：

```bash
./scripts/deploy.sh                    # 标准部署
PULL_LATEST=1 ./scripts/deploy.sh      # 部署前拉取最新代码
SKIP_SEED=1 ./scripts/deploy.sh        # 跳过数据库播种
USE_PM2=0 ./scripts/deploy.sh         # 不使用 PM2
```

环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_NAME` | `huangshifu-wiki` | PM2 进程名 |
| `APP_PORT` | `3000` | 健康检查端口 |
| `ENV_FILE` | `.env` | 环境文件路径 |
| `INSTALL_MODE` | `ci` | 依赖安装模式 |
| `ENABLE_VECTOR_SYNC` | `1` | 部署时自动执行向量同步 |
| `VECTOR_SYNC_LIMIT` | `100` | 向量同步批次大小 |

---

## 11. 上线后验证清单

- [ ] `https://your-domain.com/api/health` 返回 `{"status":"ok"}`
- [ ] 前端可访问首页，静态资源加载正常
- [ ] 可以注册/登录
- [ ] 管理员账号可进入后台
- [ ] 图集上传可写入 `uploads/`
- [ ] 数据可写入 PostgreSQL
- [ ] Wiki 列表/详情/编辑通过 REST API 正常读写（`/api/wiki*`）
- [ ] Gallery 列表通过 REST API 正常加载（`/api/galleries`）
- [ ] Music 列表与删除通过 REST API 正常工作（`/api/music*`）
- [ ] 图片映射查询与写入通过 REST API 正常工作（`/api/image-maps*`）
- [ ] 小程序 WebView 可打开首页（`miniprogram-webview`）
- [ ] 小程序 WebView 可打开首页（`miniprogram-webview`）
- [ ] 小程序首次进入可自动登录（`wx.login code` -> `/api/auth/wechat/login`）
- [ ] 小程序中可完成浏览 Wiki、发帖、评论闭环（`/api/mp/wiki`、`/api/mp/posts`、`/api/mp/comments`）

### 11.1 S3 存储验证清单（如已启用）

- [ ] S3 配置已正确添加到 `.env` 文件
- [ ] `S3_ENABLED=true` 已设置
- [ ] Bitiful 控制台已创建存储桶
- [ ] 已创建写入凭证子用户（仅 PutObject、DeleteObject、ListBucket 权限）
- [ ] 已创建读取凭证子用户（仅 GetObject、ListBucket 权限）
- [ ] `GET /api/s3/config` 返回正确配置
- [ ] Admin 后台「图片管理」显示 S3 统计
- [ ] 可以成功上传图片到 S3
- [ ] 上传的图片可通过签名 URL 访问
- [ ] MD5 校验功能正常工作

---

## 12. 常见问题排查

### 12.1 `API key should be set when using the Gemini API`

未配置 `VITE_GEMINI_API_KEY`。若不需要 AI 功能可忽略；否则补上后重新构建：

```bash
npm run build
pm2 restart huangshifu-wiki --update-env
```

### 12.2 PostgreSQL 连接失败

```bash
# 检查服务状态
systemctl status postgresql

# 测试连接
psql "postgresql://hsf_app:密码@127.0.0.1:5432/huangshifu_wiki" -c "SELECT 1;"

# 认证失败时重置密码
sudo -u postgres psql -c "ALTER USER hsf_app WITH ENCRYPTED PASSWORD '密码';"
```

### 12.3 `permission denied for schema public`

```bash
sudo -u postgres psql -d huangshifu_wiki -c "GRANT ALL ON SCHEMA public TO hsf_app;"
sudo -u postgres psql -d huangshifu_wiki -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hsf_app;"
sudo -u postgres psql -d huangshifu_wiki -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hsf_app;"
```

### 12.4 `listen EADDRINUSE: address already in use 0.0.0.0:3000`

```bash
pm2 delete huangshifu-wiki || true
pkill -f "tsx server.ts" || true
pm2 start "NODE_ENV=production npx tsx server.ts" --name huangshifu-wiki --cwd /root/huangshifu-wiki
pm2 save
```

### 12.5 图片语义搜索失败

```bash
# 检查 Qdrant 状态
docker compose ps
curl http://127.0.0.1:6333/healthz

# 检查向量状态
curl http://127.0.0.1:3000/api/embeddings/status
```

### 12.6 数据库 Schema 漂移（500 错误）

症状：API 返回 500，PostgreSQL 正常。错误日志出现类似 `column does not exist` 或 `relation does not exist`。

**诊断**：

```bash
# 查看 PostgreSQL 错误日志
sudo tail -100 /var/log/postgresql/postgresql-*-main.log

# 检查迁移状态
npx prisma migrate status
```

**解决方案（无旧数据）**：

```bash
pm2 delete huangshifu-wiki || true
psql "postgresql://hsf_app:密码@127.0.0.1:5432/huangshifu_wiki" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:deploy
npm run db:seed
pm2 start "NODE_ENV=production npx tsx server.ts" --name huangshifu-wiki --cwd /root/huangshifu-wiki
pm2 save
```

**预防**：
- 每次 `git pull` 后执行 `npm run db:generate` 和 `npm run db:deploy`
- 大版本升级后检查 `npx prisma migrate status`

### 12.7 `prisma: not found`

```bash
cd /root/huangshifu-wiki
npm install --registry=https://registry.npmmirror.com
npx prisma --version  # 确认是 6.x
npm run db:generate
```

### 12.8 前端页面 404（只有 API 正常）

未执行 `npm run build`：

```bash
npm run build
pm2 restart huangshifu-wiki --update-env
pm2 save
```

### 12.9 批量导入专辑/歌单成功但歌曲未关联到专辑

症状：导入专辑后，专辑创建成功，但专辑详情页显示 0 首歌曲。

**诊断**：

1. 检查 `SongAlbumRelation` 表是否有该专辑的关联记录：
```bash
psql "postgresql://hsf_app:密码@127.0.0.1:5432/huangshifu_wiki" \
  -c "SELECT * FROM \"SongAlbumRelation\" WHERE \"albumDocId\" IN (SELECT \"docId\" FROM \"Album\" WHERE title='专辑名称');"
```

2. 检查导入日志中 `linked` 计数是否异常。

**原因**：代码中 `normalizeTrackDiscPayload` 函数期望的字段是 `songDocId`，但导入时传入的是 `docId`，导致关联数据无法正确创建。

**解决方案**：升级到包含此修复的版本，或手动执行以下 SQL 修复已有数据：
```bash
psql "postgresql://hsf_app:密码@127.0.0.1:5432/huangshifu_wiki" -c "
-- 检查 SongAlbumRelation 是否为空
SELECT COUNT(*) FROM \"SongAlbumRelation\" WHERE \"albumDocId\" IN (
  SELECT \"docId\" FROM \"Album\" WHERE \"resourceType\" = 'album'
);
"
```

---

## 13. 更新发布流程

```bash
cd /root/huangshifu-wiki
git pull
npm ci
npm run db:generate
npm run db:deploy
npm run build
npm run embeddings:sync -- --limit=100
pm2 restart huangshifu-wiki --update-env
pm2 save
```

发布后检查迁移状态：

```bash
npx prisma migrate status
```

### 13.1 发布前代码质量验证（建议）

在服务器更新代码后、重启 PM2 前，建议先执行：

```bash
cd /root/huangshifu-wiki
npm run lint
npm test
npm run build
```

说明：

- `npm run lint`：执行 TypeScript 类型检查（`tsc --noEmit`）
- `npm test`：执行 Vitest 单元测试
- `npm run build`：验证生产构建可通过

若三项全部通过，再执行 `pm2 restart huangshifu-wiki --update-env`。

---

## 14. 数据库备份

### 14.1 内置备份功能（推荐）

项目已内置数据库备份管理功能，超级管理员可通过管理面板操作。

**前置条件**：

1. 服务器已安装 `pg_dump` 和 `psql`（PostgreSQL 客户端工具，安装 PostgreSQL 时自带）
2. 在 `.env` 中配置 `BACKUP_PASSWORD`（备份加密密码）

**使用方法**：

1. 使用超级管理员账号登录
2. 进入管理面板，选择「数据库备份」标签页
3. 点击「创建备份」并输入备份密码
4. 备份完成后可点击下载按钮将加密备份文件下载到本地
5. 需要恢复时，点击「上传恢复」，选择之前下载的 `.zip` 备份文件并输入密码

**功能特性**：

- 手动创建加密备份（AES-256-CBC 加密 + ZIP 压缩）
- 下载备份文件到本地
- 上传备份文件恢复数据库
- 删除旧备份
- 自动保留最近 N 个备份（默认 20 个，可通过 `BACKUP_RETAIN_COUNT` 配置）

**备份范围**：

- 包含全部数据表（用户、帖子、百科、音乐、图集等）
- 不包含向量数据（`ImageEmbedding` 表，可通过管理面板的向量管理功能重建）
- 不包含 Prisma 迁移记录（`_prisma_migrations` 表）

**注意事项**：

- 恢复操作会**覆盖当前数据库中的所有数据**，请谨慎操作
- 备份密码用于加密备份文件内容，请妥善保管
- 每次创建/恢复/删除操作都需要输入备份密码验证
- 备份文件存储在服务器 `backups/` 目录下

### 14.2 手动备份（备选方案）

如需手动备份，可使用以下命令：

```bash
pg_dump "postgresql://hsf_app:密码@127.0.0.1:5432/huangshifu_wiki" > /root/backup/huangshifu_wiki_$(date +%F).sql
```

### 14.3 上传文件备份

```bash
tar -czf /root/backup/uploads_$(date +%F).tar.gz /root/huangshifu-wiki/uploads
```

建议配合 `crontab` 做每日自动备份。

---

## 15. 安全机制说明

### 15.1 认证令牌安全存储

- JWT 通过 `httpOnly` Cookie 存储，不存储在 `localStorage`
- Cookie 配置：`httpOnly: true`, `sameSite: 'lax'`, `secure: true`（生产环境）
- 有效期：7 天

### 15.2 内容安全与 XSS 防护

- Wiki 和论坛内容使用 `rehype-sanitize` 进行 HTML 清理
- 默认阻止危险元素：`<script>`, `<form>`, `<object>`, `<embed>` 等
- 阻止事件处理器：`onclick`, `onerror`, `onload` 等
- 阻止危险协议：`javascript:`, `data:`, `vbscript:`

### 15.3 安全嵌入平台白名单

| 平台 | 域名 |
|------|------|
| Bilibili | player.bilibili.com |
| 网易云音乐 | music.163.com |
| QQ 音乐 | y.qq.com |
| YouTube | youtube.com / www.youtube.com |
| 优酷 | player.youku.com |
| 爱奇艺 | open.iqiyi.com / www.iqiyi.com |
| 微博视频 | weibo.com / www.weibo.com |
| Vimeo | vimeo.com / player.vimeo.com |

### 15.4 Content Security Policy 与高德地图

本项目配置了严格的 CSP（Content Security Policy）头部，以防止 XSS 和注入攻击。

**高德地图 JS API 白名单**（必须包含以下域名才能正常使用地图功能）：

| 域名 | 用途 |
|------|------|
| `webapi.amap.com` | 高德 Web API 主域名 |
| `jsapi.amap.com` | 高德 JS API 域名 |
| `jsapi-service.amap.com` | 高德 JS API 服务域名 |
| `restapi.amap.com` | 高德 REST API 域名 |
| `mapplugin.amap.com` | 高德地图插件域名 |

**说明**：
- CSP 配置位于 `server.ts` 中，共三处：开发环境中间件（line 51）、生产环境 `startServer` 函数（line 12777）、生产环境最终配置（line 12799）
- `script-src` 和 `connect-src` 指令都需要包含上述所有高德域名
- 如果地图功能无法加载（脚本被阻塞），请检查所有三处 CSP 配置是否一致

### 15.5 音乐播放音源架构

本项目采用**客户端直连 + 服务器缓存**混合架构，针对不同平台选择最优播放方案。

**播放策略**：

| 平台 | 播放方式 | 说明 |
|------|----------|------|
| 网易云音乐 | 客户端直连 | 直接构造 URL: `https://music.163.com/song/media/outer/url?id={neteaseId}.mp3` |
| QQ/酷狗/百度/酷我 | 服务器 API | 通过 `/api/music/:docId/play-url` 获取，服务器缓存结果 |

**实现逻辑**：

1. **网易云歌曲**（`primaryPlatform === 'netease'` 且存在 `neteaseId`）：
   - 前端直接构造直链，绕过服务器
   - 用户客户端直连网易云服务器，延迟最低

2. **其他平台歌曲**：
   - 前端请求服务器 `/api/music/:docId/play-url`
   - 服务器优先使用缓存（默认 10 分钟 TTL）
   - 缓存未命中时调用 Meting API 获取播放地址

**优势**：

- 网易云歌曲：用户端直连，绕过服务器网络瓶颈，播放延迟从 ~10s 降至 <1s
- 其他平台：服务器缓存减少外部 API 调用，提升稳定性

**环境变量**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MUSIC_PLAY_URL_CACHE_TTL_SECONDS` | `600` | 播放地址缓存 TTL（秒） |

### 15.6 敏感词过滤

本项目内置敏感词检测功能，用于过滤热门搜索词和辅助内容审核。

**功能特性**：

- **DFA 算法**：使用确定性有限自动机（DFA）实现高效敏感词匹配
- **搜索过滤**：敏感词不会被记录到热门搜索词中
- **审核辅助**：审核内容时自动检测敏感词并高亮显示
- **管理工具**：提供敏感词检测面板，可手动检测任意文本

**敏感词库**：

敏感词库文件位于 `public/sensitive-words/words.txt`，每行一个敏感词。

**下载敏感词库**：

```bash
npm run download:sensitive-words
```

该脚本从 GitHub 仓库下载最新的敏感词列表。如需使用自定义词库，请将词库文件放置于 `public/sensitive-words/words.txt`。

**API 接口**：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/check-sensitive` | POST | 敏感词检测（需管理员权限），请求体 `{ text: string }`，返回 `{ sensitiveWords: string[] }` |
| `/api/admin/review-queue` | GET | 审核队列返回时自动附带 `sensitiveWords` 字段 |

**管理员面板**：

在「审核队列」中，待审核内容会自动显示检测到的敏感词。在「敏感词检测」面板可手动输入文本进行检测。

**实现逻辑**：

1. **网易云歌曲**（`primaryPlatform === 'netease'` 且存在 `neteaseId`）：
   - 前端直接构造直链，绕过服务器
   - 用户客户端直连网易云服务器，延迟最低

2. **其他平台歌曲**：
   - 前端请求服务器 `/api/music/:docId/play-url`
   - 服务器优先使用缓存（默认 10 分钟 TTL）
   - 缓存未命中时调用 Meting API 获取播放地址

**优势**：

- 网易云歌曲：用户端直连，绕过服务器网络瓶颈，播放延迟从 ~10s 降至 <1s
- 其他平台：服务器缓存减少外部 API 调用，提升稳定性

**环境变量**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MUSIC_PLAY_URL_CACHE_TTL_SECONDS` | `600` | 播放地址缓存 TTL（秒） |

---

## 附录：主要数据库表

| 表名 | 说明 |
|------|------|
| `User` | 用户账号（包含 `preferences` JSON 字段存储视图偏好） |
| `Post` | 论坛帖子 |
| `PostComment` | 评论（支持关联 `Post` 或 `Gallery`） |
| `WikiPage` | Wiki 页面 |
| `Gallery` | 图集（支持版权标识 `copyright` 字段） |
| `MusicTrack` | 音乐曲目 |
| `Album` | 专辑 |
| `MediaAsset` | 媒体资产 |
| `ImageEmbedding` | 图片向量 |
| `Region` | 行政区划 |
| `EditLock` | 编辑锁 |
| `WikiBranch` | Wiki 分支 |
| `WikiPullRequest` | Wiki PR |

---

## 附录：更新日志

### v6.x

- **移除 firebaseCompat 兼容层**：彻底删除 `src/lib/firebaseCompat/` 与 `src/firebase.ts`
  - `imageService` 改为直接调用 `/api/image-maps`（按 MD5 查重 + upsert 映射）
  - `Music` 页面认证引用改为 `src/lib/auth.ts`
  - **部署影响**：无数据库迁移，无新增环境变量，仅需常规 `npm run build` 后重启服务

- **小程序 WebView 壳工程 + Web 自动登录**：新增 `miniprogram-webview/`，并在 Web 端增加 `wx_code` 自动登录能力
- **小程序 WebView 壳工程 + Web 自动登录**：新增 `miniprogram-webview/`，并在 Web 端增加 `wx_code` 自动登录能力
  - 新增 `src/lib/miniProgram.ts`：解析/清理 `wx_code` 及可选头像昵称参数
  - 更新 `src/App.tsx`：在小程序 WebView 环境下自动触发 `loginWithWeChat`
  - 新增 `miniprogram-webview/`：可直接在微信开发者工具导入运行
  - **部署影响**：无数据库迁移；需确保生产环境微信小程序凭据已配置且业务域名已在微信后台放行

- **P0 代码复用重构**：抽取重复工具函数与类型定义，减少重复代码并降低维护成本
  - 新增 `src/lib/formatUtils.ts`：统一音乐时长格式化
  - 新增 `src/lib/dateUtils.ts`：统一日期解析与格式化
  - 新增 `src/lib/contentUtils.ts`：统一状态文案与标签输入处理
  - 新增 `src/types/PlatformIds.ts`：统一音乐平台 ID 类型
  - **部署影响**：无数据库迁移，无新增环境变量，仅需常规 `npm run build` 后重启服务

- **图集评论功能**：图集现在支持评论功能，用户可以对已发布的图集发表评论和回复
  - 新增 `GET /api/galleries/:id/comments` API 获取图集评论
  - 新增 `POST /api/galleries/:id/comments` API 发表评论
  - **数据库变更**：`PostComment` 表新增 `galleryId String?` 可选字段，支持关联图集

- **图集版权标识**：图集现在支持设置版权标识信息
  - `PATCH /api/galleries/:id` API 新增支持 `copyright` 字段
  - **数据库变更**：`Gallery` 表新增 `copyright String?` 可选字段
  - 图集作者和管理员可以在编辑图集时设置版权信息

- **部署注意**：更新代码后需执行 `npm run db:generate` 和 `npm run db:push`（开发环境）或 `npm run db:deploy`（生产环境）以应用新的 Prisma schema

### v5.x

- **统一前端数据访问到 REST API**：Wiki / Gallery / Music 页面不再依赖 Firebase 风格查询调用，统一改为 `apiGet/apiPost/apiPut/apiDelete`
  - Wiki 列表、编辑、历史、时间轴改为直接请求 `/api/wiki*`
  - Gallery 列表移除兼容层 `onSnapshot` 轮询，改为页面加载时 REST 拉取
  - Music 列表、去重检查、删除改为直接请求 `/api/music*`
  - `src/lib/firebaseCompat/` 保留为备用兼容层（非主路径）

- **敏感词过滤功能**：内置 DFA 算法敏感词检测，用于过滤热门搜索词和辅助内容审核
  - 敏感词不会被记录到热门搜索
  - 审核内容时自动检测并显示敏感词
  - 新增「敏感词检测」管理面板
  - 新增 `POST /api/admin/check-sensitive` API
  - 敏感词库文件位于 `public/sensitive-words/words.txt`
  - **部署注意**：需执行 `npm run download:sensitive-words` 下载敏感词库

- **新增用户视图偏好设置**：用户可以选择四种内容展示模式（大图标、中图标、小图标、列表），偏好设置存储在 `User.preferences` 字段（JSON 类型），支持以下页面：
  - 百科页面（Wiki）
  - 图集馆（Gallery）
  - 音乐页面（Music）
  - 搜索结果（Search）
- **API 变更**：`PATCH /api/users/me` 新增支持 `preferences` 字段，可更新用户偏好设置
- **数据库变更**：`User` 表新增 `preferences Json? @default("{}")` 字段
- **部署注意**：更新代码后需执行 `npm run db:generate` 和 `npm run db:deploy` 以应用新的 Prisma schema

### v4.x

- **移动端底部导航新增搜索入口**：移动端视图（`< md`）的底部导航栏（`BottomNav`）已新增「搜索」按钮，与桌面端导航栏的搜索链接保持一致。无需服务器端操作，仅需前端重新构建部署。
