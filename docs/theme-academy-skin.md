# 从前书院皮肤说明

## 目标

通过 `?theme=academy` 为黄诗扶生日活动提供一套独立皮肤，不改后端，仅在前端切换视觉与交互状态。

## 规则

- `?theme=academy` 优先级最高。
- URL 没有 theme 时，读取本地存储偏好。
- 仅接受 `default` 和 `academy` 两个值。
- academy 模式下，自动进入无感浏览状态，隐藏登录、注册、个人资料、管理入口。

## 已实现

- 启动时先应用 `data-theme`，减少闪烁。
- 新增 `src/lib/theme.ts` 统一处理解析、持久化和 URL 拼接。
- 新增 `ThemeContext`，供页面与导航读取当前主题。
- academy 首页提供独立开场、入口卡片与公开信息文案。
- 开发验证已通过：`npm run lint`、`npm test`、`npm run build`。

## 注意

- 站内跳转需要保留 `theme=academy` 才能维持书院模式。
- 默认主题仍保持原有行为。
