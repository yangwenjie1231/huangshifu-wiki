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

## 16. 中期重构版（v4）上线记录

### 16.1 本次范围

- Wiki / Gallery / Admin 页面前端数据访问已统一走 REST API。
- 音乐全局播放器增强：歌词同步、音量控制、随机播放、循环模式、播放历史。
- Wiki 接口补充兼容路由：`GET /api/wiki/:slug/revisions`（与 `history` 同内容）。
- Wiki 管理删除能力补齐：`DELETE /api/wiki/:slug`（管理员）。

### 16.2 部署命令（无旧数据迁移）

```bash
cd /root/huangshifu-wiki
chmod +x scripts/deploy.sh
SKIP_SEED=1 ./scripts/deploy.sh

# 验证
curl http://127.0.0.1:3000/api/health
pm2 status
```

### 16.3 接口验证清单

```bash
# Wiki 列表 / 详情 / 历史
curl "http://127.0.0.1:3000/api/wiki?category=all"
curl "http://127.0.0.1:3000/api/wiki/<slug>"
curl "http://127.0.0.1:3000/api/wiki/<slug>/history"
curl "http://127.0.0.1:3000/api/wiki/<slug>/revisions"

# 管理能力（需管理员 cookie）
curl "http://127.0.0.1:3000/api/admin/wiki" -b cookie.txt -c cookie.txt
curl -X DELETE "http://127.0.0.1:3000/api/wiki/<slug>" -b cookie.txt -c cookie.txt
curl "http://127.0.0.1:3000/api/admin/galleries" -b cookie.txt -c cookie.txt
curl "http://127.0.0.1:3000/api/admin/users" -b cookie.txt -c cookie.txt
```

### 16.4 前端回归验证点

1. Wiki 页面：列表、详情、编辑、历史、回滚、收藏、提交审核均可用。
2. Gallery 页面：图集列表正常，上传后可立即看到新图集。
3. Admin 页面：审核队列、公告/版块管理、用户封禁与角色管理、内容删除可用。
4. 音乐播放器：
   - 歌词自动高亮；
   - 音量可调；
   - 随机模式可切换；
   - 循环模式可在不循环/列表循环/单曲循环间切换；
   - 历史列表可回播。

### 16.5 v4.1 继续迁移（Music 页面）

- `src/pages/Music.tsx` 已完成从 `../firebase` 直连迁移为 REST：
  - 列表读取：`GET /api/music`
  - 收藏切换：`POST /api/favorites`、`DELETE /api/favorites/music/:id`
  - 删除歌曲：`DELETE /api/music/:docId`
  - 专辑入口：`GET /api/albums`（页面内展示并跳转 `/albums/:id`）
  - 网易云快捷添加：`POST /api/music/from-netease`
- 批量删除、单曲删除、播放列表联动（`setPlaylist` / `playSongAtIndex`）均已保持。
- 本地验证结果：
  - `npm run lint` 通过；
  - `npm run build` 通过（仅保留 Vite 大包体积 warning，不阻断部署）。

### 16.6 v4.1 部署执行与排障记录

- 已使用上传脚本 `tmp_remote_sync_deploy.py` 进行自动上传 + 执行 `SKIP_SEED=1 ./scripts/deploy.sh`。
- 首轮失败原因：远端缺少 `src/server/music/metingService.ts`，PM2 日志报 `ERR_MODULE_NOT_FOUND`。
- 已修复脚本上传清单，确保同时上传：
  - `src/server/music/musicUrlParser.ts`
  - `src/server/music/metingService.ts`
- 脚本补充了目录自动创建与上传重试机制（规避偶发 SFTP size mismatch）。
- 若远端再次出现 SSH banner 超时（`Error reading SSH protocol banner`），可在服务器重启后重试：

```bash
cd /root/huangshifu-wiki
chmod +x scripts/deploy.sh
SKIP_SEED=1 ./scripts/deploy.sh

# 验证
pm2 status
pm2 logs huangshifu-wiki --lines 120 --nostream
curl http://127.0.0.1:3000/api/health
```

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

---

## 17. 音乐导入功能（v5）

### 17.1 功能概述

支持从 5 个音乐平台导入歌曲、专辑、歌单：

- 网易云音乐（netease）
- QQ 音乐（tencent）
- 酷狗音乐（kugou）
- 百度音乐（baidu）
- 酷我音乐（kuwo）

**仅管理员可用**。用户粘贴链接后，系统自动解析并展示资源预览，支持选择性导入。

### 17.2 数据库变更

本次更新新增 2 张表、扩展 `MusicTrack` 2 个字段：

- `Playlist`：存储专辑/歌单元数据（标题、封面、平台来源等）
- `PlaylistTrack`：存储专辑/歌单与歌曲的多对多关系
- `MusicTrack.sourcePlatform`：歌曲来源平台（如 `netease`）
- `MusicTrack.sourceUrl`：歌曲原始页面链接

迁移已包含在 `prisma/migrate.sql`，执行部署时会自动创建。

### 17.3 核心 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `POST` | `/api/music/parse-url` | 解析音乐链接，返回预览 | 管理员 |
| `POST` | `/api/music/import` | 导入歌曲/专辑/歌单 | 管理员 |
| `GET` | `/api/albums` | 获取专辑列表 | 公开 |
| `GET` | `/api/albums/:id` | 获取专辑详情（含歌曲） | 公开 |
| `GET` | `/api/playlists` | 获取歌单列表 | 公开 |
| `POST` | `/api/playlists` | 创建歌单 | 管理员 |
| `PATCH` | `/api/playlists/:docId` | 更新歌单 | 管理员 |
| `DELETE` | `/api/playlists/:docId` | 删除歌单 | 管理员 |

### 17.4 导入 API 用法示例

```bash
# 1) 解析链接（支持歌曲/专辑/歌单）
curl -X POST http://127.0.0.1:3000/api/music/parse-url \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"url":"https://music.163.com/#/album?id=123456"}'

# 返回预览：{ resource: { title, artist, cover, platform, type, songs: [...] } }

# 2) 导入全部歌曲
curl -X POST http://127.0.0.1:3000/api/music/import \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"url":"https://music.163.com/#/album?id=123456"}'

# 3) 选择性导入（只导入指定歌曲）
curl -X POST http://127.0.0.1:3000/api/music/import \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"url":"https://music.163.com/#/playlist?id=123456","selectedSongIds":["song_id_1","song_id_2"]}'

# 返回：{ summary: { imported, skipped, failed }, songs: [...], collection: {...} }
```

### 17.5 平台 URL 示例

```
# 网易云音乐
https://music.163.com/#/song?id=123456
https://music.163.com/#/album?id=123456
https://music.163.com/#/playlist?id=123456

# QQ 音乐
https://y.qq.com/n/ryqq/playlist/123456
https://y.qq.com/n/ryqq/album/123456

# 酷狗音乐
https://www.kugou.com/yy/single/123456.html

# 百度音乐
https://music.baidu.com/song/123456

# 酷我音乐
https://www.kuwo.cn/play_detail/123456
```

### 17.6 部署验证清单

```bash
# 健康检查
curl http://127.0.0.1:3000/api/health

# 专辑列表（无需登录）
curl "http://127.0.0.1:3000/api/albums"

# 专辑详情（含歌曲）
curl "http://127.0.0.1:3000/api/albums/<album_doc_id>?includeTracks=true"

# 歌单列表
curl "http://127.0.0.1:3000/api/playlists"
```

---

## 18. P0 增量（v6）上线记录：编辑锁 + 图集发布流

### 18.1 本次范围

- 新增 **编辑锁 API**（记录级并发编辑保护）：
  - `POST /api/admin/locks` 申请/接管锁
  - `PATCH /api/admin/locks/:id/renew` 锁续期
  - `DELETE /api/admin/locks/:id` 释放锁
  - `DELETE /api/admin/locks/:collection/:recordId` 管理员强制解锁
  - 管理后台 `Admin` 新增 `编辑锁` tab（通过 `/api/admin/locks` 数据源展示）
- 新增 **图集发布流与存量编辑 API**：
  - `PATCH /api/galleries/:id` 更新图集基础信息
  - `PATCH /api/galleries/:id/publish` 发布/取消发布
  - `POST /api/galleries/:id/images` 为已有图集追加图片（使用 `assetIds`）
  - `DELETE /api/galleries/:id/images/:imageId` 删除图集图片
  - `PATCH /api/galleries/:id/images/reorder` 批量重排
- 调整图集前台可见性：
  - `GET /api/galleries`：游客仅看 `published=true`
  - `GET /api/galleries/:id`：未发布图集仅作者/管理员可见

### 18.2 数据库变更

本次变更已写入 `prisma/schema.prisma` 和 `prisma/migrate.sql`：

- 新增表：`EditLock`
  - 唯一键：`(collection, recordId)`
  - 索引：`userId`, `expiresAt`
- 扩展表：`Gallery`
  - 新增字段：`published`（默认 true）、`publishedAt`
  - 新增索引：`(published, updatedAt)`

### 18.3 新增环境变量

```env
EDIT_LOCK_TTL_MINUTES="20"
```

- 可选项，默认值 `20`
- 控制编辑锁过期时间（分钟）

### 18.4 部署命令（无旧数据迁移）

```bash
cd /root/huangshifu-wiki
chmod +x scripts/deploy.sh
SKIP_SEED=1 ./scripts/deploy.sh

# 验证
curl http://127.0.0.1:3000/api/health
pm2 status
```

> 如果是全新数据库首次部署，且还没有管理员账号，可仅首次改为 `SKIP_SEED=0` 初始化管理员；后续继续使用 `SKIP_SEED=1`。

### 18.5 接口验证（编辑锁）

```bash
# 0) 登录管理员并保存 cookie
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"email":"admin@example.com","password":"请替换为管理员密码"}'

# 1) 申请锁
curl -X POST http://127.0.0.1:3000/api/admin/locks \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"collection":"galleries","recordId":"demo-gallery-id"}'

# 2) 查看锁列表（管理后台数据源）
curl "http://127.0.0.1:3000/api/admin/locks" -b cookie.txt -c cookie.txt

# 3) 续期锁（将 <lock_id> 替换为上一步返回值）
curl -X PATCH "http://127.0.0.1:3000/api/admin/locks/<lock_id>/renew" \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt

# 4) 释放锁
curl -X DELETE "http://127.0.0.1:3000/api/admin/locks/<lock_id>" -b cookie.txt -c cookie.txt
```

### 18.6 接口验证（图集发布流）

```bash
# 前置：先按既有上传会话流程创建图集，得到 <gallery_id>

# 1) 更新图集基础信息
curl -X PATCH "http://127.0.0.1:3000/api/galleries/<gallery_id>" \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"部署验证图集-已编辑","description":"更新描述","tags":["deploy","edit"]}'

# 2) 设置为草稿（未发布）
curl -X PATCH "http://127.0.0.1:3000/api/galleries/<gallery_id>/publish" \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"published":false}'

# 3) 游客访问应不可见（404）
curl -i "http://127.0.0.1:3000/api/galleries/<gallery_id>"

# 4) 重新发布
curl -X PATCH "http://127.0.0.1:3000/api/galleries/<gallery_id>/publish" \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"published":true}'
```

### 18.7 本地回归结果

- `npm run lint` 通过
- `npm run build` 通过（仅保留 Vite chunk size warning，不阻断部署）
