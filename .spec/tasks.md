# 代码质量改进任务清单 (Tasks)

## P0 严重问题修复

### P0-1: 用户状态路由权限修复

**任务 ID**: P0-1
**优先级**: P0
**预估工作量**: 30 分钟

**步骤**:
1. 修改 `src/server/routes/users.routes.ts`
   - 将第 43 行 `router.put('/status', requireAuth, ...` 改为 `requireSuperAdmin`
   - 添加路径参数 `:userId` 用于指定目标用户
   - 修改请求体验证，区分自身管理和管理员操作
2. 更新路由注释，说明权限要求
3. 验证：
   - 普通用户 PUT /api/users/status → 403
   - 超级管理员 PUT /api/users/status/:userId → 200
   - 管理员修改用户状态自动记录到 UserBanLog

### P0-2: bcrypt 静态导入

**任务 ID**: P0-2
**优先级**: P0
**预估工作量**: 5 分钟

**步骤**:
1. 修改 `src/server/routes/users.routes.ts`
   - 在文件顶部添加 `import bcrypt from 'bcryptjs';`
   - 删除第 134 行 `const bcrypt = await import('bcryptjs');`
   - 将第 155、161 行的 `bcrypt.default` 改为 `bcrypt`
2. 验证 `npm run lint` 通过

### P0-3: prismaAny 移除

**任务 ID**: P0-3
**优先级**: P0
**预估工作量**: 1 小时

**步骤**:
1. 修改 `src/server/utils/index.ts`
   - 删除第 74 行 `const prismaAny = prisma as any;`
   - 搜索文件中所有 `prismaAny` 使用处
   - 替换为 `prisma`，确保类型正确
2. 涉及的函数：
   - `refreshPostHotScore` (第 782、798 行)
   - `applyAlbumTracksToRelations` (第 1761、1787 行)
   - `addSongCoverFromAsset` (第 1808、1810、1821、1831 行)
   - `addAlbumCoverFromAsset` (第 1857、1859、1871、1880 行)
   - `createOrUpdateImportedSong` (第 1901、1920、1947、1972、1994、2021 行)
   - `autoLinkInstrumental` (第 2077、2087 行)
   - `fetchSongsWithRelations` (第 2103 行)
   - `fetchSongWithRelationsByDocId` (第 2133 行)
3. 如果 Prisma schema 缺少对应模型，需要在 `schema.prisma` 中添加
4. 验证 `npm run lint` 通过

### P0-4: 缓存大小限制

**任务 ID**: P0-4
**优先级**: P0
**预估工作量**: 30 分钟

**步骤**:
1. 修改 `src/server/utils/cache.ts`
   - 添加 `maxSize` 参数到构造函数（默认 1000）
   - 在 `set()` 方法中添加大小检查
   - 当 `this.cache.size >= this.maxSize` 时，删除最老的条目
   - 使用 `this.cache.keys().next()` 获取最老的键
   - 在 `getStats()` 中添加 `maxSize` 返回
2. 添加类型定义到 `CacheStats` 接口
3. 更新 `src/server/utils/cache.ts` 的导出
4. 验证缓存淘汰逻辑正确

### P0-5: CSP unsafe-eval 移除

**任务 ID**: P0-5
**优先级**: P0
**预估工作量**: 15 分钟

**步骤**:
1. 修改 `server.ts` 第 253-254 行
   - 从 CSP 中移除 `'unsafe-eval'`
   - 检查项目中是否确实不需要 `eval()`
   - 如果某些库需要，添加注释说明
2. 测试应用功能是否正常
3. 验证：
   - `npm run build` 成功
   - 前端功能正常

---

## P1 重要问题修复

### P1-1: 请求去重内存泄漏

**任务 ID**: P1-1
**优先级**: P1
**预估工作量**: 45 分钟

**步骤**:
1. 修改 `src/utils/requestDedup.ts`
   - 添加 `MAX_CACHE_SIZE = 500` 常量
   - 添加 `MAX_COOLDON_SIZE = 200` 常量
   - 在 `dedupedRequest` 的缓存设置中检查大小
   - 当 `cache.size >= MAX_CACHE_SIZE` 时，删除最老条目
   - SWR 冷却记录添加 TTL 检查（10 分钟）
   - 实现自动清理函数 `cleanupExpiredCooldowns()`
2. 在 `clearCache()` 中也清理冷却记录
3. 验证缓存大小限制生效

### P1-4: JWT_SECRET 处理

**任务 ID**: P1-4
**优先级**: P1
**预估工作量**: 20 分钟

**步骤**:
1. 修改 `src/server/middleware/auth.ts`
   - 移除第 14-16 行的直接 `throw`
   - 添加环境变量验证函数
   - 开发环境：如果 `JWT_SECRET` 为空，使用默认值并输出警告日志
   - 生产环境：如果 `JWT_SECRET` 为空，在 `startServer()` 中抛出错误
2. 创建 `src/lib/env.ts` 验证函数（部分实现，为 P2-8 做准备）
3. 验证：
   - 开发环境未配置时正常启动
   - 生产环境未配置时拒绝启动

### P1-5: Prisma 连接关闭

**任务 ID**: P1-5
**优先级**: P1
**预估工作量**: 10 分钟

**步骤**:
1. 修改 `src/server/prisma.ts`
   - 添加 `process.on('beforeExit', async () => { await prisma.$disconnect(); })`
   - 确保仅在 Node.js 环境注册（检查 `typeof process !== 'undefined'`）
2. 验证进程退出时连接正确关闭

### P1-2: SmartImage effect 依赖

**任务 ID**: P1-2
**优先级**: P1
**预估工作量**: 15 分钟

**步骤**:
1. 修改 `src/components/SmartImage.tsx` 第 256 行
   - 将依赖从 `[blurhash, decodeOptions.width, decodeOptions.height, decodeOptions.punch]` 
   - 改为 `[blurhash, decodeOptions?.width, decodeOptions?.height, decodeOptions?.punch]`
   - 使用可选链避免 undefined 错误
2. 验证 effect 仅在值真正变化时触发

### P1-3: SmartImage 卸载清理

**任务 ID**: P1-3
**优先级**: P1
**预估工作量**: 20 分钟

**步骤**:
1. 修改 `src/components/SmartImage.tsx`
   - 在解析 URL 的 effect（第 181-204 行）添加 `let cancelled = false;`
   - 在 `setResolvedUrl` 前检查 `if (!cancelled)`
   - 在清理函数中设置 `cancelled = true`
   - 在格式优化的 effect（第 207-228 行）同样处理
2. 验证组件卸载后不会调用 setState

### P1-6: 格式检测错误处理

**任务 ID**: P1-6
**优先级**: P1
**预估工作量**: 5 分钟

**步骤**:
1. 修改 `src/components/SmartImage.tsx` 第 90 行
   - 将 `initFormatSupport();` 改为 `initFormatSupport().catch(console.error);`
2. 验证无未处理 rejection 警告

### P1-7: useApi 卸载清理

**任务 ID**: P1-7
**优先级**: P1
**预估工作量**: 20 分钟

**步骤**:
1. 修改 `src/hooks/useApi.ts`
   - 添加 `const mountedRef = useRef(true);`
   - 添加 `useEffect` 清理函数：`return () => { mountedRef.current = false; };`
   - 在 `execute` 的 `try/catch` 中检查 `mountedRef.current` 再调用 `setState`
2. 同样处理 `useApiWithToast`
3. 验证组件卸载后不会调用 setState

---

## P2 次要问题修复

### P2-1: CSP 设置时机

**任务 ID**: P2-1
**优先级**: P2
**预估工作量**: 10 分钟

**步骤**:
1. 修改 `server.ts`
   - 将第 251-257 行的 CSP 中间件从 `startServer()` 移到路由注册之前
   - 放在 `app.use(authMiddleware);` 之后
2. 验证 CSP 头在所有路由之前设置

### P2-2: vite 依赖清理

**任务 ID**: P2-2
**优先级**: P2
**预估工作量**: 5 分钟

**步骤**:
1. 修改 `package.json`
   - 从 `dependencies` 中移除 `vite`（第 73 行）
   - 确保只在 `devDependencies` 中保留
2. 运行 `npm install` 更新 lock 文件
3. 验证 `npm run build` 和 `npm run dev` 正常

### P2-3: 环境变量加载

**任务 ID**: P2-3
**优先级**: P2
**预估工作量**: 10 分钟

**步骤**:
1. 修改 `server.ts` 第 5-8 行
   - 改为：
     ```typescript
     dotenv.config({ path: '.env.local', override: true });
     dotenv.config({ override: false });
     ```
2. 验证 `.env.local` 优先级高于 `.env`

### P2-4: 用户注销 JWT 验证

**任务 ID**: P2-4
**优先级**: P2
**预估工作量**: 45 分钟

**步骤**:
1. 修改 JWT token 生成（`src/server/middleware/auth.ts` 的 `createToken` 函数）
   - 在载荷中添加 `status` 字段
2. 修改 `authMiddleware` 验证逻辑
   - 解析 token 后检查 `status` 字段
   - 如果状态为 `banned`，拒绝请求（返回 403）
3. 添加测试用例验证封禁用户 token 被拒绝
4. 验证：
   - 正常用户 token 有效
   - 封禁用户 token 被拒绝

### P2-5: 输入验证中间件

**任务 ID**: P2-5
**优先级**: P2
**预估工作量**: 2 小时

**步骤**:
1. 创建 `src/server/middleware/validate.ts`
   - 实现 `validate(schema: ZodSchema)` 中间件函数
   - 验证 `req.body` 并返回分类错误
2. 为以下关键路由添加验证：
   - `PUT /api/users/name` - displayName 验证
   - `PUT /api/users/password` - currentPassword, newPassword 验证
   - `PATCH /api/users/me` - displayName, bio 验证
   - `POST /api/posts` - title, content 验证
3. 验证无效请求返回 400 和明确错误消息

### P2-6: handleError 修复

**任务 ID**: P2-6
**优先级**: P2
**预估工作量**: 10 分钟

**步骤**:
1. 修改 `src/components/SmartImage.tsx` 第 276-281 行
   - 将 `handleError` 改为始终创建新的 Error 实例
   - 从合成事件中提取有用信息（如 `event.target`）
2. 验证 `handleError` 始终返回有效的 Error 对象

### P2-7: 缓存键冲突

**任务 ID**: P2-7
**优先级**: P2
**预估工作量**: 15 分钟

**步骤**:
1. 修改 `src/utils/requestDedup.ts` 第 217-226 行
   - 使用函数引用.toString() 或其他唯一标识
   - 或添加可选的 `customKey` 参数到 `createDedupedRequest`
2. 验证不同函数不会共享缓存键

### P2-8: 环境变量类型定义

**任务 ID**: P2-8
**优先级**: P2
**预估工作量**: 1 小时

**步骤**:
1. 创建 `src/env.ts`
   - 定义所有环境变量的 Zod schema
   - 实现 `validateEnv()` 函数
   - 区分必需和可选变量
2. 在 `server.ts` 入口调用验证
3. 在前端代码中添加 `.env` 类型定义 `src/vite-env.d.ts`
4. 验证：
   - 缺少必需变量时启动失败并给出明确提示
   - 类型错误在开发时被发现

---

## 验证步骤

所有任务完成后，执行以下验证：

1. **类型检查**: `npm run lint` - 确保无 TypeScript 错误
2. **测试**: `npm test` - 确保所有现有测试通过
3. **构建**: `npm run build` - 确保生产构建成功
4. **开发服务器**: `npm run dev` - 确保开发服务器正常启动
5. **手动测试**:
   - 用户登录/注销
   - 权限控制（普通用户 vs 管理员）
   - 缓存功能
   - 图片加载（SmartImage）
