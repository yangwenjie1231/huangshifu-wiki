# 500 Internal Server Error 问题排查与解决

## 问题描述

以下 API 端点返回 500 错误：

- `GET /api/music/:id/posts` - 获取音乐关联帖子失败
- `GET /api/posts?section=all&sort=latest` - 获取帖子失败
- `GET /api/galleries` - 获取图集失败
- `GET /api/home/feed` - 获取首页信息失败

## 错误日志

```
PrismaClientKnownRequestError: Invalid `prisma.post.findMany()` invocation:
The column `Post.musicDocId` does not exist in the current database.

PrismaClientKnownRequestError: Invalid `prisma.gallery.findMany()` invocation:
The column `Gallery.locationCode` does not exist in the current database.
```

## 根本原因

**数据库 schema 与 Prisma schema 不同步**

Prisma schema 中定义的列在 PostgreSQL 数据库中不存在：

| 表 | 缺失列 | schema.prisma 位置 |
|----|--------|-------------------|
| Post | musicDocId | 第 198 行 |
| Gallery | locationCode | 第 481 行 |

## 解决方案

### 1. 同步数据库 schema

```bash
# 方法一：如果有现有迁移
npx prisma migrate deploy

# 方法二：直接推送 schema 更改（开发环境推荐）
npx prisma db push

# 方法三：创建并应用新迁移
npx prisma migrate dev --name <migration_name>
```

### 2. 重启服务

```bash
# 查找运行中的 Node 进程
ps aux | grep -E "(node|tsx)" | grep -v grep

# 或者查找占用 3000 端口的进程
lsof -i :3000

# Kill 进程
kill <PID>

# 重启服务（后台运行）
nohup npm run dev > server.log 2>&1 &

# 或者使用 pm2
pm2 restart server.ts
```

### 3. 验证

```bash
# 测试端点
curl http://localhost:3000/api/posts
curl http://localhost:3000/api/galleries
curl http://localhost:3000/api/home/feed
```

## 预防措施

1. **部署前同步 schema**：每次部署前确保运行 `prisma migrate deploy` 或 `prisma db push`
2. **使用 pm2 等进程管理器**：便于服务管理和日志查看
3. **设置健康检查**：监控 `/api/home/feed` 等关键端点

## 常见问题

### Q: `prisma db push` 和 `prisma migrate deploy` 区别？

- `prisma db push`：直接将 Prisma schema 推送到数据库，会强制覆盖现有结构（适合开发环境）
- `prisma migrate deploy`：应用已创建的迁移文件，保持数据库历史记录（适合生产环境）

### Q: 迁移丢失了怎么办？

```bash
# 查看当前 migrations 状态
npx prisma migrate status

# 如果数据库已经损坏，可以重置
npx prisma migrate reset
```

### Q: 如何查看数据库实际结构？

```bash
psql "postgresql://user:password@host:5432/database" -c "\d \"Post\""
psql "postgresql://user:password@host:5432/database" -c "\d \"Gallery\""
```
