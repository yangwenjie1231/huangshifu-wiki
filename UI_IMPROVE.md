

# UI Optimization Plan for the Frontend Shell and Core Views
## TL;DR
> **Summary**: 在 Vue/Vite 前端仓库上完成“从前书院”皮肤 UI 优化与专项开发（含：全局 Shell、首页、核心页面、彩蛋与生贺业务），并确保所有 UI 美化都落地交付。
> **Deliverables**:
> - 响应式 App Shell 与导航（desktop/mobile）
> - 首页信息层级与视觉表现（书院风格；屋檐角角顶图、五大学院入口等）
> - 核心页面统一外壳与“书院化”文案/样式映射（音乐/图集/百科/演出/新闻等）
> - 彩蛋组件（红头文件公告、课外活动面板、特邀导师卡片）与生贺业务（免登录拦截、引流模块）
> - 文案换肤（轻量 i18n 映射）与主题切换（URL ?theme=academy + data-theme 驱动 CSS Variables）
> - TDD 验证与最终文档、Git 提交
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Design/Theme foundation → Shell/Navigation → Homepage → Core pages → Easter eggs/Business → Verification & Docs & Commit
## Context
### Original Request
“继续根据提示，设计UI优化方案” + 完成后验证、写文档、提交到 GitHub 仓库 Once-Upon-An-Academy。
### Interview Summary
- Scope: 全量 UI 优化 + 书院皮肤专项；desktop + mobile。
- Priority: 视觉层级、交互/动效与性能同步完成。
- Verification: TDD + Vitest 单测；去掉 Playwright。
### Repo Context（基准仓库）
- 仓库：https://github.com/miaopan607/Once-Upon-An-Academy
- 技术栈：Vue 3 + Vite + TypeScript + vue-router（Language bar: Vue/CSS/TS/HTML）。
- 入口与关键文件：
  - src/main.ts：创建 Vue 应用、挂载 router、引入全局样式 src/style.css。
  - src/App.vue：全局壳子（Header、移动菜单、Toast、router-view）。
  - src/router/index.ts：路由配置（当前仅 / 与 /recruit）。
  - src/views/：页面组件目录（当前 Home、Recruit）。
---
## Work Objectives
### Core Objective
让“从前书院”皮肤在 desktop/mobile 上体验完整、视觉统一，并完成所有 UI 美化与生贺业务落地，最终验证、记录并提交到仓库。
### Deliverables
- 稳定的主题/样式基础（CSS Variables、全局字体/间距/动效基线）。
- 响应式 App Shell（Header/Nav/移动菜单/底部 Chrome），适配安全区与 thumb-friendly。
- 首页书院化 UI（Hero、五大学院入口、开篇/介绍文案、屋檐顶图）。
- 核心页面“书院化”文案与统一外壳（音乐/图集/百科/演出/新闻/搜索/个人/管理）。
- 彩蛋与业务组件（红头文件公告、课外活动面板、特邀导师卡片、采集时间戳、免登录拦截、引流模块）。
- 轻量文案换肤（locales/*.json）与 URL ?theme= 切换（data-theme）。
- Vitest 单测覆盖关键主题/导航/路由/展示逻辑。
- 完成后的验证记录与文档，以及 Git 提交到仓库。
### Definition of Done（命令级）
- `npm run lint` 通过。
- `npm test` 通过。
- `npm run build` 通过。
- 所有 UI 美化完成（见 Success Criteria）。
### Must Have
- Desktop/mobile 均可用；安全区与触控友好。
- 无占位图/外部媒体 URL；无 Lorem ipsum 文案。
- 可访问的焦点态与键盘导航。
- 统一间距/排版/按钮层级与 CSS Variables 体系。
### Must NOT Have（护栏与边界）
- 不动后端/API/Schema；如需 UI 状态可微调。
- 不引入与现有品牌色系冲突的新视觉系统。
- 不使用占位资源与假文案。
- 不忽略 reduced-motion 偏好。
- 不搞“只好看、没单测”的重设计。
- 不使用 Playwright；验证以 Vitest 为主，辅以手动确认。
---
## Verification Strategy
> ZERO HUMAN INTERVENTION（自动化部分）
- 测试决策：TDD + Vitest（覆盖主题、路由守卫、壳子状态、展示文案/状态、免登录拦截逻辑等）。
- QA 策略：每个任务包含“通过”与“异常/边界”场景。
- 证据路径：`.sisyphus/evidence/task-{N}-{slug}.log` 或 `.sisyphus/evidence/task-{N}-{slug}.md`。
> “完成后验证 → 写文档 → 提交仓库”三步（见末节 Final Step）：
1) 运行完整验证（lint/test/build）；2) 生成验证记录文档；3) Git 提交并推送到 Once-Upon-An-Academy。
---
## Execution Strategy
### Parallel Execution Waves
- Wave 1：基建与主题基础（含主题读取/data-theme/CSS Variables/文案映射框架）
- Wave 2：全局壳与导航；首页书院化
- Wave 3：核心页面外壳统一 + 彩蛋/生贺业务 + 单测与文档提交
### Dependency Matrix（完整）
- Task 1 阻塞 2–6。
- Task 2 阻塞 3、4。
- Task 3 阻塞 5。
- Task 4、5 阻塞 6。
### Agent Dispatch Summary（wave → count → categories）
- Wave 1 → 2 tasks → `quick`, `unspecified-high`
- Wave 2 → 2 tasks → `visual-engineering`, `quick`
- Wave 3 → 2 tasks → `visual-engineering`, `quick`
---
## TODOs
> 实现与测试 = 一个任务；每个任务必须包含：Agent Profile + Parallelization + QA Scenarios。
---
- [ ] 1. 建立主题/样式基础与文案换肤框架（基建）
**What to do**:
- 引入 URL 参数读取逻辑，封装为组合式函数（例如 `useThemeFromUrl`）：
  - 优先读取 `window.location.search` 中的 `?theme=` 参数。
  - 将 theme 值同步挂载到 `<html>` 的 `data-theme` 属性，用于驱动 CSS Variables。
  - 切换时使用 `router.replace`（vue-router）或 `history.replaceState`，不刷新页面。
  - 可选降级：URL 无参数时读取 localStorage 用户偏好。
- 在 src/style.css 中建立 CSS Variables 体系，并在 :root 与 `[data-theme="academy"]` 中定义完整映射（颜色、背景、字体、圆角、阴影、顶图等），并把现有“硬编码”颜色迁移到变量。
- 建立文案映射框架：`src/locales/default.json` 与 `src/locales/academy.json`；封装 `useI18n()` 或等效方案。
- 添加/完善 Vitest 用例（主题解析、data-theme 同步、文案映射函数）。
**Must NOT do**: 不做页面重设计；不改后端。
**Recommended Agent Profile**:
- Category: `quick`
- Reason: 基建代码量小，结构清晰。
- Skills: []（可选 `frontend-dev`）
**Parallelization**: 可并行：NO | Wave 1 | 阻塞：2–6 | 被阻塞：无
**References**:
- 入口：`src/main.ts`（挂载 App、引入全局样式、router）。
- 样式：`src/style.css`（全局样式）。
- 路由：`src/router/index.ts`（路由配置）。
- 根组件：`src/App.vue`（可在此读取 query.theme 并挂载 data-theme）。
**Acceptance Criteria**:
- [ ] 主题从 URL ?theme=academy 正确读取并同步到 `<html data-theme="academy">`。
- [ ] CSS Variables 覆盖主色、背景色、字体、卡片圆角、阴影、顶图（默认 vs 书院）。
- [ ] 文案映射在两套 JSON 间可切换，组件中不再硬写 UI 文本。
- [ ] `npm test && npm run lint` 通过。
**QA Scenarios**:
```
Scenario: theme 与文案映射单元验证
Tool: Bash
Steps: 运行 `npm test`；检查 useThemeFromUrl 与 i18n 相关用例。
Expected: 全部通过。
Evidence: .sisyphus/evidence/task-1-foundation.log
```
**Commit**: YES（可选） | 消息：`feat(ui): establish theme/i18n/CSS Variables foundation` | 文件：`src/style.css`, `src/main.ts`, `src/App.vue`, `src/locales/*`, `tests/unit/*`（如新建）
---
- [ ] 2. 重做全局壳与导航（Shell/Navigation）
**What to do**:
- 改造 `src/App.vue` 的 Header/Nav、移动菜单、Toast 等壳子，使之更简洁、少干扰、小屏友好（安全区、thumb-friendly）。
- 在壳子里增加“入梦/出梦”切换按钮（使用 history.replaceState 或 router.replace 修改 ?theme= 参数，无刷新）。
- 确保底部播放器/Footer 不会与主内容重叠。
- 保持现有路由不变，不增加新路由。
**Must NOT do**: 不重写鉴权逻辑（本次不涉及）；不改后端。
**Recommended Agent Profile**:
- Category: `visual-engineering`
- Reason: 壳子是高频视觉面。
- Skills: [`frontend-dev`]
**Parallelization**: 可并行：YES | Wave 2 | 阻塞：3–4 | 被阻塞：1
**References**:
- `src/App.vue`：Header、移动菜单、Toast、router-view 布局。
- `src/router/index.ts`：路由定义。
**Acceptance Criteria**:
- [ ] Header 层级更清晰；移动端菜单安全区适配。
- [ ] 底部/Footer 不会在短视口时遮挡内容。
- [ ] “入梦/出梦”按钮能无刷新切换 URL 参数并立即反映 UI 与文案。
- [ ] `npm run build` 通过。
**QA Scenarios**:
```
Scenario: 壳子构建验证
Tool: Bash
Steps: 运行 `npm run build`。
Expected: 无类型/导入错误。
Evidence: .sisyphus/evidence/task-2-shell-build.log
```
**Commit**: YES | 消息：`feat(ui): streamline global shell navigation` | 文件：`src/App.vue`, `src/style.css`, `src/router/index.ts`（若微调）
---
- [ ] 3. 首页“书院化”UI 与信息层级
**What to do**:
- 重构 `src/views/Home.vue`（或拆分为 DefaultHome 与 AcademyHome 并条件渲染）：
  - 顶部视觉：写实屋檐角角古建顶图（建议放到 `public/` 或本地引入）。
  - 开篇文案与书院总体介绍（按任务手册第2、3点）。
  - 五大学院“入学引导图/入口卡”。
  - 去除原“最新动态瀑布流”；改为书院化的招生/学院入口流。
- 强化 Hero/CTA 层级；统一 loading/empty 状态。
**Must NOT do**: 不改后端 feed 接口契约。
**Recommended Agent Profile**:
- Category: `visual-engineering`
- Reason: 首页信息层级重，视觉权重高。
- Skills: [`frontend-dev`]
**Parallelization**: 可并行：YES | Wave 2 | 阻塞：5 | 被阻塞：1–2
**References**:
- `src/views/Home.vue`（当前首页）。
- `src/App.vue`（壳子结构）。
**Acceptance Criteria**:
- [ ] Hero/学院入口/CTA 形成统一层级。
- [ ] 顶图为屋檐角角古建写真；文案为书院语境。
- [ ] loading/empty 状态明确且与整体视觉一致。
- [ ] `npm test` 通过（首页相关单元/渲染测试）。
**QA Scenarios**:
```
Scenario: 首页逻辑测试
Tool: Bash
Steps: `npm test`（针对 Home 组件）。
Expected: 用例通过。
Evidence: .sisyphus/evidence/task-3-home-logic.log
```
**Commit**: YES | 消息：`feat(ui): refine homepage academy hierarchy` | 文件：`src/views/Home.vue`, `tests/unit/Home.test.*`
---
- [ ] 4. 核心页面外壳统一与“书院化”映射
**What to do**:
- 对 Wiki/Forum/Music/Gallery/Search/Profile/Admin 等页面统一外壳（标题/间距/卡片/列表）。
- 按映射表替换模块名与字段名（示例）：
  - 音乐/歌曲 → 音乐学院 · 练习技艺的花园
  - 图集/二创 → 美术学院 · 日常起居
  - 百科/词条 → 国学院 · 读书的楼
  - 演出/行程 → 体育学院 · 练武的走廊
  - 新闻/采访 → 藏经阁 · 入梦课
- 保持各页面独特性，避免过度抽象。
**Must NOT do**: 不抹平页面个性；不改后端。
**Recommended Agent Profile**:
- Category: `quick`
- Reason: 主要是模式统一与 UI 清理。
- Skills: [`frontend-dev`]
**Parallelization**: 可并行：YES | Wave 3 | 阻塞：6 | 被阻塞：1–2
**References**:
- `src/views/*` 相关页面（含 Home、Recruit；后续可能新增 Wiki/Forum/Music/Gallery 等）。
**Acceptance Criteria**:
- [ ] 标题/间距/卡片在各页面一致。
- [ ] 模块名按映射表替换。
- [ ] 移动端无横向溢出。
- [ ] `npm run build` 通过。
**QA Scenarios**:
```
Scenario: 页面结构完整性验证
Tool: Bash
Steps: `npm run build`。
Expected: 构建通过。
Evidence: .sisyphus/evidence/task-4-pages-build.log
```
**Commit**: YES | 消息：`refactor(ui): normalize core page shells with academy naming` | 文件：`src/views/*`, `src/locales/*`
---
- [ ] 5. 彩蛋组件与生贺业务逻辑
**What to do**:
- 开发彩蛋组件（仅在 academy 主题渲染）：
  - 红头文件公告组件：样式“从前书院招生办红头文件”（红头、公章彩蛋），用于发布上海巡演等通知。
  - 课外活动悬浮面板：课前预习/随堂小测/课后作业/课间休息等入口。
  - 特邀导师卡片：人物立绘/剪影 + 竖排古风简介（杜丽娘/柳梦梅、宝黛、梁祝、项羽/虞姬、卿卿）。
- 数据层对接（不改后端）：
  - 音乐：调用 `/api/music`，按播放量排序取前 20；表头改为“修习人次”；图表下方标注“数据采集时间：2026年X月X日”。如有“赠EP给上师大”等标签，高亮为“书院特别事迹”。
  - 演出：调用 `/api/events` 或演出接口；包装为“优秀毕业生黄诗扶登台历练记录”，时间轴展示。
  - 联系我们：纯前端静态；招生办“卿主任”，电话/邮箱可包含数字彩蛋。
- 生贺业务：
  - 绝对免登录拦截：当 `?theme=academy` 时跳过登录，隐藏登录/评论/收藏/发帖按钮；保留阅读/播放/浏览。
  - Wiki 预告引流：底部放置“诗扶小筑·长期百科”入口卡片/小程序码，点击后切换为 `?theme=default`。
**Must NOT do**: 不改后端接口；不做像素级脆弱测试。
**Recommended Agent Profile**:
- Category: `visual-engineering`
- Reason: UI 丰富、交互多，但逻辑边界清晰。
- Skills: [`frontend-dev`]
**Parallelization**: 可并行：YES | Wave 3 | 阻塞：6 | 被阻塞：1–4
**References**:
- API 模式：`/api/music`、`/api/events`（文档/类型定义）。
- 主题/路由逻辑：`src/router/index.ts`、`src/App.vue`（用于守卫）。
**Acceptance Criteria**:
- [ ] 三类彩蛋组件仅在 academy 主题可见。
- [ ] 音乐/演出数据展示文案“书院化”，含采集时间戳。
- [ ] ?theme=academy 时免登录且相关按钮隐藏；引流按钮可切换回 ?theme=default。
- [ ] `npm test` 通过（路由守卫、免登录、文案映射测试）。
**QA Scenarios**:
```
Scenario: 生贺业务逻辑测试
Tool: Bash
Steps: 运行 `npm test`（针对守卫/免登录/文案映射）。
Expected: 通过。
Evidence: .sisyphus/evidence/task-5-business-logic.log
```
**Commit**: YES | 消息：`feat(ui): add academy easter eggs and birthday business rules` | 文件：`src/views/*`, `src/components/*`, `src/router/index.ts`, `tests/unit/*`
---
- [ ] 6. 单测回归与最终验证（TDD + 文档 + 提交）
**What to do**:
- 扩展 Vitest 覆盖：
  - 主题/data-theme 挂载逻辑。
  - 路由守卫（免登录、引流）。
  - 关键组件（Header/Nav/首页/彩蛋组件）状态与边界。
- 最终验证：
  - `npm run lint && npm test && npm run build` 全部通过。
- 文档与提交：
  - 在仓库中新建 `docs/UI-optimization-and-skin-report.md`，记录：
    - 验证命令与结果摘要（含时间）。
    - 关键改动清单（文件/功能）。
    - 已知问题与后续 TODO（如有）。
  - 将改动提交到 `Once-Upon-An-Academy`（远程分支/PR 可选）。
**Must NOT do**: 不加 Playwright；不写过度脆弱快照。
**Recommended Agent Profile**:
- Category: `quick`
- Reason: 验证与文档导向，变更量小。
- Skills: []
**Parallelization**: 可并行：NO | Wave 3 | 阻塞：无 | 被阻塞：1–5
**References**:
- 现有测试示例：`tests/unit/*`（风格/命名参考）。
- 仓库：https://github.com/miaopan607/Once-Upon-An-Academy。
**Acceptance Criteria**:
- [ ] `npm run lint && npm test && npm run build` 均通过。
- [ ] 单测覆盖新增主题/守卫/彩蛋/文案逻辑。
- [ ] 验证报告写入 `docs/UI-optimization-and-skin-report.md`。
- [ ] 成功推送到远程仓库（建议在本地 master 或 feature 分支）。
**QA Scenarios**:
```
Scenario: 最终回归与构建验证
Tool: Bash
Steps: `npm run lint && npm test && npm run build`。
Expected: 全部成功。
Evidence: .sisyphus/evidence/task-6-final-regression.log
```
**Commit**: YES | 消息：`docs(ui): add UI optimization and skin verification report` | 文件：`docs/UI-optimization-and-skin-report.md`, `tests/unit/*`, 其他改动文件
---
## Final Step（完成后：验证 → 文档 → 提交）
在 Task 6 完成时，明确执行以下三步（可在同一任务内完成）：
1) 验证
   - 在仓库根目录执行：
     - `npm run lint`
     - `npm test`
     - `npm run build`
   - 确保全部成功（可使用本地或 CI 环境）。证据目录：`.sisyphus/evidence/`。
2) 文档
   - 在 `docs/UI-optimization-and-skin-report.md` 中至少包含：
     - 执行时间与仓库版本/Commit SHA。
     - 三条命令的执行结果摘要（通过/失败）。
     - 本次 UI 优化与“从前书院”皮肤落地的改动清单（文件/模块/功能点）。
     - 后续优化建议（如有）。
3) 提交到 GitHub 仓库
   - 提交到本地后推送到远程仓库：
     - `git add .`
     - `git commit -m "docs(ui): add UI optimization and skin verification report"`
     - `git push origin master`（或目标分支）。
   - 若使用 PR，则在 PR 描述中引用 `docs/UI-optimization-and-skin-report.md`。
---
## Final Verification Wave（MANDATORY — 全部实施任务后）
> 4 个审查 Agent 并行；全部 APPROVE 后，向用户展示汇总结果并得到明确“可以”后才能结束。
> - 不自动继续；等待用户明确同意。
> - 不要在用户同意前勾选 F1–F4。
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Visual/Mobile Structure Review — unspecified-high（可辅以截图/录屏）
- [ ] F4. Scope Fidelity Check — deep
---
## Commit Strategy
- 规划产物本身无需提交。
- 执行阶段每个任务完成后按“Commit”建议提交（保持提交粒度与改动面一致）。
- 最终“验证 + 文档 + 提交”在 Task 6 完成。
---
## Success Criteria
- Shell 在 desktop/mobile 更简洁、意图明确。
- 首页书院化 UI 完整落地（屋檐顶图、五大学院入口、开篇/介绍文案）。
- 核心页面共享可识别的结构，但保留各自内容特色；模块名按映射表替换。
- 彩蛋与生贺业务（红头文件、课外活动、导师卡片、采集时间戳、免登录、引流）按需可见。
- 主题与文案可基于 `?theme=` 与 `data-theme` 即时切换，无刷新。
- 单测、lint、build 均通过；验证报告写入仓库并推送成功。
```
