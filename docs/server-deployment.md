ssh参数
公网 IP 地址：<YOUR_SERVER_IP>
远程用户名：root
远程密码：<YOUR_SERVER_PASSWORD>
# 诗扶小筑服务器部署与配置指南

本文档用于把当前项目部署到 Linux 服务器，并完成数据库、进程守护、反向代理和 HTTPS 配置。

适用架构：

- 前端：Vite + React
- 后端：Express (`server.ts`)
- 数据库：Prisma + MariaDB/MySQL
- 鉴权：本地账号密码 + JWT Cookie
- 微信登录：微信小程序 `code2session`（支持 mock 联调）

---

## 1. 部署前准备

建议环境：

- Debian/Ubuntu Linux
- Node.js 20+
- npm 9+
- MariaDB 11.8+（或 MySQL 8+）
- Docker + Docker Compose（用于 Qdrant 向量库）
- Nginx（用于域名和 HTTPS）

安装基础工具（Debian/Ubuntu）：

```bash
apt update
apt install -y git curl nginx
```

安装 Docker（如果未安装）：

```bash
apt install -y docker.io docker-compose-plugin
systemctl enable --now docker
docker --version
docker compose version
```

安装 Node.js 20（示例）：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

---

## 2. 数据库初始化（MariaDB）
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
建议使用独立数据库用户，不要让应用直接使用 `root`。

```bash
# 进入 MariaDB
mariadb

# 执行 SQL
CREATE DATABASE IF NOT EXISTS huangshifu_wiki CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'hsf_app'@'127.0.0.1' IDENTIFIED BY '请替换为强密码';
GRANT ALL PRIVILEGES ON huangshifu_wiki.* TO 'hsf_app'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. 拉取项目并安装依赖

```bash
cd /root
git clone <你的仓库地址> huangshifu-wiki
cd /root/huangshifu-wiki
npm ci
```

如果 `npm ci` 超时，可临时切镜像：

```bash
npm ci --registry=https://registry.npmmirror.com
```

---

## 4. 配置环境变量

创建生产环境变量文件：

```bash
cat > /root/huangshifu-wiki/.env <<'EOF'
VITE_GEMINI_API_KEY=""
DATABASE_URL="mysql://hsf_app:请替换为强密码@127.0.0.1:3306/huangshifu_wiki"
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
EOF
```

说明：

- `VITE_GEMINI_API_KEY` 为空时，AI 功能会自动降级（不报致命错）。
- 修改任何 `VITE_*` 变量后都需要重新构建前端：`npm run build`。
- 小程序联调阶段可临时设置 `WECHAT_LOGIN_MOCK="true"`，用 mock code 验证闭环。
- 正式环境建议固定 `WECHAT_LOGIN_MOCK="false"`，并配置真实 `WECHAT_MP_APPID` / `WECHAT_MP_APP_SECRET`。
- `JWT_SECRET` 必须设置，否则服务无法启动。
- Cookie 的 `Secure` 标记在 HTTP 部署时会自动关闭（由 `trust proxy` + `X-Forwarded-Proto` 判断），HTTPS 部署时自动启用。如需强制覆盖，可设置环境变量 `COOKIE_SECURE=true` 或 `COOKIE_SECURE=false`。
- `UPLOAD_SESSION_TTL_MINUTES` 控制图集上传会话有效期（分钟，默认 45）。
- `QDRANT_URL` 指向本机 Qdrant 时建议保持 `http://127.0.0.1:6333`。
- `IMAGE_EMBEDDING_MODEL` 当前实现默认 `Xenova/clip-vit-base-patch32`（CPU 友好）。
- `MUSIC_PLAY_URL_CACHE_TTL_SECONDS` 控制音乐实时播放链接缓存时长（秒，默认 600，最小 60）。

---

## 5.1 启动向量数据库（Qdrant）

项目根目录已包含 `docker-compose.yml`，可直接启动：

```bash
cd /root/huangshifu-wiki
docker compose up -d qdrant
docker compose ps
curl http://127.0.0.1:6333/healthz
```

若返回 `{"status":"ok"}` 说明 Qdrant 正常。

---

## 6. 初始化 Prisma 与数据库表

```bash
cd /root/huangshifu-wiki
npm run db:generate
npx prisma db execute --file prisma/migrate.sql --schema prisma/schema.prisma
npm run db:seed
```

`db:seed` 会创建初始管理员账号（来自 `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`）。

建议在迁移后立即确认 `ImageEmbedding` 表已创建：

```bash
cat > /tmp/check_image_embedding.sql <<'EOF'
SELECT COUNT(*) AS cnt
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = 'ImageEmbedding';
EOF

npx prisma db execute --file /tmp/check_image_embedding.sql --schema prisma/schema.prisma
```

若返回 `cnt=0`，可直接单独执行建表 SQL（见 `prisma/migrate.sql` 中 `CREATE TABLE IF NOT EXISTS ImageEmbedding` 段）后再重启服务。

### 6.1 音乐模块升级说明（无旧数据迁移）

当前音乐模块已切换到新架构，核心点：

- `MusicTrack` 支持多平台来源字段（网易云/QQ/酷狗/酷我/百度）。
- 播放链接改为运行时解析并缓存：`GET /api/music/:docId/play-url`。
- 专辑拆分为独立 `Album` 一等模型。
- 封面与关系独立建模：`SongCover`、`AlbumCover`、`SongAlbumRelation`、`SongInstrumentalRelation`。

本次发布策略为“直切”，明确不做旧数据迁移。执行最新 `prisma/migrate.sql` 即可。

建议迁移后快速检查关键表：

```bash
cat > /tmp/check_music_tables.sql <<'EOF'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'MusicTrack',
    'Album',
    'SongCover',
    'AlbumCover',
    'SongAlbumRelation',
    'SongInstrumentalRelation'
  )
ORDER BY table_name;
EOF

npx prisma db execute --file /tmp/check_music_tables.sql --schema prisma/schema.prisma
```

返回应包含以上 6 张表；如缺失，请重新执行一次 `prisma/migrate.sql` 并查看输出报错。

---

## 7. 构建并启动服务

```bash
cd /root/huangshifu-wiki
npm run build
NODE_ENV=production npx tsx server.ts
```

验证健康检查：

```bash
curl http://127.0.0.1:3000/api/health
```

应返回：

```json
{"status":"ok"}
```

---

## 8. 使用 PM2 守护进程（推荐）

安装并托管：

```bash
npm i -g pm2
cd /root/huangshifu-wiki
pm2 delete huangshifu-wiki || true
pm2 start "NODE_ENV=production npx tsx server.ts" --name huangshifu-wiki --cwd /root/huangshifu-wiki
pm2 save
pm2 startup systemd -u root --hp /root   # 自动创建 systemd 服务，开机自启
```

常用命令：

```bash
pm2 status
pm2 logs huangshifu-wiki
pm2 restart huangshifu-wiki --update-env
pm2 stop huangshifu-wiki
```

建议：每次更新 `.env` 后都使用 `--update-env` 重启，避免旧环境变量继续生效。

---

## 9. 配置 Nginx 反向代理

创建站点配置：`/etc/nginx/sites-available/huangshifu-wiki.conf`

```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN_OR_IP>;   # 例如：23.224.49.72 或 your-domain.com

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

## 10. 配置 HTTPS（Let's Encrypt）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

自动续期检查：

```bash
certbot renew --dry-run
```

---

## 11. 上线后验证清单

- `https://your-domain.com/api/health` 返回 `{"status":"ok"}`
- 前端可访问首页，静态资源加载正常
- 可以注册/登录
- 微信登录（`/api/auth/wechat/login`）可按预期返回
- 管理员账号可进入后台
- 图集上传可写入 `uploads/`
- 数据可写入 MariaDB

### 11.2 图集上传（中期重构版）专项验证

当前图集上传链路：

1. `POST /api/uploads/sessions` 创建上传会话
2. `POST /api/uploads/sessions/:id/files` 逐张上传并生成媒体资产（`MediaAsset`）
3. `POST /api/uploads/sessions/:id/finalize` 完成会话
4. `POST /api/galleries` 通过 `assetIds` + `uploadSessionId` 创建图集

可用以下命令做后端自测（需要先登录并保存 Cookie）：

```bash
# 0) 登录并保存 cookie
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"email":"admin@example.com","password":"请替换为管理员密码"}'

# 1) 创建上传会话
curl -X POST http://127.0.0.1:3000/api/uploads/sessions \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"maxFiles":3}'

# 假设返回 session.id=abc123

# 2) 上传图片（重复执行多次）
curl -X POST http://127.0.0.1:3000/api/uploads/sessions/abc123/files \
  -c cookie.txt -b cookie.txt \
  -F "file=@/root/test-images/1.jpg"

# 3) 完成会话
curl -X POST http://127.0.0.1:3000/api/uploads/sessions/abc123/finalize \
  -c cookie.txt -b cookie.txt

# 4) 用 assetIds 创建图集
curl -X POST http://127.0.0.1:3000/api/galleries \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{
    "title":"部署验证图集",
    "description":"中期重构链路验证",
    "tags":["deploy","gallery"],
    "uploadSessionId":"abc123",
    "assetIds":["asset_id_1","asset_id_2"]
  }'
```

验证点：

- 非图片文件上传会返回 `400`
- 超过 20MB 图片会返回 `413`
- 超过会话文件上限会返回 `400`
- 会话过期会返回 `410`
- 图集返回的图片包含 `assetId`

### 11.1 P2（微信/小程序）专项验证

开发联调（`WECHAT_LOGIN_MOCK=true`）可用以下示例：

```bash
# 1) 微信登录（mock）
curl -X POST http://127.0.0.1:3000/api/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code":"mock:demo_openid:demo_unionid","displayName":"联调用户"}'

# 2) 小程序百科列表
curl "http://127.0.0.1:3000/api/mp/wiki?category=all&page=1&limit=5"

# 3) 小程序发帖（需带登录 Cookie）
curl -X POST http://127.0.0.1:3000/api/mp/posts \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"mp联调帖","section":"music","content":"来自mp接口","tags":["mp"]}'
```

正式环境联调结束后，记得将 `WECHAT_LOGIN_MOCK` 改回 `false` 并重启：

```bash
pm2 restart huangshifu-wiki --update-env
```

### 11.3 音乐模块专项验证（新架构）

建议至少执行一次以下后端自测（管理员登录态）：

```bash
# 0) 管理员登录并保存 cookie
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"email":"admin@example.com","password":"请替换为管理员密码"}'

# 1) 解析音乐链接
curl -X POST http://127.0.0.1:3000/api/music/parse-url \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"url":"https://music.163.com/#/song?id=29764545"}'

# 2) 通过链接导入音乐（支持 selectedSongIds）
curl -X POST http://127.0.0.1:3000/api/music/import \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"url":"https://music.163.com/#/song?id=29764545","selectedSongIds":["29764545"]}'

# 3) 拉取歌曲播放链接（触发运行时解析 + 缓存）
curl "http://127.0.0.1:3000/api/music/<docId>/play-url" \
  -c cookie.txt -b cookie.txt

# 4) 查看专辑列表
curl "http://127.0.0.1:3000/api/albums" \
  -c cookie.txt -b cookie.txt
```

验证点：

- `parse-url` 可识别平台、资源类型和资源 ID。
- `import` 后 `/api/music` 可看到新增曲目。
- 重复调用 `play-url` 延迟明显降低（缓存生效）。
- `/api/albums` 可正常返回专辑分页数据和关联歌曲。

---

## 12. 语义搜图与向量任务验证

### 12.1 批量补齐待向量化队列

```bash
curl -X POST http://127.0.0.1:3000/api/embeddings/enqueue-missing \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"limit":500}'
```

### 12.2 批量生成向量

```bash
curl -X POST http://127.0.0.1:3000/api/embeddings/sync-batch \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"limit":100,"includeFailed":false}'
```

或直接用脚本（推荐）：

```bash
cd /root/huangshifu-wiki
npm run embeddings:sync -- --limit=100
```

### 12.3 查看向量状态

```bash
curl http://127.0.0.1:3000/api/embeddings/status -b cookie.txt -c cookie.txt
```

### 12.4 查看失败记录 / 重试失败任务

```bash
curl "http://127.0.0.1:3000/api/embeddings/errors?limit=20" -b cookie.txt -c cookie.txt

curl -X POST http://127.0.0.1:3000/api/embeddings/retry-failed \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"limit":100}'
```

### 12.5 语义搜图接口验证

```bash
curl -X POST http://127.0.0.1:3000/api/search/by-image \
  -b cookie.txt -c cookie.txt \
  -F "image=@/root/test-images/1.jpg" \
  -F "limit=12" \
  -F "minScore=0.2"
```

返回字段重点：

- `mode=semantic_image`
- `galleries[].similarity`
- `totalMatches` / `totalGalleries`

---

## 13. 常见问题排查

### 13.1 `API key should be set when using the Gemini API`

表示未配置 `VITE_GEMINI_API_KEY`。

- 若不需要 AI，可忽略（功能会降级）。
- 若需要 AI：补上 key 后执行：

```bash
npm run build
pm2 restart huangshifu-wiki --update-env
```

### 13.2 注册返回 `409 Conflict`（该邮箱已注册）

这是正常业务行为，说明邮箱已存在。

- 用该邮箱直接登录
- 或换新邮箱注册

### 13.3 字体加载报 CORS/被拦截

常见于浏览器扩展或网络策略拦截第三方字体资源。

- 先清浏览器缓存并强刷
- 临时禁用广告拦截/隐私插件后重试
- 本项目已使用本地字体回退，不依赖 Google Fonts 也可正常显示

### 13.4 `Access denied for user`（数据库权限问题）

- 检查 `DATABASE_URL` 用户、密码、host 是否正确
- 确认授权存在：

```sql
SHOW GRANTS FOR 'hsf_app'@'127.0.0.1';
```

### 13.5 `listen EADDRINUSE: address already in use 0.0.0.0:3000`

说明 3000 端口已被旧进程占用（常见于重复启动 PM2 进程或手动后台进程未关闭）。

```bash
pm2 delete huangshifu-wiki || true
pkill -f "tsx server.ts" || true
pm2 start "NODE_ENV=production npx tsx server.ts" --name huangshifu-wiki --cwd /root/huangshifu-wiki
pm2 save
```

### 13.6 微信登录返回 `服务器未配置微信登录参数`

表示当前是正式模式（`WECHAT_LOGIN_MOCK=false`）且未填写：

- `WECHAT_MP_APPID`
- `WECHAT_MP_APP_SECRET`

可选处理：

- 临时联调：将 `WECHAT_LOGIN_MOCK=true`，使用 `mock:openId[:unionId]`。
- 正式上线：填写真实参数并 `pm2 restart huangshifu-wiki --update-env`。

### 13.7 图集上传返回 `上传会话已过期，请重新上传`

- 提高会话有效期（分钟）：

```bash
sed -i 's/^UPLOAD_SESSION_TTL_MINUTES=.*/UPLOAD_SESSION_TTL_MINUTES="90"/' /root/huangshifu-wiki/.env
pm2 restart huangshifu-wiki --update-env
```

- 或在前端重新发起上传（推荐，避免长时间占用会话）。

### 13.8 图集上传返回 `图片地址不合法，请重新上传`

- 说明使用了旧的直传 URL 或越权 URL。
- 需要改为中期重构流程：先上传到会话，拿到 `assetIds` 后再创建图集。

### 13.9 `图片语义搜索失败`

- 检查 Qdrant 是否在线：

```bash
docker compose ps
curl http://127.0.0.1:6333/healthz
```

- 检查向量是否已生成：

```bash
curl http://127.0.0.1:3000/api/embeddings/status -b cookie.txt -c cookie.txt
```

- 若 `ready=0`，先执行：

```bash
npm run embeddings:sync -- --limit=200
```

### 13.10 向量任务慢 / CPU 占用高

- 降低单批大小：`IMAGE_EMBEDDING_BATCH_SIZE=50`
- 用 cron 分批执行，避免长时间满载
- 如有独立计算机，可通过管理接口远程触发批任务

### 13.11 `The table \`ImageEmbedding\` does not exist`（Prisma P2021）

- 先确认表是否存在：

```bash
cd /root/huangshifu-wiki
npx prisma db execute --file prisma/migrate.sql --schema prisma/schema.prisma
```

- 再查看是否仍报错：

```bash
pm2 logs huangshifu-wiki --lines 100
```

- 若历史脏数据导致外键无法补齐，当前迁移脚本会跳过 `ImageEmbedding -> GalleryImage` 外键添加，不会阻断建表和主流程。

---

## 14. 更新发布流程（后续版本）

```bash
cd /root/huangshifu-wiki
git pull
npm ci
npm run db:generate
npx prisma db execute --file prisma/migrate.sql --schema prisma/schema.prisma
npm run build
npm run embeddings:sync -- --limit=100
pm2 restart huangshifu-wiki --update-env
pm2 save
```

### 一键部署脚本（推荐）

项目已提供脚本：`scripts/deploy.sh`

首次给执行权限：

```bash
cd /root/huangshifu-wiki
chmod +x scripts/deploy.sh
```

常用用法：

```bash
# 常规部署（默认使用 pm2）
./scripts/deploy.sh

# 先 git pull 再部署
PULL_LATEST=1 ./scripts/deploy.sh

# 跳过 seed
SKIP_SEED=1 ./scripts/deploy.sh

# 不用 pm2，改用 nohup
USE_PM2=0 ./scripts/deploy.sh
```

可选环境变量：

- `APP_NAME`：pm2 进程名（默认 `huangshifu-wiki`）
- `APP_PORT`：健康检查端口（默认 `3000`）
- `ENV_FILE`：环境文件路径（默认 `.env`）
- `MIGRATION_FILE`：迁移 SQL 路径（默认 `prisma/migrate.sql`）
- `INSTALL_MODE`：依赖安装模式（`ci` 或 `install`，默认 `ci`）
- `ENABLE_VECTOR_SYNC`：部署时是否自动执行一次向量同步（默认 `1`）
- `VECTOR_SYNC_LIMIT`：部署时向量同步批次大小（默认 `100`）

---

## 15. 备份建议

数据库备份：

```bash
mysqldump -u hsf_app -p --databases huangshifu_wiki > /root/backup/huangshifu_wiki_$(date +%F).sql
```

上传文件备份：

```bash
tar -czf /root/backup/uploads_$(date +%F).tar.gz /root/huangshifu-wiki/uploads
```

建议配合 `crontab` 做每日自动备份。
