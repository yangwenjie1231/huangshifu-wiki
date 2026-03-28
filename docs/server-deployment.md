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

## 安全机制说明

### 1. 认证令牌安全存储
- 所有认证令牌（JWT）均通过 `httpOnly` Cookie 存储，不存储在 `localStorage`
- Cookie 配置：`httpOnly: true`, `sameSite: 'lax'`, `secure: true`（生产环境）
- 有效期：7 天
- 这有效防止了 XSS 攻击导致令牌被窃取的风险

### 2. 内容安全与 XSS 防护
- Wiki 和论坛内容使用 `rehype-sanitize` 进行 HTML 清理
- 默认阻止危险元素：`<script>`, `<form>`, `<object>`, `<embed>` 等
- 阻止事件处理器：`onclick`, `onerror`, `onload` 等
- 阻止危险协议：`javascript:`, `data:`, `vbscript:`

### 3. 安全嵌入平台白名单
系统支持以下平台的视频/音乐嵌入（需通过域名白名单验证）：

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

详细嵌入说明见 `docs/supported-embed-platforms.md`

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
# Debian 推荐直接安装 docker.io
apt install -y docker.io
systemctl enable --now docker

# 验证安装（新版 Docker 已内置 docker compose v2 命令）
docker --version
docker compose version
```

> **注意**：Debian 官方源的 `docker.io` 包可用，但不含 `docker-compose-plugin`。Docker v2+ 已内置 `docker compose` 命令（注意是空格不是横杠），无需单独安装 compose 插件。若需要 `docker-compose` 传统命令，可通过 `npm install -g docker-compose` 安装。

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

### 6.3.1 Wiki 点赞/踩/置顶功能说明（v3.x+）

本次发布新增 Wiki 页面点赞、踩、置顶功能，与帖子功能保持一致的交互体验。

**数据库变更（已包含在 `db:deploy` 中）：**

| 表名 | 变更类型 | 说明 |
|------|---------|------|
| `WikiPage` | 新增列 | `likesCount` Int，默认 0 |
| `WikiPage` | 新增列 | `dislikesCount` Int，默认 0 |
| `WikiPage` | 新增列 | `isPinned` Boolean，默认 false |
| `WikiLike` | 新建表 | 点赞记录表，防止重复点赞 |
| `WikiDislike` | 新建表 | 踩记录表，防止重复踩 |

**WikiLike 表结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| pageSlug | String | 关联 Wiki 页面 slug |
| userUid | String | 点赞的用户 ID |
| createdAt | DateTime | 点赞的时间 |

唯一约束：`([pageSlug, userUid])` - 同一用户对同一页面只能点赞一次。

**WikiDislike 表结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| pageSlug | String | 关联 Wiki 页面 slug |
| userUid | String | 踩的用户 ID |
| createdAt | DateTime | 踩的时间 |

唯一约束：`([pageSlug, userUid])` - 同一用户对同一页面只能踩一次。

**API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/wiki/:slug/like` | POST | 点赞（toggle） | 登录用户 |
| `/api/wiki/:slug/like` | DELETE | 取消点赞 | 登录用户 |
| `/api/wiki/:slug/dislike` | POST | 踩（toggle） | 登录用户 |
| `/api/wiki/:slug/dislike` | DELETE | 取消踩 | 登录用户 |
| `/api/wiki/:slug/pin` | POST | 置顶 | 管理员 |
| `/api/wiki/:slug/pin` | DELETE | 取消置顶 | 管理员 |

**前端变更：**

- Wiki 列表页每个卡片显示点赞数、踩数
- 置顶的页面卡片左侧显示绿色边框和"已置顶"标签
- Wiki 详情页顶部操作栏新增：
  - 点赞按钮（红色图标，点击切换状态）
  - 踩按钮（橙色图标，点击切换状态）
  - 置顶按钮（仅管理员可见，点击切换状态）
- 置顶的页面详情页状态区显示"已置顶"标签

**排序逻辑：**

- Wiki 列表按 `isPinned` 降序、`updatedAt` 降序排序
- 置顶页面始终排在列表最前面

**验证点：**

- 同一用户对同一页面只能点赞或踩一次（互斥）
- 重复点赞会自动切换为取消点赞
- 重复踩会自动切换为取消踩
- 点赞和踩互斥（点赞后再踩会取消点赞）
- 非管理员调用置顶 API 返回 403
- Wiki 列表默认按置顶优先排序
- 置顶页面在列表卡片左侧有绿色边框和"已置顶"标签

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

### 6.8 音乐馆双栏目改版说明（v3.2+）

本次发布为音乐馆首页交互升级：在同一页面内新增「音乐」「专辑」两个栏目切换。

你已确认当前为“无旧数据迁移”场景，本次发布**无需执行任何数据库迁移**。

**数据库变更：**

- 无新增表、无字段变更。
- 现有 `MusicTrack`、`Album`、`SongAlbumRelation` 结构保持不变。

**前端变更：**

- `src/pages/Music.tsx` 新增 Tab 切换：
  - 「音乐」：卡片式歌曲网格，支持直接播放与跳转详情页。
  - 「专辑」：专辑封面网格，支持跳转专辑详情页。
- 保留右侧「正在播放」区域与全局播放器联动能力。

**后端依赖 API（已存在，无需新增接口）：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/albums` | GET | 获取专辑列表（用于“专辑”栏目） | 公开 |
| `/api/music/:docId/play-url` | GET | 获取歌曲播放地址 | 公开 |
| `/api/music/:docId` | GET | 获取歌曲详情页数据 | 公开 |


### 6.9 搜索功能扩展至音乐与专辑（v3.x）

本次发布扩展搜索范围，新增对音乐曲目和专辑的全文搜索支持。

**数据库变更：**

- 无新增表、无字段变更。
- 搜索基于现有 `MusicTrack` 和 `Album` 表，无需迁移。

**后端 API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/search` | GET | 新增 `music` 和 `albums` 类型搜索支持 | 公开 |
| `/api/search/suggest` | GET | 新增音乐/专辑建议（返回 `music` / `album` 类型） | 公开 |

**搜索字段说明：**

| 内容类型 | 搜索字段 |
|---------|---------|
| 音乐曲目 | `title`、`artist`、`album`、`lyric` |
| 专辑 | `title`、`artist`、`description` |

**前端变更：**

- 搜索页面新增「音乐」和「专辑」内容类型筛选
- 搜索结果新增「音乐曲目」和「音乐专辑」Tab
- 搜索建议下拉框支持音乐/专辑建议项点击跳转

### 6.10 歌曲/专辑封面管理与专辑 CRUD（v3.x）

本次发布新增歌曲封面管理、专辑创建/编辑、专辑封面管理功能，以及管理员后台的向量 Embeddings 管理面板。

**数据库变更：**

- 无新增表、无字段变更。
- 封面管理使用现有的 `SongCover`、`AlbumCover` 表。

**后端 API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `PATCH /api/music/:docId` | PATCH | 编辑歌曲信息 | 管理员 |
| `GET /api/music/:docId/covers` | GET | 获取歌曲封面列表 | 公开 |
| `POST /api/music/:docId/covers` | POST | 上传歌曲封面 | 管理员 |
| `DELETE /api/music/:docId/covers/:coverId` | DELETE | 删除歌曲封面 | 管理员 |
| `PATCH /api/music/:docId/covers/:coverId/default` | PATCH | 设为默认封面 | 管理员 |
| `GET /api/albums/:docId/covers` | GET | 获取专辑封面列表 | 公开 |
| `POST /api/albums/:docId/covers` | POST | 上传专辑封面 | 管理员 |
| `DELETE /api/albums/:docId/covers/:coverId` | DELETE | 删除专辑封面 | 管理员 |
| `PATCH /api/albums/:docId/covers/:coverId/default` | PATCH | 设为默认封面 | 管理员 |
| `POST /api/albums/:docId/sync-covers-to-songs` | POST | 同步封面到专辑内歌曲 | 管理员 |
| `POST /api/albums` | POST | 创建专辑 | 管理员 |
| `PATCH /api/albums/:docId` | PATCH | 更新专辑 | 管理员 |
| `DELETE /api/albums/:docId` | DELETE | 删除专辑 | 管理员 |
| `GET /api/embeddings/status` | GET | 获取向量状态概览 | 管理员 |
| `POST /api/embeddings/enqueue-missing` | POST | 补齐缺失向量 | 管理员 |
| `POST /api/embeddings/sync-batch` | POST | 批量同步向量 | 管理员 |
| `GET /api/embeddings/errors` | GET | 获取向量生成错误列表 | 管理员 |
| `POST /api/embeddings/retry-failed` | POST | 重试失败的向量任务 | 管理员 |
| `POST /api/embeddings/rebuild-all` | POST | 重建全部向量 | 管理员 |
| `GET /api/search/semantic-galleries` | GET | 文字语义搜图 | 所有用户 |

**前端新增组件：**

| 组件 | 位置 | 功能 |
|------|------|------|
| `SongCoverManager` | `src/components/SongCoverManager.tsx` | 歌曲封面管理弹窗 |
| `SongEditModal` | `src/components/SongEditModal.tsx` | 歌曲编辑弹窗 |
| `AlbumEditModal` | `src/components/AlbumEditModal.tsx` | 专辑创建/编辑弹窗 |
| `AlbumCoverManager` | `src/components/AlbumCoverManager.tsx` | 专辑封面管理弹窗 |
| `EmbeddingsTab` | `src/pages/Admin/EmbeddingsTab.tsx` | 向量管理面板 |

**前端页面集成：**

| 页面 | 集成位置 | 功能 |
|------|---------|------|
| `MusicDetail.tsx` | 歌曲详情页底部「管理功能」区 | 编辑歌曲、歌曲封面管理按钮 |
| `Music.tsx` | 专辑 Tab 头部 | 创建专辑按钮 |
| `AlbumDetail.tsx` | 专辑详情页底部「管理功能」区 | 专辑封面管理按钮 |
| `Admin.tsx` | 新增「向量管理」Tab | 向量状态与批量操作 |

**功能说明：**

1. **歌曲封面管理**：管理员可在歌曲详情页上传多张封面、设置默认封面、删除封面
2. **专辑 CRUD**：管理员可在专辑列表创建新专辑，填写标题、艺术家、描述、原始链接
3. **专辑封面管理**：类似歌曲封面管理，支持上传、设默认、删除；另支持「同步到歌曲」将封面批量更新到专辑内所有歌曲
4. **向量管理面板**：展示 pending/processing/ready/failed 数量，提供补齐缺失、批量同步、查看错误、重试失败、重建全部等批量操作

**验证步骤：**

1. 使用管理员账号登录
2. 进入歌曲详情页（`/music/:songId`），滚动到底部「管理功能」区，点击「封面管理」
3. 上传新封面、设为默认、删除旧封面
4. 进入音乐馆，切换到「专辑」Tab，点击「创建专辑」按钮
5. 填写专辑信息后保存
6. 进入专辑详情页，滚动到底部「管理功能」区，点击「封面管理」
7. 上传封面并测试「同步到歌曲」功能
8. 进入管理后台，切换到「向量管理」Tab
9. 查看状态概览，执行补齐/同步/重试操作

---

## 7. 构建并启动服务

> **重要：必须先构建前端**
>
> `npm run build` 会生成 `dist/` 目录，包含所有前端静态文件。如果不执行此步骤，服务只能提供 API，前端页面会 404（此时只有 `/api/health` 等接口正常）。
>
> **每次代码更新（包括 `.env` 修改）后，都需要重新构建并重启 PM2**。

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

### 11.1.1 Wiki 点赞/踩/置顶功能验证（v3.x+）

Wiki 页面点赞、踩、置顶功能验证：

```bash
# 先登录（创建 Cookie）
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"email":"admin@example.com","password":"请替换为管理员密码"}'

# 点赞 Wiki 页面
curl -X POST http://127.0.0.1:3000/api/wiki/<页面slug>/like \
  -b cookie.txt -c cookie.txt

# 取消点赞
curl -X DELETE http://127.0.0.1:3000/api/wiki/<页面slug>/like \
  -b cookie.txt -c cookie.txt

# 踩 Wiki 页面
curl -X POST http://127.0.0.1:3000/api/wiki/<页面slug>/dislike \
  -b cookie.txt -c cookie.txt

# 取消踩
curl -X DELETE http://127.0.0.1:3000/api/wiki/<页面slug>/dislike \
  -b cookie.txt -c cookie.txt

# 置顶 Wiki 页面（仅管理员）
curl -X POST http://127.0.0.1:3000/api/wiki/<页面slug>/pin \
  -b cookie.txt -c cookie.txt

# 取消置顶（仅管理员）
curl -X DELETE http://127.0.0.1:3000/api/wiki/<页面slug>/pin \
  -b cookie.txt -c cookie.txt

# 获取 Wiki 列表（验证置顶排序）
curl http://127.0.0.1:3000/api/wiki -b cookie.txt -c cookie.txt
```

前端验证步骤：

1. 访问 Wiki 列表页，验证：
   - 每个卡片显示点赞数和踩数
   - 置顶页面卡片左侧有绿色边框
   - 置顶页面显示"已置顶"标签
   - 置顶页面排在列表最前面

2. 访问 Wiki 详情页，验证：
   - 顶部操作栏有点赞、踩、置顶按钮（置顶按钮仅管理员可见）
   - 点赞按钮点击后变红色，再次点击取消
   - 踩按钮点击后变橙色，再次点击取消
   - 点赞和踩互斥（点赞后再点踩会取消点赞）
   - 置顶按钮点击后显示"已置顶"状态
   - 状态区显示点赞数、踩数和置顶状态

验证点：
- 重复点赞/踩会自动切换状态（toggle）
- 同一用户对同一页面只能点赞/踩一次（唯一约束）
- 点赞和踩互斥
- 非管理员调用置顶 API 返回 403
- Wiki 列表默认按置顶优先排序
- 置顶页面在列表卡片左侧有绿色边框和"已置顶"标签

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
- 超过 25MB 图片会返回 `413`
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

# 文字语义搜图（输入文字描述，查找语义相关的图集）
curl "http://127.0.0.1:3000/api/search/semantic-galleries?q=%E9%9B%85%E8%89%87%E6%AD%8C%E5%A5%B3%E5%AD%90&limit=12&minScore=0.2" \
  -b cookie.txt -c cookie.txt
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
- 文件大小限制：25MB
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

### 11.7 Wiki 内链 Hover 卡片预览验证（v3.1+）

本次发布新增 Wiki 页面内链的 hover 卡片预览功能，提升站内导航体验。

**功能说明：**

- 在 Wiki 页面中，将鼠标悬停在 `[[slug]]` 或 `[[显示文本|slug]]` 格式的内链上
- 300ms 后自动显示悬浮卡片，展示目标页面的标题和内容摘要
- 卡片支持自动定位（空间不足时显示在触发元素上方）
- 鼠标移出后卡片立即消失

**验证步骤：**

1. 访问任意已存在的 Wiki 页面
2. 在页面内容中找到以 `[[` 开头的内链
3. 将鼠标悬停在内链文字上
4. 预期：300ms 后显示悬浮卡片，包含目标页面的标题和约 150 字符的内容摘要
5. 鼠标移开后卡片立即消失

**验证点：**

- hover 延迟约 300ms（非立即显示，防止误触）
- 卡片显示目标页面的加粗标题（品牌色 `brand-olive`）
- 卡片显示内容摘要（最多 3 行，超过时截断并加省略号）
- 卡片底部显示分类标签
- 卡片加载中显示旋转加载动画
- 目标页面不存在时显示"无法加载预览"
- 快速移入移出不会触发请求（防抖处理）

**相关代码：**

| 文件 | 说明 |
|------|------|
| `src/components/WikiLinkPreview.tsx` | Hover 卡片预览组件 |
| `src/pages/Wiki.tsx` | `WikiMarkdown` 组件集成预览功能 |

### 11.8 音乐馆双栏目验证（v3.2+）

#### 11.8.1 页面交互验证

1. 打开 `https://your-domain.com/music`
2. 在页面顶部切换「音乐」和「专辑」Tab
3. 预期：
   - Tab 可正常切换
   - 「音乐」显示歌曲卡片网格
   - 「专辑」显示专辑封面网格
   - 移动端与桌面端均可正常展示

#### 11.8.2 音乐栏目能力验证

1. 在「音乐」Tab 点击歌曲卡片中的播放按钮
2. 点击同一卡片中的「详情」入口
3. 预期：
   - 点击播放后底部全局播放器开始播放该曲目
   - 点击详情后可进入 `/music/:songId`
   - 歌曲详情页可正常显示歌词与关联乐评区

#### 11.8.3 专辑栏目能力验证

1. 切换到「专辑」Tab
2. 点击任一专辑封面/查看专辑入口
3. 预期：
   - 正常跳转至 `/album/:albumId`
   - 专辑详情页显示曲目列表
   - 点击「播放专辑」可从第一首开始连续播放

可选接口自测：

```bash
# 获取专辑列表（用于专辑栏目）
curl http://127.0.0.1:3000/api/albums

# 获取歌曲详情（用于音乐详情页）
curl http://127.0.0.1:3000/api/music/<songDocId>
```

### 11.9 Wiki 关联页面与知识图谱功能验证（v3.x）

本次发布新增 Wiki 页面关联功能与知识图谱可视化，支持在百科页面之间建立关联关系并以图形化方式展示。

**功能说明：**

- Wiki 页面可添加多种类型的关联：相关人物、作品关联、时间线关联、自定义关系
- 关联可设置为双向关联（会自动在目标页面创建反向关联）
- 页面详情提供两种视图：列表视图（相关页面）和图形视图（知识图谱）
- 知识图谱以 SVG 图形展示页面之间的关联关系，支持点击节点跳转

**关联类型说明：**

| 类型 | 说明 |
|------|------|
| `related_person` | 相关人物 |
| `work_relation` | 作品关联 |
| `timeline_relation` | 时间线关联 |
| `custom` | 自定义关系 |

**验证步骤：**

#### 列表视图验证

1. 进入任意 Wiki 页面
2. 在页面底部找到「相关页面」区块
3. 点击「添加关联」（需进入编辑模式）
4. 选择关联类型，输入目标页面标识（slug）
5. 可选填写显示名称和设置双向关联
6. 保存页面后，页面底部会显示「相关页面」区块

#### 知识图谱视图验证

1. 进入任意 Wiki 页面
2. 点击页面右上角的「知识图谱」图标（Network）
3. 页面切换到图形视图，显示当前页面及其关联页面的关系图
4. 图例说明：
   - 实线箭头：直接关联
   - 虚线箭头：反向推断关联（来自目标页面的双向关联）
   - 节点大小：中心节点最大，1层关联次之，2层关联最小
5. 点击任意节点可跳转到对应页面

**API 响应变更：**

`GET /api/wiki/:slug` 接口新增返回：

```json
{
  "relations": [...],
  "relationGraph": {
    "nodes": [
      { "slug": "...", "title": "...", "category": "...", "depth": 0|1|2, "isCenter": true|false }
    ],
    "edges": [
      { "sourceSlug": "...", "targetSlug": "...", "type": "...", "typeLabel": "...", "label": null, "inferred": true|false }
    ]
  }
}
```

**验证点：**

- 添加关联后在页面底部能看到「相关页面」区块
- 关联类型标签正确显示（相关人物/作品关联/时间线关联/自定义关系）
- 双向关联标记正确显示
- 点击 Network 图标可切换到知识图谱视图
- 知识图谱正确显示中心页面、1层关联、2层关联
- 虚线表示反向推断关系
- 点击节点可正常跳转

### 11.10 操作日志与封禁日志验证（v3.x）

本次发布新增管理员后台的「操作日志」和「封禁日志」查看功能。

**功能说明：**

- 「操作日志」显示所有审核操作（通过/驳回）的历史记录
- 「封禁日志」显示用户封禁/解封的操作历史

**API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/admin/moderation_logs` | GET | 获取操作日志列表 | 管理员 |
| `/api/admin/ban_logs` | GET | 获取封禁日志列表 | 管理员 |

**验证步骤：**

1. 使用管理员账号登录
2. 进入后台管理页面
3. 切换到「操作日志」Tab，查看审核操作历史
4. 切换到「封禁日志」Tab，查看用户封禁/解封历史

**验证点：**

- 操作日志显示：时间、操作者、目标类型、目标ID、操作类型、备注
- 封禁日志显示：时间、操作者、被封禁用户、操作类型（封禁/解封）、原因
- 日志按时间倒序排列

### 11.11 音乐多平台导入验证（v3.x）

本次发布新增音乐多平台导入功能，支持从网易云、QQ音乐、酷狗、百度、酷我等多个平台导入歌曲。

**功能说明：**

- 音乐馆「添加音乐」区域新增平台选择下拉框
- 支持的平台：网易云音乐、QQ音乐、酷狗音乐、百度音乐、酷我音乐
- 选择平台后，输入对应平台的歌曲 ID 或链接即可导入

**后端 API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/music/from-netease` | POST | 从网易云导入 | 管理员 |
| `/api/music/from-qq` | POST | 从QQ音乐导入 | 管理员 |
| `/api/music/from-kugou` | POST | 从酷狗导入 | 管理员 |
| `/api/music/from-baidu` | POST | 从百度导入 | 管理员 |
| `/api/music/from-kuwo` | POST | 从酷我导入 | 管理员 |

**验证步骤：**

1. 使用管理员账号登录
2. 进入音乐馆页面
3. 点击「添加音乐」按钮
4. 选择目标平台（网易云/QQ音乐/酷狗/百度/酷我）
5. 输入对应平台的歌曲 ID 或链接
6. 点击「获取并添加」

### 11.12 Home 热门帖子验证（v3.x）

本次发布新增首页热门帖子展示功能。

**功能说明：**

- 首页「社区动态」上方新增「热门帖子」区块
- 显示 API 返回的 `hotPosts` 前 3 条
- 带有🔥图标标识

**验证步骤：**

1. 访问网站首页
2. 在 Hero 区域下方、百科分类区域上方找到「热门帖子」区块
3. 验证显示 3 条热门帖子，带有🔥图标

### 11.13 全局播放器音量控制验证（v3.x）

本次发布为全局音乐播放器新增音量控制功能。

**功能说明：**

- 迷你播放器右上角新增音量图标按钮
- 展开的播放器底部新增音量滑块
- 支持调节音量和静音

**验证步骤：**

1. 进入音乐馆并播放一首歌曲
2. 底部出现全局播放器
3. 点击播放器右上角的音量图标可静音/取消静音
4. 展开播放器后，底部显示音量滑块
5. 拖动滑块可调节音量

### 11.14 图集上传文件验证（v3.x）

本次发布新增图集上传时的文件类型和大小验证。

**功能说明：**

- 上传前验证文件类型（仅支持 JPEG、PNG、GIF、WEBP）
- 上传前验证文件大小（最大 10MB）
- 不符合要求的文件会在上传前被过滤，并显示错误提示

**验证步骤：**

1. 进入图集上传页面
2. 尝试选择非图片文件（如 .pdf、.txt）
3. 预期：显示错误提示「以下文件无法上传：xxx (不支持的文件类型)」
4. 尝试选择超过 10MB 的图片
5. 预期：显示错误提示「以下文件无法上传：xxx (文件过大，最大 10MB)」


### 11.15 搜索功能扩展至音乐与专辑验证（v3.x）

本次发布扩展搜索范围至音乐曲目和专辑。

**验证步骤：**

1. 访问搜索页面 `https://your-domain.com/search`
2. 输入关键词（如歌曲名、歌手名、专辑名）
3. 验证搜索建议下拉框中出现「音乐」和「专辑」类型的建议项
4. 点击搜索按钮
5. 验证结果区域显示「音乐」和「专辑」Tab
6. 点击各 Tab 查看对应类型的搜索结果
7. 点击音乐/专辑卡片验证跳转至详情页

**内容类型筛选验证：**

1. 在搜索页面展开高级筛选
2. 选择内容类型为「音乐」，点击搜索
3. 预期：仅显示音乐曲目搜索结果
4. 选择内容类型为「专辑」，点击搜索
5. 预期：仅显示专辑搜索结果

**后端 API 自测：**

```bash
# 全局搜索（包含 music 和 albums）
curl "http://127.0.0.1:3000/api/search?q=关键词"

# 仅搜索音乐
curl "http://127.0.0.1:3000/api/search?q=关键词&type=music"

# 仅搜索专辑
curl "http://127.0.0.1:3000/api/search?q=关键词&type=albums"

# 搜索建议（包含 music/album 类型）
curl "http://127.0.0.1:3000/api/search/suggest?q=关键"
```

**验证点：**

- 搜索建议返回包含 `type: "music"` 和 `type: "album"` 的建议项
- 搜索结果 JSON 包含 `music` 和 `albums` 数组
- 音乐搜索结果包含 `title`、`artist`、`album`、`cover` 字段
- 专辑搜索结果包含 `title`、`artist`、`tracksCount` 字段
- 切换内容类型筛选后，结果仅显示对应类型

### 11.16 歌曲/专辑封面管理与专辑 CRUD 验证（v3.x）

#### 11.16.1 歌曲封面管理验证

```bash
# 获取歌曲封面列表
curl http://127.0.0.1:3000/api/music/<songDocId>/covers

# 上传歌曲封面（需要先登录）
curl -X POST http://127.0.0.1:3000/api/music/<songDocId>/covers \
  -H "Content-Type: multipart/form-data" \
  -b cookie.txt -c cookie.txt \
  -F "file=@/root/test-cover.jpg"

# 设为默认封面
curl -X PATCH http://127.0.0.1:3000/api/music/<songDocId>/covers/<coverId>/default \
  -b cookie.txt -c cookie.txt

# 删除封面
curl -X DELETE http://127.0.0.1:3000/api/music/<songDocId>/covers/<coverId> \
  -b cookie.txt -c cookie.txt
```

**验证点：**
- 歌曲详情页底部显示「封面管理」按钮（仅管理员可见）
- 可上传 JPG/PNG/WEBP 等格式图片
- 可设默认封面，默认封面带有标记
- 不可删除已是默认的封面
- 删除封面后，歌曲主封面不变

#### 11.16.2 歌曲编辑验证

```bash
# 编辑歌曲信息
curl -X PATCH http://127.0.0.1:3000/api/music/<songDocId> \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"新标题","artist":"新艺术家","album":"新专辑","lyric":"歌词内容"}'
```

**验证点：**
- 歌曲详情页底部显示「编辑歌曲」按钮（仅管理员可见）
- 可编辑歌曲标题、艺术家、专辑、歌词
- 保存后页面自动刷新显示新内容

#### 11.16.3 专辑 CRUD 验证

```bash
# 创建专辑
curl -X POST http://127.0.0.1:3000/api/albums \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"测试专辑","artist":"测试艺术家","description":"专辑描述"}'

# 更新专辑
curl -X PATCH http://127.0.0.1:3000/api/albums/<albumDocId> \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"更新后的标题","description":"更新后的描述"}'

# 删除专辑
curl -X DELETE http://127.0.0.1:3000/api/albums/<albumDocId> \
  -b cookie.txt -c cookie.txt
```

**验证点：**
- 音乐馆专辑 Tab 显示「创建专辑」按钮（仅管理员可见）
- 创建专辑后，专辑列表自动刷新
- 可编辑专辑标题、艺术家、描述、原始链接
- 删除专辑后，专辑从列表消失

#### 11.16.4 专辑封面管理验证

```bash
# 获取专辑封面列表
curl http://127.0.0.1:3000/api/albums/<albumDocId>/covers

# 上传专辑封面
curl -X POST http://127.0.0.1:3000/api/albums/<albumDocId>/covers \
  -H "Content-Type: multipart/form-data" \
  -b cookie.txt -c cookie.txt \
  -F "file=@/root/test-album-cover.jpg"

# 同步封面到专辑内歌曲
curl -X POST http://127.0.0.1:3000/api/albums/<albumDocId>/sync-covers-to-songs \
  -b cookie.txt -c cookie.txt
```

**验证点：**
- 专辑详情页底部显示「封面管理」按钮（仅管理员可见）
- 可上传多张封面并设默认
- 「同步到歌曲」按钮可将封面批量更新到专辑内所有歌曲

#### 11.16.5 向量 Embeddings 管理面板验证

```bash
# 获取向量状态
curl http://127.0.0.1:3000/api/embeddings/status -b cookie.txt -c cookie.txt

# 获取向量错误列表
curl "http://127.0.0.1:3000/api/embeddings/errors?limit=20" -b cookie.txt -c cookie.txt

# 补齐缺失向量
curl -X POST http://127.0.0.1:3000/api/embeddings/enqueue-missing \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"limit":100}'

# 批量同步向量
curl -X POST http://127.0.0.1:3000/api/embeddings/sync-batch \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"limit":50}'

# 重试失败向量
curl -X POST http://127.0.0.1:3000/api/embeddings/retry-failed \
  -b cookie.txt -c cookie.txt

# 重建全部向量（危险操作）
curl -X POST http://127.0.0.1:3000/api/embeddings/rebuild-all \
  -b cookie.txt -c cookie.txt
```

**验证点：**
- 管理后台新增「向量管理」Tab（仅管理员可见）
- 状态概览显示 pending/processing/ready/failed 数量
- 「补齐缺失」可将缺失的向量加入队列
- 「批量同步」可处理待处理的向量任务
- 「查看错误」显示失败详情（图片信息、错误原因、重试次数）
- 「重试失败」可重新尝试失败的向量任务
- 「重建全部」会删除并重建所有向量（需二次确认）

### 11.17 上传功能优化（v3.x）

本次发布对上传功能进行了多项优化，提升了大文件上传的稳定性和多文件上传的速度。

#### 11.17.1 文件大小限制调整

| 上传类型 | 原限制 | 新限制 |
|---------|-------|-------|
| 普通图片上传（图集、头像等） | 20MB | **25MB** |
| AI 图片搜索 | 10MB | 10MB（保持不变） |

**验证命令**：

```bash
# 测试上传超过 25MB 的文件
curl -X POST http://127.0.0.1:3000/api/uploads/sessions \
  -H "Content-Type: application/json" \
  -c cookie.txt -b cookie.txt \
  -d '{"maxFiles":1}'

# 上传一个 26MB 的文件（应返回 413）
curl -X POST http://127.0.0.1:3000/api/uploads/sessions/<sessionId>/files \
  -b cookie.txt -c cookie.txt \
  -F "file=@/root/test-large.jpg"
```

#### 11.17.2 AI 图片搜索内存优化

AI 图片搜索（`/api/search/by-image`）的原实现使用内存存储上传文件，在并发请求或大文件时可能导致 OOM。

**优化方案**：改为临时文件存储，处理完成后自动清理。

**验证步骤**：

1. 观察 uploads 目录，确保没有残留的 `.tmp` 文件：

```bash
ls -la /root/huangshifu-wiki/uploads/ | grep search_temp
```

2. 多次执行 AI 图片搜索，验证均无 `.tmp` 文件残留

#### 11.17.3 图集多文件并发上传

图集多文件上传从串行改为并发（最大 3 个并发），显著提升上传速度。

**效果对比**（假设单文件上传耗时 2 秒）：

| 文件数量 | 串行上传 | 并发上传（3并发） |
|---------|---------|-----------------|
| 10 个文件 | 20 秒 | 约 8 秒 |
| 20 个文件 | 40 秒 | 约 14 秒 |

**优化代码位置**：

- `src/pages/Gallery.tsx`：并发上传逻辑
- `src/lib/apiClient.ts`：新增 `apiUploadWithProgress` 和 `apiUploadWithRetry` 工具函数

**验证步骤**：

1. 进入图集上传页面
2. 选择 10 张以上图片
3. 点击上传，观察进度条
4. 验证进度平滑增长，无明显卡顿

#### 11.17.4 文字语义搜图功能

新增文字语义搜图功能，用户可通过文字描述搜索语义相关的图集。

**技术实现**：

- 使用 CLIP text encoder 将文字描述转换为向量
- 通过 Qdrant 向量数据库进行相似度搜索
- 复用已有的图片向量索引

**API 端点**：

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/search/semantic-galleries` | GET | 文字语义搜图 | 所有用户 |

**前端入口**：

- 搜索页面 → 高级筛选 → 「AI 搜图」区域 → 开启「语义搜图」开关

**请求参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 搜索文字描述 |
| `limit` | number | 否 | 返回结果数量，默认 24，最大 60 |
| `minScore` | number | 否 | 最小相似度分数，0-1 之间 |

**响应格式**：

```json
{
  "mode": "semantic_text",
  "query": "荷词歌女子",
  "totalMatches": 5,
  "totalGalleries": 3,
  "galleries": [
    {
      "id": "xxx",
      "title": "荷词歌女子演出照",
      "description": "...",
      "similarity": 0.8523,
      ...
    }
  ]
}
```

**与图片搜图的区别**：

| 特性 | 以图搜图 (`/api/search/by-image`) | 文字搜图 (`/api/search/semantic-galleries`) |
|------|----------------------------------|------------------------------------------|
| 输入 | 图片文件或 base64 | 文字字符串 |
| 编码器 | CLIP image encoder | CLIP text encoder |
| 适用场景 | 找相似图片 | 用文字描述找相关图集 |

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

### 12.6 数据库 Schema 漂移（500 错误）

**症状**：API 返回 500 错误，但 PostgreSQL 服务正常。错误日志中出现类似以下错误：

```
ERROR: column Post.musicDocId does not exist
ERROR: column Gallery.published does not exist
ERROR: relation "public.EditLock" does not exist
```

**原因**：`prisma db push` 或 `prisma migrate deploy` 在某些情况下（如存在数据、约束冲突、或迁移历史损坏）未能正确应用 schema 变更，导致 Prisma Client 生成的查询与实际数据库结构不匹配。

**诊断命令**：

```bash
# 查看 PostgreSQL 错误日志
sudo tail -100 /var/log/postgresql/postgresql-*-main.log

# 检查缺失的列/表（以 musicDocId 为例）
sudo -u postgres psql -d huangshifu_wiki -c '\d "Post"' | grep musicDocId

# 检查 Gallery 表 published 列
sudo -u postgres psql -d huangshifu_wiki -c '\d "Gallery"' | grep published

# 检查 EditLock 表是否存在
sudo -u postgres psql -d huangshifu_wiki -c '\dt' | grep EditLock
```

**解决方案一：强制重新同步（无旧数据）**

如果数据库中没有需要保留的数据，执行完全重建：

```bash
# 1. 停止服务
pm2 delete huangshifu-wiki || true
pkill -f "tsx server.ts" || true

# 2. 重建 public schema
psql "postgresql://hsf_app:<密码>@127.0.0.1:5432/huangshifu_wiki" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. 重新应用 Prisma schema
cd /root/huangshifu-wiki
npm run db:push

# 4. 重新播种（如果需要）
npm run db:seed

# 5. 重启服务
npm run dev
```

**解决方案二：手动补全缺失字段/表**

如果数据不可丢失，逐个修复缺失的列和表：

```bash
sudo -u postgres psql -d huangshifu_wiki << 'EOF'
-- 补全 Post 表缺失列
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "musicDocId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "albumDocId" TEXT;

-- 补全 Gallery 表缺失列
ALTER TABLE "Gallery" ADD COLUMN IF NOT EXISTS "published" BOOLEAN DEFAULT false;
ALTER TABLE "Gallery" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMPTZ;

-- 创建 EditLock 表（如果不存在）
CREATE TABLE IF NOT EXISTS "EditLock" (
  "id" TEXT PRIMARY KEY DEFAULT 'cunique'(),
  "collection" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  UNIQUE("collection", "recordId")
);
EOF

# 重启服务
pm2 restart huangshifu-wiki --update-env
```

**预防措施**：

- 每次 `git pull` 后都要执行 `npm run db:generate` 和 `npm run db:deploy`
- 大版本升级后（如 v2.5 -> v2.6），务必检查 `npx prisma migrate status`
- 生产环境部署前先在测试环境验证迁移
- 定期检查 PostgreSQL 错误日志（`/var/log/postgresql/`）

### 12.7 `prisma: not found`

**症状**：运行 `npm run db:generate` 等命令时报 `sh: 1: prisma: not found`

**原因**：
- `npm ci` 网络超时导致依赖安装不完整
- 全局 `npx prisma` 调用了与项目不匹配的版本

**解决**：

```bash
cd /root/huangshifu-wiki
npm install --registry=https://registry.npmmirror.com
npx prisma --version  # 确认是 6.x
npm run db:generate
```

### 12.8 前端页面 404（访问根路径）

**症状**：`curl http://IP:3000/` 返回 404；但 `curl http://IP:3000/api/health` 正常返回 `{"status":"ok"}`

**原因**：未执行 `npm run build`，PM2 只启动了 API 服务，前端静态文件不存在

**解决**：

```bash
cd /root/huangshifu-wiki
npm run build
pm2 restart huangshifu-wiki --update-env
pm2 save
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

---

## 15. 地点标签功能（v4.0+）

本次发布新增地点标签功能，支持为图集、帖子等内容设置地点标签。

### 15.1 功能概述

- **行政区划数据**：使用 `slightlee/regions-data` 四级行政区划数据（省/市/区县/乡镇）
- **地点输入**：支持模糊搜索已有地点，也支持在地图上选点
- **EXIF 提取**：支持从图片 EXIF GPS 数据自动提取拍摄地点
- **地点显示**：地点标签以特殊样式显示（琥珀色区分普通标签）

### 15.2 环境变量配置

在 `.env` 中新增以下配置：

```bash
# 高德地图 - 前端 JS API（用于地图选点组件）
VITE_AMAP_JS_API_KEY="your_amap_js_api_key"

# 高德地图 - 后端 Web Service API（用于经纬度解析为行政区划）
AMAP_API_KEY="your_amap_web_service_api_key"
```

**获取高德地图 API Key**：
1. 注册高德开放平台账号：https://lbs.amap.com/
2. 创建应用，获取 Web JS API Key 和 Web Service API Key

### 15.3 数据库变更（已包含在 `db:deploy` 中）

| 表名 | 变更类型 | 说明 |
|------|---------|------|
| `Region` | 新建表 | 行政区划表，存储全国四级行政区划数据 |
| `Post` | 新增列 | `locationCode` String，可选，关联行政区划代码 |
| `Gallery` | 新增列 | `locationCode` String，可选，关联行政区划代码 |
| `WikiPage` | 新增列 | `locationCode` String，可选，关联行政区划代码 |

**Region 表结构**：

| 字段 | 类型 | 说明 |
|------|------|------|
| code | String (PK) | 行政区划代码，如 "440300"（深圳市） |
| name | String | 地名，如 "深圳市" |
| fullName | String | 完整名称，如 "广东省深圳市" |
| level | Int | 级别：1-省 2-市 3-区县 4-乡镇 |
| depth | Int | 深度（同 level） |
| parentCode | String | 上级代码，如 "440000"（广东省） |
| path | String | 路径代码，如 "440000,440300" |
| type | String | 类型名，如 "地级" |
| year | Int | 数据年份 |
| sortOrder | Int | 排序序号 |

### 15.4 导入行政区划数据

首次部署后需要导入行政区划数据：

```bash
cd /root/huangshifu-wiki
npm run regions:import
```

该命令会：
1. 从 `slightlee/regions-data` GitHub 仓库下载最新行政区划数据
2. 解析并转换数据格式
3. 清空并重新导入全部 42,935 条行政区划记录

### 15.5 后端 API 变更

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/api/regions` | GET | 获取地点列表（支持模糊搜索） | 公开 |
| `/api/regions/search` | GET | 模糊搜索地点 `?q=深圳` | 公开 |
| `/api/regions/suggest` | GET | 获取地点建议 `?q=深` | 公开 |
| `/api/regions/provinces` | GET | 获取省份列表 | 公开 |
| `/api/regions/cities/:provinceCode` | GET | 获取城市列表 | 公开 |
| `/api/regions/districts/:cityCode` | GET | 获取区县列表 | 公开 |
| `/api/regions/path/:code` | GET | 获取完整行政区划路径 | 公开 |
| `/api/regions/:code` | GET | 获取地点详情 | 公开 |
| `/api/regions/resolve` | POST | 经纬度 → 行政区划 | 公开 |
| `/api/regions/search/address` | GET | 搜索地址（高德） | 公开 |
| `/api/exif/extract-gps` | POST | 从图片提取 GPS | 公开 |
| `/api/exif/extract-gps-with-region` | POST | 提取 GPS 并解析行政区划 | 公开 |
| `/api/exif/extract-single` | GET | 提取单张图片 GPS | 公开 |

**创建/更新内容时传入地点**：

```bash
# 创建帖子时指定地点
curl -X POST http://127.0.0.1:3000/api/posts \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"title":"测试帖子","section":"general","content":"内容","locationCode":"440300"}'

# 更新图集时指定地点
curl -X PATCH http://127.0.0.1:3000/api/galleries/<galleryId> \
  -H "Content-Type: application/json" \
  -b cookie.txt -c cookie.txt \
  -d '{"locationCode":"440305"}'
```

### 15.6 前端组件

| 组件 | 位置 | 功能 |
|------|------|------|
| `LocationTagInput` | `src/components/LocationTagInput.tsx` | 地点输入框（模糊搜索+地图选点） |
| `MapPickerModal` | `src/components/MapPickerModal.tsx` | 地图选点弹窗（基于高德地图 JS API） |
| `LocationConfirmDialog` | `src/components/LocationConfirmDialog.tsx` | EXIF 提取后的地点确认弹窗 |

### 15.7 验证步骤

#### 15.7.1 行政区划数据导入验证

```bash
# 检查 Region 表记录数
psql "postgresql://hsf_app:<密码>@127.0.0.1:5432/huangshifu_wiki" -c "SELECT COUNT(*) FROM \"Region\";"

# 检查各层级分布
psql "postgresql://hsf_app:<密码>@127.0.0.1:5432/huangshifu_wiki" -c "SELECT level, COUNT(*) FROM \"Region\" GROUP BY level ORDER BY level;"
```

预期结果：
- 总记录数约 42,935 条
- 省级 34 条、地级 333 条、县级 2,845 条、乡级约 38,723 条

#### 15.7.2 地点 API 验证

```bash
# 搜索地点
curl "http://127.0.0.1:3000/api/regions/search?q=深圳"

# 获取省份
curl "http://127.0.0.1:3000/api/regions/provinces"

# 获取城市
curl "http://127.0.0.1:3000/api/regions/cities/440000"

# 经纬度解析（需要配置 AMAP_API_KEY）
curl -X POST http://127.0.0.1:3000/api/regions/resolve \
  -H "Content-Type: application/json" \
  -d '{"lng":114.065,"lat":22.548}'
```

#### 15.7.3 前端地点功能验证

1. 进入图集上传页面
2. 在标签输入框下方找到「地点」输入框
3. 输入"深圳"应显示模糊搜索建议
4. 点击地图图标应打开地图选点弹窗
5. 选择地点后，地点以琥珀色标签样式显示
6. 创建图集后，地点信息保存成功

#### 15.7.4 帖子地点功能验证

1. 进入发帖页面
2. 在标签输入框下方找到「地点」输入框
3. 选择一个地点后提交帖子
4. 帖子详情页应显示地点标签

### 15.8 EXIF GPS 提取功能验证

EXIF GPS 提取需要：
1. 图片包含 GPS 元数据
2. 已配置 `AMAP_API_KEY`（用于将 GPS 坐标解析为行政区划）

```bash
# 提取单张图片 GPS
curl "http://127.0.0.1:3000/api/exif/extract-single?url=https://example.com/photo_with_gps.jpg"
```

**验证点**：
- 没有 GPS 信息的图片返回 `gps: null`
- 有 GPS 信息的图片返回经纬度
- `extract-gps-with-region` 可直接返回对应的行政区划信息

### 16.1 歌曲跨平台关联功能（v3.x）

本次发布新增歌曲跨平台关联功能，支持手动关联和自动匹配。

**功能说明：**

- **编辑歌曲时关联**：在歌曲编辑弹窗中，可手动填写其他平台的歌曲 ID
- **自动匹配搜索**：点击「匹配」按钮，在目标平台搜索相似歌曲并自动填入 ID
- **平台 ID 冲突检测**：如果填入的 ID 已被其他歌曲使用，提示冲突
- **导入时自动关联**：导入歌曲时，如果发现同歌曲其他平台版本，自动关联（不创建重复记录）
- **歌曲列表显示**：歌曲卡片上显示已关联的平台标签（可点击跳转）
- **关联管理页面**：新增 `/music/links` 页面，表格展示所有歌曲的平台关联状态

**数据库变更：**

- 无新增表，平台 ID 字段（`neteaseId`、`tencentId`、`kugouId`、`baiduId`、`kuwoId`）已在 `MusicTrack` 模型中存在

**后端 API 变更：**

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `GET /api/music/match-suggestions` | GET | 搜索跨平台匹配歌曲 | 公开 |
| `PATCH /api/music/:docId` | PATCH | 编辑歌曲信息（支持平台 ID） | 管理员 |
| `POST /api/music/import` | POST | 导入歌曲（支持自动关联） | 管理员 |

**新增端点详细说明：**

#### `GET /api/music/match-suggestions`

根据歌名和艺术家在指定平台搜索匹配的歌曲。

**请求参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `platform` | string | 是 | 目标平台：`netease`、`tencent`、`kugou`、`baidu`、`kuwo` |
| `title` | string | 是 | 歌曲标题 |
| `artist` | string | 是 | 艺术家名称 |

**响应：**

```json
{
  "suggestions": [
    {
      "sourceId": "12345678",
      "title": "歌曲名",
      "artist": "歌手名",
      "album": "专辑名",
      "cover": "封面URL",
      "sourceUrl": "平台歌曲页URL",
      "score": 85,
      "isAutoSelected": true,
      "alreadyLinked": { "docId": "xxx", "title": "已关联的歌曲" }
    }
  ],
  "autoSelectedIndex": 0
}
```

**匹配度计算：**
- 标题 + 艺术家各占 50% 权重
- 相似度 ≥80% 且明显高于其他结果时，`isAutoSelected: true`
- `alreadyLinked` 表示该 ID 已关联到其他歌曲

#### `PATCH /api/music/:docId` 平台 ID 字段

在原有字段基础上，新增以下平台 ID 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `neteaseId` | string \| null | 网易云音乐歌曲 ID |
| `tencentId` | string \| null | QQ 音乐歌曲 ID |
| `kugouId` | string \| null | 酷狗音乐歌曲 ID |
| `baiduId` | string \| null | 百度音乐歌曲 ID |
| `kuwoId` | string \| null | 酷我音乐歌曲 ID |

**冲突响应（状态码 409）：**

```json
{
  "error": "该平台ID已被歌曲「歌曲名」使用",
  "conflict": true,
  "conflictingSong": {
    "docId": "xxx",
    "title": "歌曲名",
    "artist": "艺术家"
  }
}
```

**前端新增组件：**

| 组件 | 位置 | 功能 |
|------|------|------|
| `MatchSuggestionModal` | `src/components/MatchSuggestionModal.tsx` | 跨平台匹配搜索弹窗 |
| `MusicLinks` | `src/pages/MusicLinks.tsx` | 歌曲关联管理页面 |

**前端页面变更：**

| 页面 | 变更 |
|------|------|
| `Music.tsx` | 歌曲卡片新增平台标签显示；新增「关联管理」按钮 |
| `MusicDetail.tsx` | `SongItem` 类型新增 `platformIds` 字段 |
| `SongEditModal.tsx` | 新增「关联平台」可折叠区域；平台 ID 输入框和匹配按钮 |

**新增路由：**

| 路径 | 页面 | 说明 |
|------|------|------|
| `/music/links` | MusicLinks | 歌曲关联管理页面 |

**验证步骤：**

1. **手动关联验证**：
   - 进入歌曲详情页，点击「编辑歌曲」
   - 展开「关联平台」区域
   - 填写某个平台的歌曲 ID（如网易云 ID），点击保存
   - 预期：刷新后歌曲卡片显示该平台标签

2. **自动匹配验证**：
   - 在歌曲编辑弹窗中，点击某平台行的「匹配」按钮
   - 弹出匹配搜索弹窗，显示搜索结果
   - 选择正确的结果并确认
   - 预期：ID 自动填入输入框

3. **冲突检测验证**：
   - 尝试将一个已被其他歌曲使用的平台 ID 填入
   - 预期：显示错误提示「该平台ID已被歌曲「XXX」使用」

4. **导入自动关联验证**：
   - 导入一首已有其他平台版本的歌曲
   - 预期：该歌曲的平台 ID 被更新，而非创建新记录

5. **关联管理页面验证**：
   - 进入音乐馆，点击「关联管理」按钮
   - 预期：显示 `/music/links` 页面，表格展示所有歌曲的平台关联状态
   - 可按平台、关联状态筛选
