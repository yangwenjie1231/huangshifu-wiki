# 代码质量改进检查清单 (Checklist)

## 使用说明

- [ ] 表示未完成
- [x] 表示已完成
- [!] 表示进行中或有问题

---

## P0 严重问题修复检查

### P0-1: 用户状态路由权限修复
- [ ] `PUT /api/users/status` 中间件改为 `requireSuperAdmin`
- [ ] 添加路径参数 `:userId` 用于指定目标用户
- [ ] 普通用户访问返回 403
- [ ] 超级管理员可以修改任意用户状态
- [ ] 状态变更自动记录到 `UserBanLog` 表
- [ ] 相关测试用例更新

### P0-2: bcrypt 静态导入
- [ ] 文件顶部添加 `import bcrypt from 'bcryptjs'`
- [ ] 删除路由内的动态导入语句
- [ ] `bcrypt.default` 改为 `bcrypt`
- [ ] `npm run lint` 通过

### P0-3: prismaAny 移除
- [ ] 删除 `const prismaAny = prisma as any;`
- [ ] 所有 `prismaAny` 替换为 `prisma`
- [ ] `refreshPostHotScore` 函数类型正确
- [ ] `applyAlbumTracksToRelations` 函数类型正确
- [ ] `addSongCoverFromAsset` 函数类型正确
- [ ] `addAlbumCoverFromAsset` 函数类型正确
- [ ] `createOrUpdateImportedSong` 函数类型正确
- [ ] `autoLinkInstrumental` 函数类型正确
- [ ] `fetchSongsWithRelations` 函数类型正确
- [ ] `fetchSongWithRelationsByDocId` 函数类型正确
- [ ] 如有需要，在 `schema.prisma` 中添加缺失模型
- [ ] `npm run lint` 通过

### P0-4: 缓存大小限制
- [ ] 添加 `maxSize` 构造函数参数（默认 1000）
- [ ] `set()` 方法中添加大小检查
- [ ] 超过限制时删除最老条目
- [ ] `getStats()` 返回 `maxSize`
- [ ] 缓存淘汰逻辑正确
- [ ] 相关测试用例通过

### P0-5: CSP unsafe-eval 移除
- [ ] 从 CSP 中移除 `'unsafe-eval'`
- [ ] 检查项目不需要 `eval()`
- [ ] 如果需要，添加注释说明
- [ ] `npm run build` 成功
- [ ] 前端功能正常

---

## P1 重要问题修复检查

### P1-1: 请求去重内存泄漏
- [ ] 添加 `MAX_CACHE_SIZE = 500` 常量
- [ ] 添加 `MAX_COOLDON_SIZE = 200` 常量
- [ ] 缓存设置中检查大小
- [ ] 超过限制时删除最老条目
- [ ] SWR 冷却记录添加 TTL 检查
- [ ] 实现 `cleanupExpiredCooldowns()` 函数
- [ ] `clearCache()` 也清理冷却记录

### P1-4: JWT_SECRET 处理
- [ ] 移除第 14-16 行的直接 `throw`
- [ ] 添加环境变量验证函数
- [ ] 开发环境未配置时使用默认值并警告
- [ ] 生产环境未配置时拒绝启动
- [ ] 开发环境正常启动
- [ ] 生产环境明确错误提示

### P1-5: Prisma 连接关闭
- [ ] 添加 `process.on('beforeExit', ...)` 处理
- [ ] 仅在 Node.js 环境注册
- [ ] 进程退出时连接正确关闭
- [ ] 无连接泄漏警告

### P1-2: SmartImage effect 依赖
- [ ] 依赖改为原始类型值
- [ ] 使用可选链避免 undefined 错误
- [ ] effect 仅在值真正变化时触发

### P1-3: SmartImage 卸载清理
- [ ] 解析 URL 的 effect 添加 `cancelled` 标志
- [ ] `setResolvedUrl` 前检查 `!cancelled`
- [ ] 格式优化的 effect 同样处理
- [ ] 组件卸载后不会调用 setState
- [ ] 无 React 警告日志

### P1-6: 格式检测错误处理
- [ ] 添加 `.catch(console.error)` 处理
- [ ] 无未处理 rejection 警告

### P1-7: useApi 卸载清理
- [ ] 添加 `mountedRef` 跟踪挂载状态
- [ ] 添加 `useEffect` 清理函数
- [ ] `execute` 中检查组件是否挂载
- [ ] 同样处理 `useApiWithToast`
- [ ] 组件卸载后不会调用 setState
- [ ] 无 React 警告

---

## P2 次要问题修复检查

### P2-1: CSP 设置时机
- [ ] CSP 中间件从 `startServer()` 移出
- [ ] 放在路由注册之前
- [ ] CSP 头在所有路由之前设置

### P2-2: vite 依赖清理
- [ ] 从 `dependencies` 中移除 `vite`
- [ ] 只在 `devDependencies` 中保留
- [ ] 运行 `npm install` 更新 lock 文件
- [ ] `npm run build` 正常
- [ ] `npm run dev` 正常

### P2-3: 环境变量加载
- [ ] `.env.local` 使用 `override: true`
- [ ] `.env` 使用 `override: false`
- [ ] `.env.local` 优先级高于 `.env`
- [ ] 环境变量加载顺序明确

### P2-4: 用户注销 JWT 验证
- [ ] JWT 载荷中添加 `status` 字段
- [ ] `authMiddleware` 中验证用户状态
- [ ] 封禁用户 token 被拒绝
- [ ] 返回 403 状态码
- [ ] 正常用户 token 有效
- [ ] 相关测试用例通过

### P2-5: 输入验证中间件
- [ ] 创建 `src/server/middleware/validate.ts`
- [ ] 实现 `validate(schema)` 中间件
- [ ] `PUT /api/users/name` 添加验证
- [ ] `PUT /api/users/password` 添加验证
- [ ] `PATCH /api/users/me` 添加验证
- [ ] `POST /api/posts` 添加验证
- [ ] 无效请求返回 400 和明确错误消息

### P2-6: handleError 修复
- [ ] 始终创建新的 Error 实例
- [ ] 从合成事件中提取有用信息
- [ ] `handleError` 始终返回有效的 Error 对象

### P2-7: 缓存键冲突
- [ ] 使用函数引用或其他唯一标识
- [ ] 不同函数不会共享缓存键
- [ ] 缓存键生成逻辑明确

### P2-8: 环境变量类型定义
- [ ] 创建 `src/env.ts`
- [ ] 定义所有环境变量 Zod schema
- [ ] 实现 `validateEnv()` 函数
- [ ] 区分必需和可选变量
- [ ] `server.ts` 入口调用验证
- [ ] 前端 `.env` 类型定义
- [ ] 缺少必需变量时启动失败
- [ ] 类型错误在开发时被发现

---

## 最终验证检查

- [ ] `npm run lint` 通过（无 TypeScript 错误）
- [ ] `npm test` 通过（所有现有测试通过）
- [ ] `npm run build` 通过（生产构建成功）
- [ ] `npm run dev` 正常（开发服务器启动）
- [ ] 用户登录/注销功能正常
- [ ] 权限控制正常（普通用户 vs 管理员）
- [ ] 缓存功能正常
- [ ] 图片加载正常（SmartImage）
- [ ] 无控制台错误或警告
- [ ] 无内存泄漏迹象

---

## 备注

- **排除项**: P2-16（备份加密固定 salt）本次不处理
- **风险项**: P0-1、P0-5、P2-4、P2-5 需要额外测试验证
- **依赖项**: P2-8 环境变量类型定义可能影响其他修改
