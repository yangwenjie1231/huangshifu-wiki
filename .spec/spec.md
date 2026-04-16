# 代码质量改进规格文档 (Spec)

## 概述

本文档定义了对 huangshifu-wiki 项目的代码质量改进范围、目标和具体要求。改进分为 P0（严重安全/数据一致性问题）、P1（功能/性能问题）和 P2（代码质量/维护性问题）三个优先级。

**排除项**：P2-16（备份加密固定 salt）本次暂不处理。

---

## P0 严重问题修复

### P0-1: 用户自行修改账号状态（安全漏洞）

**文件**: `src/server/routes/users.routes.ts`

**问题描述**: 
`PUT /api/users/status` 路由仅使用 `requireAuth` 中间件，允许任何已登录用户修改自己的 `status` 和 `banReason` 字段。恶意用户可以绕过封禁系统自行改为 `active` 状态。

**修复方案**:
1. 将路由中间件从 `requireAuth` 改为 `requireSuperAdmin`
2. 添加目标用户参数，允许管理员修改任意用户状态
3. 保留软封禁/解封逻辑，记录操作日志到 `UserBanLog`

**验收标准**:
- 普通用户访问 `/api/users/status` PUT 方法返回 403
- 超级管理员可以修改任意用户状态
- 状态变更自动记录到 `UserBanLog` 表

### P0-2: 密码哈希动态导入性能问题

**文件**: `src/server/routes/users.routes.ts` 第134行

**问题描述**: 
每次调用 `PUT /api/users/password` 时执行 `await import('bcryptjs')`，导致不必要的动态模块加载。

**修复方案**:
1. 在文件顶部静态导入 `bcryptjs`
2. 移除路由内的动态导入语句

**验收标准**:
- 文件顶部有 `import bcrypt from 'bcryptjs'`
- 路由函数内无动态导入语句

### P0-3: `prismaAny` 绕过类型安全

**文件**: `src/server/utils/index.ts` 第74行

**问题描述**: 
`const prismaAny = prisma as any;` 绕过了 Prisma 的类型安全系统，可能导致运行时错误无法被编译器发现。

**修复方案**:
1. 移除 `prismaAny` 变量
2. 使用 `prisma` 替代 `prismaAny`，添加正确的 Prisma 类型断言
3. 确保所有调用都有正确的类型推断

**验收标准**:
- 代码中不再有 `as any` 的 Prisma 转换
- TypeScript 编译通过（`npm run lint` 无错误）

### P0-4: 内存缓存无大小限制

**文件**: `src/server/utils/cache.ts`

**问题描述**: 
`MemoryCache` 的 `cache` Map 没有最大条目限制，长时间运行可能无限增长导致内存泄漏。

**修复方案**:
1. 添加 `maxSize` 构造函数参数（默认 1000）
2. 在 `set()` 方法中检查大小，超过限制时删除最老的条目（基于 Map 的插入顺序）
3. 添加 `size` 属性暴露当前缓存大小

**验收标准**:
- 缓存大小超过 `maxSize` 时自动淘汰旧条目
- 提供 `getStats()` 返回当前缓存大小

### P0-5: CSP 策略包含 unsafe-eval

**文件**: `server.ts` 第253-254行

**问题描述**: 
Content-Security-Policy 包含 `script-src 'self' 'unsafe-inline' 'unsafe-eval'`，`unsafe-eval` 允许执行 `eval()`，是 XSS 攻击的常见入口。

**修复方案**:
1. 检查项目是否确实需要 `unsafe-eval`（通常只有某些旧版库需要）
2. 如果不需要，从 CSP 中移除 `unsafe-eval`
3. 如果需要，添加注释说明原因

**验收标准**:
- CSP 中不包含 `unsafe-eval`，或包含说明原因的注释

---

## P1 重要问题修复

### P1-1: 请求去重模块内存泄漏

**文件**: `src/utils/requestDedup.ts`

**问题描述**: 
`cache`、`inFlightRequests`、`swrCooldowns` 三个 Map 永远不会被自动清理。

**修复方案**:
1. 添加 `MAX_CACHE_SIZE` 常量（默认 500）
2. 在 `dedupedRequest` 的缓存设置逻辑中检查大小
3. 当超过限制时，删除最老的缓存条目
4. SWR 冷却记录添加 TTL 自动清理（10 分钟过期）

**验收标准**:
- Map 大小有上限，不会无限增长
- 过期条目自动清理

### P1-2: SmartImage useEffect 依赖问题

**文件**: `src/components/SmartImage.tsx` 第256行

**问题描述**: 
`decodeOptions` 对象作为 `useEffect` 依赖，但每次渲染都会创建新对象引用，导致 effect 频繁触发。

**修复方案**:
1. 将 `decodeOptions` 的属性（`width`, `height`, `punch`）直接作为依赖
2. 或使用 `useMemo` 在父组件稳定 `decodeOptions` 引用

**验收标准**:
- `useEffect` 依赖原始类型值而非对象引用
- 仅在值真正变化时触发 effect

### P1-3: SmartImage 组件缺少卸载清理

**文件**: `src/components/SmartImage.tsx` 第181-204行、第207-228行

**问题描述**: 
异步 effect 中，如果组件在 Promise 完成前卸载，仍会调用 `setState`。

**修复方案**:
1. 在 effect 中添加 `let cancelled = false;`
2. 在 `setResolvedUrl`、`setOptimizedUrl` 前检查 `!cancelled`
3. 在清理函数中设置 `cancelled = true`

**验收标准**:
- 组件卸载后不会调用 `setState`
- 不会有 React 警告日志

### P1-4: JWT_SECRET 空值处理

**文件**: `src/server/middleware/auth.ts` 第14-16行

**问题描述**: 
`if (!JWT_SECRET) throw new Error(...)` 在模块加载时执行，如果环境变量未配置会导致整个服务器崩溃。

**修复方案**:
1. 开发环境使用默认密钥（带警告日志）
2. 生产环境必须配置，否则抛出明确错误
3. 添加环境变量验证启动脚本

**验收标准**:
- 开发环境未配置 `JWT_SECRET` 时服务器正常启动（带警告）
- 生产环境未配置时服务器拒绝启动并给出明确提示

### P1-5: 数据库连接未配置优雅关闭

**文件**: `src/server/prisma.ts`

**问题描述**: 
Prisma 客户端没有注册进程退出事件来关闭数据库连接。

**修复方案**:
1. 添加 `process.on('beforeExit', async () => { await prisma.$disconnect(); })`
2. 仅在服务器端（非浏览器环境）注册

**验收标准**:
- 进程退出时 Prisma 连接正确关闭
- 不会有连接泄漏警告

### P1-6: 全局格式检测 Promise 无错误处理

**文件**: `src/components/SmartImage.tsx` 第90行

**问题描述**: 
`initFormatSupport()` 在模块加载时调用但没有 `.catch()`。

**修复方案**:
1. 添加 `.catch(console.error)` 处理未捕获的 rejection

**验收标准**:
- 格式检测失败不会导致未处理 rejection 警告

### P1-7: useApi hook 组件卸载后 setState

**文件**: `src/hooks/useApi.ts` 第26-39行

**问题描述**: 
`execute` 函数中的 async 操作在组件卸载后仍会调用 `setState`。

**修复方案**:
1. 使用 `useRef` 跟踪组件挂载状态
2. 在 `execute` 的 `try/catch` 中检查组件是否仍挂载
3. 添加 `useEffect` 清理函数标记为已卸载

**验收标准**:
- 组件卸载后不会调用 `setState`
- 不会有 React 警告

---

## P2 次要问题修复

### P2-1: CSP 头设置时机不对

**文件**: `server.ts` 第251-257行

**问题描述**: 
CSP 中间件在 `startServer()` 函数内部添加，如果启动异常，CSP 头可能不会被设置。

**修复方案**:
1. 将 CSP 中间件从 `startServer()` 移到路由注册之前
2. 在 `app.use(authMiddleware)` 之后立即添加

**验收标准**:
- CSP 头在所有路由之前设置
- 服务器启动时 CSP 头已配置

### P2-2: vite 重复依赖声明

**文件**: `package.json`

**问题描述**: 
`vite` 同时出现在 `dependencies` 和 `devDependencies` 中。

**修复方案**:
1. 从 `dependencies` 中移除 `vite`
2. 确保只在 `devDependencies` 中保留

**验收标准**:
- `vite` 只出现在 `devDependencies` 中

### P2-3: 环境变量覆盖逻辑

**文件**: `server.ts` 第5-8行

**问题描述**: 
`.env.local` 和 `.env` 的加载顺序可能导致环境变量被意外覆盖。

**修复方案**:
1. 使用 `dotenv.config({ path: '.env.local', override: true })`
2. 然后 `dotenv.config({ override: false })` 加载 `.env`

**验收标准**:
- `.env.local` 优先级高于 `.env`
- 环境变量加载顺序明确

### P2-4: 用户注销软封禁问题

**文件**: `src/server/routes/users.routes.ts` 第245-264行

**问题描述**: 
`DELETE /api/users/account` 只是将用户标记为 `banned`，已颁发的 JWT 仍然有效。

**修复方案**:
1. 在 JWT 载荷中添加 `status` 字段
2. 在 `authMiddleware` 中验证用户状态
3. 封禁状态的用户即使有有效 token 也被拒绝

**验收标准**:
- 注销用户的 JWT 在下次请求时被拒绝
- 返回 403 状态码

### P2-5: 缺少输入验证中间件

**文件**: 所有路由文件

**问题描述**: 
路由直接使用 `req.body` 而没有运行时验证。

**修复方案**:
1. 引入 Zod 作为验证库
2. 创建通用的 `validate` 中间件函数
3. 为关键路由添加请求体验证

**验收标准**:
- 关键写操作路由有输入验证
- 无效请求返回 400 和明确错误消息

### P2-6: handleError 中 error 类型转换不安全

**文件**: `src/components/SmartImage.tsx` 第279行

**问题描述**: 
React 的合成事件对象永远不是 `Error` 实例。

**修复方案**:
1. 始终创建新的 Error 实例
2. 从合成事件中提取有用信息

**验收标准**:
- `handleError` 始终返回有效的 Error 对象

### P2-7: createDedupedRequest 缓存键冲突

**文件**: `src/utils/requestDedup.ts` 第223行

**问题描述**: 
使用函数名作为唯一标识，同名不同函数会导致缓存键冲突。

**修复方案**:
1. 使用函数引用.toString() 生成唯一标识
2. 或使用 Symbol 标记函数

**验收标准**:
- 不同函数不会共享缓存键
- 缓存键生成逻辑明确

### P2-8: 环境变量缺少类型定义

**文件**: 全局

**问题描述**: 
没有统一的环境变量类型定义文件。

**修复方案**:
1. 创建 `src/env.ts` 文件
2. 使用 Zod 验证所有环境变量
3. 在 `server.ts` 和前端入口导入验证

**验收标准**:
- 所有必需环境变量在启动时验证
- 类型错误在开发时被发现

---

## 实施计划

### 阶段 1: P0 问题修复
1. P0-1: 用户状态路由权限修复
2. P0-2: bcrypt 静态导入
3. P0-3: prismaAny 移除
4. P0-4: 缓存大小限制
5. P0-5: CSP unsafe-eval 移除

### 阶段 2: P1 问题修复
1. P1-1: 请求去重内存泄漏
2. P1-4: JWT_SECRET 处理
3. P1-5: Prisma 连接关闭
4. P1-2: SmartImage effect 依赖
5. P1-3: SmartImage 卸载清理
6. P1-6: 格式检测错误处理
7. P1-7: useApi 卸载清理

### 阶段 3: P2 问题修复
1. P2-1: CSP 设置时机
2. P2-2: vite 依赖清理
3. P2-3: 环境变量加载
4. P2-4: 用户注销 JWT 验证
5. P2-5: 输入验证中间件
6. P2-6: handleError 修复
7. P2-7: 缓存键冲突
8. P2-8: 环境变量类型定义

---

## 风险评估

| 修复项 | 风险等级 | 说明 |
|--------|----------|------|
| P0-1 | 中 | 需要前端配合调整 API 调用 |
| P0-3 | 低 | 类型修改，影响范围小 |
| P0-4 | 低 | 缓存淘汰策略，不影响功能 |
| P0-5 | 中 | 可能影响某些第三方库 |
| P1-4 | 低 | 仅影响开发环境启动 |
| P2-4 | 中 | 需要修改 JWT 生成和验证 |
| P2-5 | 高 | 影响所有路由，需要逐个添加 |

---

## 验收标准

1. **测试通过**: 所有现有测试继续通过（`npm test`）
2. **类型检查**: TypeScript 编译无错误（`npm run lint`）
3. **构建成功**: 项目构建成功（`npm run build`）
4. **功能正常**: 核心功能正常工作
5. **安全改进**: P0 安全问题已修复
