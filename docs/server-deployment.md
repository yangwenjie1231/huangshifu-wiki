# 诗扶小筑服务器部署与配置指南（PostgreSQL 18 + Qdrant）

本文档用于将当前项目部署到 Linux 服务器，并完成数据库、进程守护、反向代理、HTTPS 与向量检索相关配置。

快速结论（无旧数据迁移场景）：

- 数据库使用 PostgreSQL 18。
- 向量检索继续使用 Qdrant，不启用 pgvector。
- 数据库初始化使用 Prisma Migration：`npm run db:deploy`。
- 首次上线后执行一次 `npm run db:seed` 初始化管理员账号。

适用架构：

- 前端：Vite + React
- 后端：Express（`server.ts`）
- 数据库：Prisma + PostgreSQL 18
- 向量检索：Qdrant + CLIP（保留独立向量库，不使用 pgvector）
- 鉴权：本地账号密码 + JWT Cookie
- 微信登录：微信小程序 `code2session`（支持 mock 联调）

---

## 1. 部署前准备

建议环境：

- Debian/Ubuntu Linux
- Node.js 20+
- npm 9+
- PostgreSQL 18
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

安装 PostgreSQL 18（Debian/Ubuntu，官方仓库示例）：

```bash
apt install -y gnupg ca-certificates lsb-release
install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
apt update
apt install -y postgresql-18 postgresql-client-18
systemctl enable --now postgresql
```

---

## 2. 数据库初始化（PostgreSQL 18）

建议使用独立数据库用户，不要让应用直接使用 `postgres` 超级用户。

```bash
# 进入 postgres 账户
sudo -u postgres psql

# 执行 SQL
CREATE DATABASE huangshifu_wiki;
CREATE USER hsf_app WITH ENCRYPTED PASSWORD '请替换为强密码';
GRANT ALL PRIVILEGES ON DATABASE huangshifu_wiki TO hsf_app;
\q
```

为应用用户授予 `public` schema 权限：

```bash
sudo -u postgres psql -d huangshifu_wiki -c "GRANT ALL ON SCHEMA public TO hsf_app;"
sudo -u postgres psql -d huangshifu_wiki -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hsf_app;"
sudo -u postgres psql -d huangshifu_wiki -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hsf_app;"
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
EOF
```

说明：

- `VITE_GEMINI_API_KEY` 为空时，AI 功能会自动降级（不报致命错）。
- 修改任何 `VITE_*` 变量后都需要重新构建前端：`npm run build`。
- 小程序联调阶段可临时设置 `WECHAT_LOGIN_MOCK="true"`，用 mock code 验证闭环。
- 正式环境建议固定 `WECHAT_LOGIN_MOCK="false"`，并配置真实 `WECHAT_MP_APPID` / `WECHAT_MP_APP_SECRET`。
- `JWT_SECRET` 必须设置，否则服务无法启动。
- Cookie 的 `Secure` 标记在 HTTP 部署时会自动关闭（由 `trust proxy` + `X-Forwarded-Proto` 判断），HTTPS 部署时自动启用。如需强制覆盖，可设置 `COOKIE_SECURE=true` 或 `COOKIE_SECURE=false`。
- `UPLOAD_SESSION_TTL_MINUTES` 控制图集上传会话有效期（分钟，默认 45）。
- `QDRANT_URL` 指向本机 Qdrant 时建议保持 `http://127.0.0.1:6333`。
- `IMAGE_EMBEDDING_MODEL` 当前实现默认 `Xenova/clip-vit-base-patch32`（CPU 友好）。
- `MUSIC_PLAY_URL_CACHE_TTL_SECONDS` 控制音乐实时播放链接缓存时长（秒，默认 600，最小 60）。

---

## 5. 启动向量数据库（Qdrant）

项目根目录已包含 `docker-compose.yml`，可直接启动：

```bash
cd /root/huangshifu-wiki
docker compose up -d qdrant
docker compose ps
curl http://127.0.0.1:6333/healthz
```

若返回 `{"status":"ok"}` 说明 Qdrant 正常。

---

## 6. 初始化 Prisma 与数据库表（PostgreSQL）

本项目已改为 Prisma migration 工作流，首次部署按以下顺序执行：

```bash
cd /root/huangshifu-wiki
npm run db:generate
npm run db:deploy
npm run db:seed
```

可选：先查看 migration 状态（建议首次部署执行）：

```bash
cd /root/huangshifu-wiki
npx prisma migrate status
```

`db:seed` 会创建初始管理员账号（来自 `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`）。

建议迁移后快速检查核心表是否创建成功：

```bash
cat > /tmp/check_core_tables.sql <<'EOF'
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'User',
    'WikiPage',
    'MusicTrack',
    'Album',
    'ImageEmbedding',
    'SongCover'
  )
ORDER BY tablename;
EOF

psql "postgresql://hsf_app:请替换为强密码@127.0.0.1:5432/huangshifu_wiki" -f /tmp/check_core_tables.sql
```

返回应包含以上表名。

### 6.1 音乐模块升级说明（无旧数据迁移）

当前音乐模块已切换到新架构，核心点：

- `MusicTrack` 支持多平台来源字段（网易云/QQ/酷狗/酷我/百度）。
- 播放链接改为运行时解析并缓存：`GET /api/music/:docId/play-url`。
- 专辑拆分为独立 `Album` 一等模型。
- 封面与关系独立建模：`SongCover`、`AlbumCover`、`SongAlbumRelation`、`SongInstrumentalRelation`。

本次发布策略为“直切”，明确不做旧数据迁移。

### 6.2 首次迁移失败时的重建步骤（仅适用于无旧数据）

如果你确认数据库里没有需要保留的数据，可直接重建 `public` schema：

```bash
psql "postgresql://hsf_app:请替换为强密码@127.0.0.1:5432/huangshifu_wiki" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cd /root/huangshifu-wiki
npm run db:deploy
npm run db:seed
```

注意：此操作会清空当前数据库全部业务表。

### 6.3 帖子功能升级说明（v2.5+）

本次发布新增帖子点赞、踩、置顶功能，数据库升级步骤：

**已包含在 `db:deploy` 中，无需手动操作。**

相关数据库变更：

| 表名 | 变更类型 | 说明 |
|------|---------|------|
| `Post` | 新增列 | `dislikesCount` Int，默认 0 |
| `Post` | 新增列 | `isPinned` Boolean，默认 false |
| `PostDislike` | 新建表 | 踩记录表，防止重复踩 |

**PostDislike 表结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| postId | String | 关联帖子 ID |
| userUid | String | 踩的用户 ID |
| createdAt | DateTime | 踩的时间 |

唯一约束：`([postId, userUid])` - 同一用户对同一帖子只能踩一次。

**API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/posts/:id/dislike` | POST | 踩（toggle） | 登录用户 |
| `/api/posts/:id/dislike` | DELETE | 取消踩 | 登录用户 |
| `/api/posts/:id/pin` | POST | 置顶 | 管理员 |
| `/api/posts/:id/pin` | DELETE | 取消置顶 | 管理员 |

### 6.4 音乐乐评功能说明（v2.6+）

本次发布新增音乐乐评功能，支持在歌曲/专辑下发帖并自动归类到乐评区。

**数据库变更（已包含在 `db:deploy` 中）：**

| 表名 | 变更类型 | 说明 |
|------|---------|------|
| `Post` | 新增列 | `musicDocId` String，可选，关联歌曲 docId |
| `Post` | 新增列 | `albumDocId` String，可选，关联专辑 docId |
| `Post` | 新增索引 | `musicDocId + updatedAt` 复合索引 |
| `Post` | 新增索引 | `albumDocId + updatedAt` 复合索引 |
| `MusicTrack` | 新增关系 | `posts Post[]` 反向关联 |
| `Album` | 新增关系 | `posts Post[]` 反向关联 |

**API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/music/:docId/posts` | GET | 获取歌曲关联帖子 | 公开 |
| `/api/albums/:id/posts` | GET | 获取专辑关联帖子 | 公开 |
| `/api/posts` | POST | 创建帖子（新增 `musicDocId`/`albumDocId` 参数） | 登录用户 |

**前端变更：**

- 音乐馆页面每首歌曲新增「乐评」按钮
- 点击展开该歌曲的乐评列表
- 支持从音乐馆直接跳转发帖（自动关联歌曲）
- 发帖页面根据 URL 参数自动选择「音乐讨论」板块并填充内容模板

**使用流程：**

1. 用户在音乐馆点击歌曲的「乐评」按钮
2. 展开该歌曲的乐评列表
3. 点击「发表乐评」跳转到发帖页面，自动填充歌曲信息
4. 提交后帖子自动归类到「音乐讨论」板块，并关联对应歌曲

### 6.5 站内内链与音乐详情页说明（v2.8+）

本次发布新增统一「复制内链」能力，并补充歌曲详情页路由，便于站内互相引用。

**数据库变更：**

- 无新增表、无字段变更。
- 你已确认当前为“无旧数据迁移”场景，本次无需额外迁移操作。

**前端路由变更：**

| 路由 | 页面 | 用途 |
|------|------|------|
| `/music/:songId` | 音乐详情页 | 直接打开具体歌曲，展示歌词与关联乐评 |
| `/album/:albumId` | 专辑详情页 | 专辑头部支持一键复制专辑内链 |

**后端 API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/music/:docId` | GET | 获取歌曲详情（支持 docId 与平台 id 查询） | 公开 |

**内链按钮覆盖范围：**

- 帖子列表卡片：复制 `/forum/:postId`
- 歌曲列表项：复制 `/music/:songId`
- 专辑详情页：复制 `/album/:albumId`
- 图集卡片：复制 `/gallery/:galleryId`
- 百科卡片与百科详情页：复制 `/wiki/:slug`

**实现细节：**

- 复制行为统一封装到 `src/lib/copyLink.ts`
- 提示方式统一为顶部 Toast（不再弹浏览器 `alert`）
- 入口由 `src/components/Toast.tsx` 提供，并在 `src/main.tsx` 全局挂载

### 6.6 编辑锁与图集发布流说明（v2.9+）

本次发布补齐后台协作与图集生命周期能力，且你已确认当前为"无旧数据迁移"场景，可直接按当前流程部署。

**数据库变更（已包含在 `db:deploy` 中）：**

| 表名 | 变更类型 | 说明 |
|------|---------|------|
| `Gallery` | 新增列 | `published` Boolean，默认 `false` |
| `Gallery` | 新增列 | `publishedAt` DateTime，可空 |
| `Gallery` | 新增索引 | `published + updatedAt` 复合索引 |
| `EditLock` | 新建表 | 记录级编辑锁（collection + recordId 唯一） |

**后端 API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/galleries/:id` | PATCH | 更新图集标题/描述/标签 | 作者或管理员 |
| `/api/galleries/:id/publish` | PATCH | 发布/取消发布图集 | 作者或管理员 |
| `/api/galleries/:id/images` | POST | 追加图片（基于 UploadSession + assetIds） | 作者或管理员 |
| `/api/galleries/:id/images/:imageId` | DELETE | 删除单张图片（至少保留一张） | 作者或管理员 |
| `/api/galleries/:id/images/reorder` | PATCH | 批量重排图片 | 作者或管理员 |
| `/api/admin/locks` | POST | 申请编辑锁（支持续期、管理员强制接管） | 登录用户 |
| `/api/admin/locks/:id/renew` | PATCH | 编辑锁续期 | 锁持有者或管理员 |
| `/api/admin/locks` | GET | 编辑锁列表 | 管理员 |
| `/api/admin/locks/:id` | DELETE | 释放编辑锁 | 锁持有者或管理员 |
| `/api/admin/locks/:collection/:recordId` | DELETE | 强制释放指定记录锁 | 管理员 |

**图集访问策略更新：**

- `GET /api/galleries`：游客仅返回已发布图集；作者可见自己的草稿；管理员可见全部。
- `GET /api/galleries/:id`：未发布图集仅作者和管理员可见。

### 6.7 Wiki 分支协作与 PR 审核说明（v3.0+）

本次发布补齐 Wiki 的多人协作工作流，支持"分支编辑 -> 提交 PR -> 管理员审核合并/驳回 -> 冲突修复"。

**数据库变更（已包含在 `db:deploy` 中）：**

- `WikiBranch`
- `WikiPullRequest`
- `WikiPullRequestComment`
- `WikiRevision.branchId`（用于分支修订链）
- `WikiPage.mainBranchId`、`WikiPage.mergedAt`

无旧数据迁移场景下，直接执行 `npm run db:deploy` 即可。

**后端 API（协作主链路）：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/wiki/:slug/branches` | POST | 创建当前用户分支 | 登录用户 |
| `/api/wiki/:slug/branches` | GET | 查看页面分支列表 | 登录用户 |
| `/api/wiki/branches/mine` | GET | 查看我的分支 | 登录用户 |
| `/api/wiki/branches/:branchId` | GET | 查看分支详情 + latestRevision | 登录用户 |
| `/api/wiki/branches/:branchId/revisions` | GET | 查看分支修订历史 | 登录用户 |
| `/api/wiki/branches/:branchId/revisions` | POST | 保存分支修订 | 分支作者/管理员 |
| `/api/wiki/branches/:branchId/pull-request` | POST | 提交 PR | 分支作者/管理员 |
| `/api/wiki/pull-requests/list` | GET | PR 列表（管理员看全部，普通用户看自己） | 登录用户 |
| `/api/wiki/pull-requests/:prId` | GET | PR 详情（含评论） | 登录用户 |
| `/api/wiki/pull-requests/:prId/diff` | GET | PR Diff（base/head） | 登录用户 |
| `/api/wiki/pull-requests/:prId/comments` | POST | PR 评论 | 登录用户 |
| `/api/wiki/pull-requests/:prId/merge` | POST | 合并 PR | 管理员 |
| `/api/wiki/pull-requests/:prId/reject` | POST | 驳回 PR | 管理员 |
| `/api/wiki/branches/:branchId/resolve-conflict` | POST | 解决冲突并重开分支流转 | 分支作者/管理员 |

**前端路由（v3.0+）：**

| 路由 | 页面 | 用途 |
|------|------|------|
| `/wiki/:slug/branches` | 分支工作台 | 创建分支、保存修订、发起 PR |
| `/wiki/:slug/prs` | PR 列表 | 按状态查看 PR |
| `/wiki/:slug/prs/:prId` | PR 详情 | 查看 diff、评论、管理员审核 |

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
pm2 startup systemd -u root --hp /root
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
- 数据可写入 PostgreSQL

### 11.1 帖子功能验证（v2.5+）

帖子点赞、踩、置顶功能验证：

```bash
# 创建测试帖子（需先登录）
curl -X POST http://127.0.0.1:3000/api/posts \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"测试帖子","section":"general","content":"内容"}'

# 点赞帖子
curl -X POST http://127.0.0.1:3000/api/posts/<帖子ID>/like \
  -b cookie.txt -c cookie.txt

# 踩帖子
curl -X POST http://127.0.0.1:3000/api/posts/<帖子ID>/dislike \
  -b cookie.txt -c cookie.txt

# 置顶帖子（仅管理员）
curl -X POST http://127.0.0.1:3000/api/posts/<帖子ID>/pin \
  -b cookie.txt -c cookie.txt

# 取消置顶（仅管理员）
curl -X DELETE http://127.0.0.1:3000/api/posts/<帖子ID>/pin \
  -b cookie.txt -c cookie.txt
```

验证点：
- 重复点赞/踩会自动切换状态（toggle）
- 同一用户对同一帖子只能踩一次（`PostDislike` 表唯一约束）
- 非管理员调用置顶 API 返回 403
- 帖子列表默认按置顶优先排序

### 11.2 图集上传链路专项验证

### 11.1 图集上传链路专项验证

当前图集上传链路：

1. `POST /api/uploads/sessions` 创建上传会话
2. `POST /api/uploads/sessions/:id/files` 逐张上传并生成媒体资产（`MediaAsset`）
3. `POST /api/uploads/sessions/:id/finalize` 完成会话
4. `POST /api/galleries` 通过 `assetIds` + `uploadSessionId` 创建图集

可用以下命令做后端自测（需要先登录并保存 Cookie）：

```bash
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"email":"admin@example.com","password":"请替换为管理员密码"}'

curl -X POST http://127.0.0.1:3000/api/uploads/sessions \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"maxFiles":3}'
```

验证点：

- 非图片文件上传会返回 `400`
- 超过 20MB 图片会返回 `413`
- 超过会话文件上限会返回 `400`
- 会话过期会返回 `410`
- 图集返回的图片包含 `assetId`

### 11.2 向量任务与语义搜图验证

```bash
curl -X POST http://127.0.0.1:3000/api/embeddings/enqueue-missing \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"limit":500}'

curl -X POST http://127.0.0.1:3000/api/embeddings/sync-batch \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"limit":100,"includeFailed":false}'

curl http://127.0.0.1:3000/api/embeddings/status -b cookie.txt -c cookie.txt

curl -X POST http://127.0.0.1:3000/api/search/by-image \
  -b cookie.txt -c cookie.txt \
  -F "image=@/root/test-images/1.jpg" \
  -F "limit=12" \
  -F "minScore=0.2"
```

### 11.3 头像上传功能验证（v2.7+）

本次发布新增用户头像上传功能，支持图片裁剪。

**API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/users/me/avatar` | POST | 上传并设置头像 | 登录用户 |

**请求格式：**

- `Content-Type: multipart/form-data`
- 表单字段：`file`（图片文件）

**响应格式：**

```json
{
  "photoURL": "/uploads/xxx.jpg",
  "asset": {
    "assetId": "xxx",
    "storageKey": "xxx",
    "mimeType": "image/jpeg",
    "sizeBytes": 12345,
    "url": "/uploads/xxx.jpg"
  }
}
```

**验证命令：**

```bash
# 先登录
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"email":"admin@example.com","password":"请替换为管理员密码"}'

# 上传头像
curl -X POST http://127.0.0.1:3000/api/users/me/avatar \
  -b cookie.txt -c cookie.txt \
  -F "file=@/root/test-avatar.jpg"
```

**验证点：**

- 仅支持 JPG、PNG、WEBP、GIF、BMP 格式
- 文件大小限制：20MB
- 非图片文件返回 `400`
- 上传成功后 `User.photoURL` 更新为新头像 URL
- 头像存储为 `MediaAsset`，可通过媒体库统一管理

### 11.4 站内内链与音乐详情页验证（v2.8+）

#### 11.4.1 路由与页面验证

1. 访问音乐详情页：`https://your-domain.com/music/<songDocId>`
2. 访问专辑详情页：`https://your-domain.com/album/<albumDocId>`
3. 预期：
   - 页面正常渲染，不出现白屏
   - 歌曲详情可看到歌词区与关联乐评区
   - 专辑详情页头部显示「复制内链」按钮

可选后端自测：

```bash
# 通过 docId 获取歌曲详情
curl http://127.0.0.1:3000/api/music/<songDocId>

# 通过平台歌曲 id 获取歌曲详情（兼容）
curl http://127.0.0.1:3000/api/music/<platformSongId>
```

#### 11.4.2 内链复制验证

在以下页面点击「复制内链」图标/按钮，并粘贴到任意输入框确认结果：

1. 论坛列表页（帖子卡片）
2. 音乐馆列表页（歌曲行）
3. 专辑详情页（头部操作区）
4. 图集列表页（图集卡片）
5. 百科列表页与百科详情页

预期：

- 点击后页面顶部出现 Toast 成功提示
- 粘贴内容为完整站内 URL（含域名）
- 链接可在新标签页直接打开对应内容
- 在移动端和桌面端都可触发复制逻辑

### 11.5 编辑锁与图集发布流验证（v2.9+）

#### 11.5.1 图集发布流验证

```bash
# 1) 获取图集列表（游客只会看到已发布图集）
curl http://127.0.0.1:3000/api/galleries

# 2) 切换发布状态（需登录，作者或管理员）
curl -X PATCH http://127.0.0.1:3000/api/galleries/<galleryId>/publish \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"published":true}'

# 3) 更新图集基础信息
curl -X PATCH http://127.0.0.1:3000/api/galleries/<galleryId> \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"新标题","description":"新描述","tags":["Live","2026"]}'

# 4) 图片重排（imageIds 需来自图集详情返回）
curl -X PATCH http://127.0.0.1:3000/api/galleries/<galleryId>/images/reorder \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"imageIds":["<imageId1>","<imageId2>","<imageId3>"]}'
```

验证点：

- 游客访问未发布图集详情返回 `403`。
- 作者与管理员可访问未发布图集并可执行编辑/发布操作。
- 删除图片时，图集至少保留 1 张图片。

#### 11.5.2 编辑锁验证

```bash
# 1) 申请编辑锁
curl -X POST http://127.0.0.1:3000/api/admin/locks \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"collection":"galleries","recordId":"<galleryId>","ttlMinutes":15}'

# 2) 续期编辑锁
curl -X PATCH http://127.0.0.1:3000/api/admin/locks/<lockId>/renew \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"ttlMinutes":30}'

# 3) 管理员查看锁列表
curl http://127.0.0.1:3000/api/admin/locks -b cookie.txt -c cookie.txt

# 4) 管理员强制释放指定记录锁
curl -X DELETE http://127.0.0.1:3000/api/admin/locks/galleries/<galleryId> \
  -b cookie.txt -c cookie.txt
```

验证点：

- 同一记录重复申请锁时，非持有者返回 `409` 并包含锁信息。
- 管理员在 `force=true` 时可以接管非本人锁。
- 过期锁会被自动清理，不会长期阻塞编辑。

### 11.6 Wiki 分支协作与 PR 验证（v3.0+）

#### 11.6.1 分支创建与修订保存

```bash
# 1) 创建页面分支
curl -X POST http://127.0.0.1:3000/api/wiki/<slug>/branches \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt

# 2) 查询我的分支
curl http://127.0.0.1:3000/api/wiki/branches/mine -b cookie.txt -c cookie.txt

# 3) 保存分支修订
curl -X POST http://127.0.0.1:3000/api/wiki/branches/<branchId>/revisions \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"标题","category":"biography","content":"更新内容","tags":["tag1"]}'
```

#### 11.6.2 PR 提交、评审与合并

```bash
# 1) 提交 PR
curl -X POST http://127.0.0.1:3000/api/wiki/branches/<branchId>/pull-request \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"更新 XXX","description":"补充内容"}'

# 2) 查看 PR 列表
curl "http://127.0.0.1:3000/api/wiki/pull-requests/list?status=open" -b cookie.txt -c cookie.txt

# 3) 查看 PR diff
curl http://127.0.0.1:3000/api/wiki/pull-requests/<prId>/diff -b cookie.txt -c cookie.txt

# 4) 管理员合并 PR
curl -X POST http://127.0.0.1:3000/api/wiki/pull-requests/<prId>/merge \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt
```

验证点：

- 普通用户只能查看/操作自己的分支与 PR（管理员例外）。
- PR 合并后，`WikiPage` 正文与状态更新为最新分支内容，分支状态变为 `merged`。
- base revision 失配时返回 `409`，分支状态进入 `conflict`，可通过 `resolve-conflict` 恢复流程。

---

## 12. 常见问题排查

### 12.1 `API key should be set when using the Gemini API`

表示未配置 `VITE_GEMINI_API_KEY`。

- 若不需要 AI，可忽略（功能会降级）。
- 若需要 AI：补上 key 后执行：

```bash
npm run build
pm2 restart huangshifu-wiki --update-env
```

### 12.2 PostgreSQL 连接失败

- 检查 `DATABASE_URL` 用户、密码、host、端口是否正确。
- 检查数据库服务状态：`systemctl status postgresql`。
- 确认用户可登录：

```bash
psql "postgresql://hsf_app:请替换为强密码@127.0.0.1:5432/huangshifu_wiki" -c "SELECT 1;"
```

- 若报 `P1000 Authentication failed`：

```bash
sudo -u postgres psql -c "ALTER USER hsf_app WITH ENCRYPTED PASSWORD '请替换为强密码';"
```

- 若是远程数据库，还需检查 `postgresql.conf` 的 `listen_addresses` 和 `pg_hba.conf` 放行规则。

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

- 检查 Qdrant 是否在线：

```bash
docker compose ps
curl http://127.0.0.1:6333/healthz
```

- 检查向量是否已生成：

```bash
curl http://127.0.0.1:3000/api/embeddings/status -b cookie.txt -c cookie.txt
```

---

## 13. 更新发布流程（后续版本）

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

发布后建议补一条数据库状态检查：

```bash
npx prisma migrate status
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
./scripts/deploy.sh
PULL_LATEST=1 ./scripts/deploy.sh
SKIP_SEED=1 ./scripts/deploy.sh
USE_PM2=0 ./scripts/deploy.sh
```

可选环境变量：

- `APP_NAME`：pm2 进程名（默认 `huangshifu-wiki`）
- `APP_PORT`：健康检查端口（默认 `3000`）
- `ENV_FILE`：环境文件路径（默认 `.env`）
- `INSTALL_MODE`：依赖安装模式（`ci` 或 `install`，默认 `ci`）
- `ENABLE_VECTOR_SYNC`：部署时是否自动执行一次向量同步（默认 `1`）
- `VECTOR_SYNC_LIMIT`：部署时向量同步批次大小（默认 `100`）

---

## 14. 备份建议

数据库备份（PostgreSQL）：

```bash
pg_dump "postgresql://hsf_app:请替换为强密码@127.0.0.1:5432/huangshifu_wiki" > /root/backup/huangshifu_wiki_$(date +%F).sql
```

上传文件备份：

```bash
tar -czf /root/backup/uploads_$(date +%F).tar.gz /root/huangshifu-wiki/uploads
```

建议配合 `crontab` 做每日自动备份。
