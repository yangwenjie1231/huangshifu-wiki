# Plan: 1000x并发请求预防方案

## TL;DR
> **Summary**: 单服务器生存模式——通过功能开关、静态化降级、多层缓存、速率限制和进程守护，在1000倍并发下保障wiki阅读、注册、登录核心功能可用。
> **Deliverables**: 功能开关系统、缓存层强化、速率限制、PM2集群模式、静态化降级方案
> **Effort**: Large
> **Parallel**: YES - 多个独立模块并行实施
> **Critical Path**: 功能开关 → 缓存层 → 限流 → PM2多核

## Context
### Original Request
网站可能突然有1000倍并发请求，但服务器性能有限，需要预防方案。

### Interview Summary
- **服务器**: 单台，资源有限
- **优先级**: wiki阅读、注册、登录可用；动态内容可降级
- **流量特征**: 持续数小时的突发
- **核心策略**: 功能开关 + 静态化降级 + 多层缓存 + 进程守护

### Metis Review (gaps addressed)
- 单进程Node.js无法利用多核，需PM2 cluster模式
- 内存缓存无持久化，重启即失效，添加开机自启动检查
- 无Redis会导致缓存穿透直击数据库，需实现本地LRU缓存
- 嵌入生成等重操作无队列保护，需添加任务队列和降级开关
- 后台开关必须收紧为 super_admin 专属，并提供自动开启阈值配置

## Work Objectives
### Core Objective
在1000倍并发下保持单服务器不崩溃，核心阅读/登录功能可用。

### Deliverables
1. 功能开关系统（动态内容→静态内容切换）
2. 超级管理员专属的管理面板开关与自动开启配置
3. 多层缓存体系（内存LRU + 静态页面缓存）
4. 速率限制增强（全局 + 端点级别）
5. PM2多核进程守护
6. 数据库连接保护和查询优化
7. 外部API保护（Gemini/Meting等）

### Definition of Done (verifiable conditions with commands)
- [ ] `curl localhost:3000/api/wiki/slug -o /dev/null -s -w "%{http_code}"` → 200 under 1000 concurrent
- [ ] `curl localhost:3000/api/auth/register` → 可用
- [ ] `curl localhost:3000/api/auth/login` → 可用
- [ ] `pm2 list` → 显示2+实例运行
- [ ] `curl localhost:3000/api/admin/features` → 返回所有开关状态，仅 super_admin 可访问
- [ ] `curl localhost:3000/api/admin/load-shedding` → 返回自动开启配置（是否开启、CPU/内存阈值、持续时间）
- [ ] 压力测试工具验证1000并发下响应时间<2s

### Must Have
- 功能降级开关（仅 super_admin 可手动调整）
- 自动开启配置（可配置是否启用，以及 CPU/内存阈值 + 持续时间）
- 管理面板中可见的加载退避状态与当前触发原因
- 静态页面/内容缓存
- 全局速率限制
- PM2多核守护
- 数据库连接池保护
- 外部API超时和熔断

### Must NOT Have
- 不修改现有业务逻辑，只添加保护层
- 不引入需要额外基础设施的服务（除非本地可运行）
- 不在降级时暴露敏感信息
- 不允许普通管理员或用户手动开启/关闭生存模式
- 不引入AI slop模式

## Verification Strategy
- Test decision: tests-after + manual load testing
- QA policy: Every task has agent-executed scenarios
- Evidence: .sisyphus/evidence/task-{N}-{slug}.{ext}

## Execution Strategy
### Parallel Execution Waves
Wave 1: [功能开关 + 缓存层] - 核心基础设施
Wave 2: [限流 + 进程守护] - 保护层
Wave 3: [数据库保护 + 外部API熔断] - 深度保护
Wave 4: [测试验证] - 压力测试验证

### Dependency Matrix (full, all tasks)
```
T1(功能开关) ──┬── T3(静态缓存) ── T5(PM2)
T2(内存缓存) ──┘        │              │
                       └──── T4(限流) ──┴── T6(DB保护) ── T7(熔断)
                                                    │
                                              T8(压力测试)
```

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1: 2 tasks - 缓存基础设施
- Wave 2: 3 tasks - 进程和流量保护
- Wave 3: 2 tasks - 数据库和外部服务保护
- Wave 4: 1 task - 集成验证

## TODOs

- [ ] 1. 实现功能开关系统

  **What to do**: 创建 `src/server/features/featureFlags.ts` 管理所有功能的开关状态，实现动态开关API，支持运行时切换以下功能：
  - `ENABLE_MUSIC_PLAYBACK`: 音乐播放（可降级为显示歌词）
  - `ENABLE_IMAGE_EMBEDDING`: 图片嵌入生成（可降级为关闭）
  - `ENABLE_GALLERY_UPLOAD`: 图片上传（可降级为只读）
  - `ENABLE_WIKI_EDIT`: wiki编辑（可降级为只读）
  - `ENABLE_COMMENTS`: 评论功能（可降级为关闭）
  - `ENABLE_SEARCH`: 搜索功能（可降级为预定义列表）
  - `ENABLE_ANALYTICS`: 统计/浏览历史（可降级为关闭）
  - `STATIC_MODE`: 静态模式开关（全部转为静态内容）

  开关与自动开启配置存储在数据库中，支持不重启生效。仅 `super_admin` 可手动修改；普通管理员仅可查看状态。
  自动开启配置需支持：
  - 是否启用自动开启（boolean）
  - CPU 占用阈值（默认 80%）
  - CPU 持续时间阈值（默认 5 分钟）
  - 内存占用阈值（默认 80%）
  - 内存持续时间阈值（默认 5 分钟）
  - 冷却时间/最小恢复窗口（防止频繁抖动）

  自动监测任务需独立运行，周期性采样 CPU/内存/请求压力，并在满足阈值且非冷却期时自动开启 STATIC_MODE；恢复也必须满足最小稳定窗口，避免来回抖动。

  还要补齐管理面板：`/admin` 页面展示当前模式、触发原因、阈值设置，并允许 super_admin 保存配置。

  **Must NOT do**: 不修改现有业务逻辑，只在路由层做early return；不允许普通管理员变更开关或阈值

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []
  - Omitted: frontend-dev

  **Parallelization**: YES | Wave 1 | Blocks: T3 | Blocked By: -

  **References**:
  - Pattern: `src/server/middleware/rateLimiter.ts` - 中间件模式参考
  - API: `server.ts` 中的路由注册模式
  - Type: `src/lib/featureFlags.ts` (新文件)
  - UI: `src/pages/Admin.tsx` - 现有后台页，可扩展 load shedding 面板
  - Auth: `src/lib/auth.ts` - `super_admin` 角色判断已存在

  **Acceptance Criteria**:
  - [ ] `GET /api/admin/features` 返回所有开关状态，且仅 super_admin 可访问写接口
  - [ ] `PATCH /api/admin/features/:key` 仅 super_admin 可动态更新开关
  - [ ] 开关变更写入日志
  - [ ] 开关状态在内存中缓存，不每次查DB
  - [ ] `GET/PATCH /api/admin/load-shedding` 可查看/修改自动开启配置
  - [ ] 管理面板可配置“是否自动开启”和 CPU/内存阈值
  - [ ] 自动触发后能记录触发指标与时间
  - [ ] 后台监测任务按固定间隔采样系统指标并执行阈值判断
  - [ ] 自动开启/恢复都受冷却窗口保护，避免频繁切换

  **QA Scenarios**:
  ```
  Scenario: 获取所有功能开关状态
    Tool: Bash
    Command: curl -s http://localhost:3000/api/admin/features | jq .
    Expected: 返回 {"features": {"ENABLE_MUSIC_PLAYBACK": true, ...}}
    Evidence: .sisyphus/evidence/task-1-features-get.json

  Scenario: 动态关闭音乐播放
    Tool: Bash
    Command: curl -X PATCH http://localhost:3000/api/admin/features/ENABLE_MUSIC_PLAYBACK -H "Content-Type: application/json" -d '{"value": false}'
    Expected: 返回成功，/api/music/* 返回降级响应
    Evidence: .sisyphus/evidence/task-1-features-toggle.json
  ```

  **Commit**: YES | Message: `feat(server): add feature flags system for load shedding`

- [ ] 2. 实现内存LRU缓存层

  **What to do**: 创建 `src/server/cache/lruCache.ts` 实现本地LRU缓存，用于缓存：
  - Wiki页面内容（TTL: 5分钟，高并发下延长）
  - 区域/分类数据（TTL: 30分钟）
  - 音乐播放URL已有Map缓存，强化其容量和淘汰策略
  - API响应片段（列表页等）

  缓存容量可配置，支持手动清除。

  **Must NOT do**: 不替代数据库，缓存仅作读缓存

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []
  - Omitted: frontend-dev

  **Parallelization**: YES | Wave 1 | Blocks: T3 | Blocked By: -

  **References**:
  - Pattern: `server.ts` 中 `playUrlCache` Map 的使用模式
  - Type: 遵循现有 Map 类型缓存模式

  **Acceptance Criteria**:
  - [ ] LRU缓存容量可配置（默认1000条目）
  - [ ] 支持TTL过期
  - [ ] 缓存命中率统计
  - [ ] 内存使用超限时自动淘汰

  **QA Scenarios**:
  ```
  Scenario: 缓存命中验证
    Tool: Bash
    Command: curl -s http://localhost:3000/api/wiki/test-slug; curl -s http://localhost:3000/api/wiki/test-slug
    Expected: 第二次响应更快（缓存命中）
    Evidence: .sisyphus/evidence/task-2-cache-hit.json

  Scenario: 缓存容量上限
    Tool: Bash
    Command: 压测触发缓存填充超过容量
    Expected: 旧条目被淘汰，新条目正常写入
    Evidence: .sisyphus/evidence/task-2-cache-eviction.json
  ```

  **Commit**: YES | Message: `feat(server): add LRU cache layer for data caching`

- [ ] 3. 实现静态内容预渲染和降级响应

  **What to do**: 当 `STATIC_MODE` 开启或负载过高时：
  - Wiki页面返回预缓存的静态内容
  - 音乐播放返回静态数据（不解析真实URL）
  - 评论列表返回空数组
  - 上传API返回429或503
  - 嵌入生成API返回空结果

  实现 `src/server/middleware/staticMode.ts` 中间件，在高负载时自动或手动触发。自动触发逻辑必须读取任务1保存的阈值配置，并且只有 `super_admin` 可以在管理面板手动开启/关闭。手动开关在 UI 上必须隐藏于普通管理员。

  **Must NOT do**: 不修改数据库，只改变响应内容

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []
  - Omitted: frontend-dev

  **Parallelization**: YES | Wave 1 | Blocks: T5 | Blocked By: T1

  **References**:
  - Pattern: `src/server/middleware/rateLimiter.ts`
  - API: `server.ts` 中各路由处理模式
  - UI: `src/pages/Admin.tsx` - 展示当前静态模式、阈值与原因

  **Acceptance Criteria**:
  - [ ] STATIC_MODE下wiki读取正常但无实时数据更新
  - [ ] STATIC_MODE下注册/登录正常
  - [ ] STATIC_MODE下音乐API返回降级响应（非错误）
  - [ ] 可配置自动触发阈值（CPU/内存/持续时间）
  - [ ] 自动触发后后台面板展示触发原因（CPU或内存）

  **QA Scenarios**:
  ```
  Scenario: STATIC_MODE下访问wiki
    Tool: Bash
    Command: curl -s http://localhost:3000/api/wiki/test-slug
    Expected: 返回缓存内容，非实时数据
    Evidence: .sisyphus/evidence/task-3-static-wiki.json

  Scenario: STATIC_MODE下尝试评论
    Tool: Bash
    Command: curl -X POST http://localhost:3000/api/posts/test-id/comments -d '{}'
    Expected: 返回429或降级响应（非500）
    Evidence: .sisyphus/evidence/task-3-static-comment-block.json
  ```

  **Commit**: YES | Message: `feat(server): add static mode middleware for load shedding`

- [ ] 4. 增强速率限制

  **What to do**: 扩展现有的 `rateLimiter.ts`，实现：
  - 全局限流（按IP/用户ID，1000请求/分钟）
  - 端点级别限流（auth: 10/15min已有，新增wiki: 60/分钟，search: 30/分钟）
  - 突发流量限流（令牌桶算法）
  - 限流响应包含Retry-After头
  - 管理员IP白名单

  **Must NOT do**: 不限制核心功能的开关控制API

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []
  - Omitted: frontend-dev

  **Parallelization**: YES | Wave 2 | Blocks: T5 | Blocked By: T1, T2

  **References**:
  - Pattern: `src/server/middleware/rateLimiter.ts` - 现有实现
  - API: Express request/response类型

  **Acceptance Criteria**:
  - [ ] 超出限流返回429 + Retry-After
  - [ ] wiki阅读不受影响（高限制）
  - [ ] auth端点已有保护，强化其限制
  - [ ] 日志记录限流事件

  **QA Scenarios**:
  ```
  Scenario: 超出限流触发
    Tool: Bash
    Command: for i in {1..100}; do curl -s -o /dev/null http://localhost:3000/api/wiki/test; done
    Expected: 最后几个请求返回429
    Evidence: .sisyphus/evidence/task-4-rate-limit.json

  Scenario: 限流后重试
    Tool: Bash
    Command: curl -I http://localhost:3000/api/search?q=test (触发限流后)
    Expected: 包含 Retry-After: 60 头
    Evidence: .sisyphus/evidence/task-4-retry-after.json
  ```

  **Commit**: YES | Message: `feat(server): enhance rate limiting for all endpoints`

- [ ] 5. PM2多核进程守护

  **What to do**: 配置PM2 cluster模式充分利用多核CPU：
  - 更新 `ecosystem.config.js` 或 `pm2.config.js`
  - 配置 `instances: 'max'` 自动匹配CPU核数
  - 配置内存上限（单个进程2GB）
  - 配置重启策略（内存超限/崩溃后重启）
  - 添加启动延迟和重试
  - 配置日志轮转

  同时确保：
  - Prisma连接池合理（按实例数调整）
  - 内存缓存不跨进程共享（每进程独立）
  - 使用 `pm2-runtime` 用于生产

  **Must NOT do**: 不修改应用代码，只配置PM2

  **Recommended Agent Profile**:
  - Category: `unspecified-low`
  - Skills: []
  - Omitted: frontend-dev

  **Parallelization**: YES | Wave 2 | Blocks: - | Blocked By: T1, T2

  **References**:
  - PM2官方文档 cluster模式
  - 当前启动脚本参考

  **Acceptance Criteria**:
  - [ ] `pm2 list` 显示多个实例
  - [ ] 单进程内存超限时自动重启
  - [ ] 新部署时zero-downtime reload
  - [ ] 日志正确轮转

  **QA Scenarios**:
  ```
  Scenario: 多实例运行验证
    Tool: Bash
    Command: pm2 list
    Expected: 显示2+实例（取决于CPU核数）
    Evidence: .sisyphus/evidence/task-5-pm2-list.json

  Scenario: 进程崩溃自动恢复
    Tool: Bash
    Command: kill -9 [one pid]; sleep 3; pm2 list
    Expected: 崩溃进程被重启，列表恢复正常
    Evidence: .sisyphus/evidence/task-5-pm2-restart.json
  ```

  **Commit**: YES | Message: `config(pm2): add cluster mode configuration`

- [ ] 6. 数据库连接保护和查询优化

  **What to do**: 强化数据库层保护：
  - 配置Prisma连接池大小（实例数*2，避免耗尽）
  - 添加查询超时（30秒）
  - 实现慢查询日志
  - 关键路径添加缓存（wiki页面列表等）
  - 实现连接池错误恢复
  - 添加数据库健康检查端点

  **Must NOT do**: 不修改schema，不添加新表

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []
  - Omitted: frontend-dev

  **Parallelization**: YES | Wave 3 | Blocks: T8 | Blocked By: T2

  **References**:
  - Pattern: `server.ts` 中 PrismaClient 初始化
  - Prisma连接管理文档
  - `prisma/schema.prisma` - 当前索引

  **Acceptance Criteria**:
  - [ ] 连接池大小可配置
  - [ ] 慢查询（>1s）被记录
  - [ ] DB不可用时API返回503
  - [ ] `/api/health/db` 端点返回数据库状态

  **QA Scenarios**:
  ```
  Scenario: 数据库连接池耗尽保护
    Tool: Bash
    Command: 模拟100并发复杂查询
    Expected: 部分请求排队，不全部失败
    Evidence: .sisyphus/evidence/task-6-db-pool.json

  Scenario: 健康检查端点
    Tool: Bash
    Command: curl -s http://localhost:3000/api/health/db
    Expected: 返回 {"status": "ok", "poolSize": N}
    Evidence: .sisyphus/evidence/task-6-health-check.json
  ```

  **Commit**: YES | Message: `feat(server): add database connection protection and query timeouts`

- [ ] 7. 外部API熔断器

  **What to do**: 为所有外部API调用实现熔断保护：
  - Gemini API（AI生成）
  - Meting API（音乐URL解析）
  - 高德地图API
  - 微信登录API

  实现模式：
  - 失败计数（5次失败触发熔断）
  - 熔断期间快速失败（不实际调用）
  - 半开状态探测恢复
  - 超时保护（所有外部调用5秒超时）

  **Must NOT do**: 不改变外部API功能，只添加保护

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []
  - Omitted: frontend-dev

  **Parallelization**: YES | Wave 3 | Blocks: T8 | Blocked By: T2

  **References**:
  - Pattern: `src/services/aiService.ts` - Gemini调用
  - Pattern: `src/server/music/metingService.ts` - Meting调用

  **Acceptance Criteria**:
  - [ ] 外部API失败5次后熔断器开启
  - [ ] 熔断期间API返回降级结果（非错误）
  - [ ] 熔断期间探测恢复（每30秒）
  - [ ] 所有外部调用有5秒超时

  **QA Scenarios**:
  ```
  Scenario: Gemini API熔断
    Tool: Bash
    Command: 模拟Gemini服务不可用，连续调用AI功能
    Expected: 5次失败后返回降级内容，不再调用Gemini
    Evidence: .sisyphus/evidence/task-7-circuit-open.json

  Scenario: 熔断恢复
    Tool: Bash
    Command: 等待30秒后再次调用
    Expected: 尝试真实调用，成功则恢复
    Evidence: .sisyphus/evidence/task-7-circuit-recovery.json
  ```

  **Commit**: YES | Message: `feat(server): add circuit breaker for external APIs`

- [ ] 8. 压力测试验证

  **What to do**: 使用Apache Bench或类似工具验证系统表现：
  - 100并发基准测试
  - 500并发压力测试
  - 1000并发突发测试（模拟实际场景）
  - 验证各功能开关效果
  - 验证静态模式效果
  - 输出性能报告

  **Must NOT do**: 不修改任何生产代码

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []
  - Omitted: frontend-dev

  **Parallelization**: NO | Wave 4 | Blocks: - | Blocked By: T1, T2, T3, T4, T5, T6, T7

  **References**:
  - Apache Bench文档
  - 当前API端点列表

  **Acceptance Criteria**:
  - [ ] 100并发：响应时间<500ms
  - [ ] 500并发：响应时间<1s，无崩溃
  - [ ] 1000并发：核心功能（wiki读/登录）可用
  - [ ] 静态模式开启后系统稳定

  **QA Scenarios**:
  ```
  Scenario: 100并发基准测试
    Tool: Bash
    Command: ab -n 1000 -c 100 http://localhost:3000/api/wiki/test-slug
    Expected: 全部成功，响应时间<500ms
    Evidence: .sisyphus/evidence/task-8-bench-100.json

  Scenario: 1000并发突发测试
    Tool: Bash
    Command: ab -n 10000 -c 1000 http://localhost:3000/api/wiki/test-slug
    Expected: 核心功能可用，记录响应时间分布
    Evidence: .sisyphus/evidence/task-8-bench-1000.json
  ```

  **Commit**: NO

## Final Verification Wave (MANDATORY)
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
每任务单独提交，提交信息遵循conventional commits规范。

## Success Criteria
1. 单台服务器在1000并发下保持不崩溃
2. Wiki阅读、注册、登录功能完全可用
3. 动态内容可按需降级为静态
4. 所有功能开关可动态调整
5. PM2多核守护正常运行
6. 数据库连接不耗尽
7. 外部API失败不导致级联崩溃
8. 压力测试验证通过
