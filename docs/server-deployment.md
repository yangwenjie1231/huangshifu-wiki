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

---

## 1. 部署前准备

建议环境：

- Debian/Ubuntu Linux
- Node.js 20+
- npm 9+
- MariaDB 11.8+（或 MySQL 8+）
- Nginx（用于域名和 HTTPS）

安装基础工具（Debian/Ubuntu）：

```bash
apt update
apt install -y git curl nginx
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
EOF
```

说明：

- `VITE_GEMINI_API_KEY` 为空时，AI 功能会自动降级（不报致命错）。
- 修改任何 `VITE_*` 变量后都需要重新构建前端：`npm run build`。
- `JWT_SECRET` 必须设置，否则服务无法启动。
- Cookie 的 `Secure` 标记在 HTTP 部署时会自动关闭（由 `trust proxy` + `X-Forwarded-Proto` 判断），HTTPS 部署时自动启用。如需强制覆盖，可设置环境变量 `COOKIE_SECURE=true` 或 `COOKIE_SECURE=false`。

---

## 5. 初始化 Prisma 与数据库表

```bash
cd /root/huangshifu-wiki
npm run db:generate
npx prisma db execute --file prisma/migrate.sql --schema prisma/schema.prisma
npm run db:seed
```

`db:seed` 会创建初始管理员账号（来自 `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`）。

---

## 6. 构建并启动服务

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

## 7. 使用 PM2 守护进程（推荐）

安装并托管：

```bash
npm i -g pm2
cd /root/huangshifu-wiki
pm2 start "NODE_ENV=production npx tsx server.ts" --name huangshifu-wiki
pm2 save
pm2 startup systemd -u root --hp /root   # 自动创建 systemd 服务，开机自启
```

常用命令：

```bash
pm2 status
pm2 logs huangshifu-wiki
pm2 restart huangshifu-wiki
pm2 stop huangshifu-wiki
```

---

## 8. 配置 Nginx 反向代理

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

## 10. 上线后验证清单

- `https://your-domain.com/api/health` 返回 `{"status":"ok"}`
- 前端可访问首页，静态资源加载正常
- 可以注册/登录
- 管理员账号可进入后台
- 图集上传可写入 `uploads/`
- 数据可写入 MariaDB

---

## 11. 常见问题排查

### 11.1 `API key should be set when using the Gemini API`

表示未配置 `VITE_GEMINI_API_KEY`。

- 若不需要 AI，可忽略（功能会降级）。
- 若需要 AI：补上 key 后执行：

```bash
npm run build
pm2 restart huangshifu-wiki
```

### 11.2 注册返回 `409 Conflict`（该邮箱已注册）

这是正常业务行为，说明邮箱已存在。

- 用该邮箱直接登录
- 或换新邮箱注册

### 11.3 字体加载报 CORS/被拦截

常见于浏览器扩展或网络策略拦截第三方字体资源。

- 先清浏览器缓存并强刷
- 临时禁用广告拦截/隐私插件后重试
- 本项目已使用本地字体回退，不依赖 Google Fonts 也可正常显示

### 11.4 `Access denied for user`（数据库权限问题）

- 检查 `DATABASE_URL` 用户、密码、host 是否正确
- 确认授权存在：

```sql
SHOW GRANTS FOR 'hsf_app'@'127.0.0.1';
```

---

## 12. 更新发布流程（后续版本）

```bash
cd /root/huangshifu-wiki
git pull
npm ci
npm run db:generate
npx prisma db execute --file prisma/migrate.sql --schema prisma/schema.prisma
npm run build
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

---

## 13. 备份建议

数据库备份：

```bash
mysqldump -u hsf_app -p --databases huangshifu_wiki > /root/backup/huangshifu_wiki_$(date +%F).sql
```

上传文件备份：

```bash
tar -czf /root/backup/uploads_$(date +%F).tar.gz /root/huangshifu-wiki/uploads
```

建议配合 `crontab` 做每日自动备份。
