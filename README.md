<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 诗扶小筑 - 本地运行与部署

本项目已从 Google AI Studio 工程形态迁移为标准的 Vite + React + Express 项目。

## 本地运行

**Prerequisites:** Node.js

1. 安装依赖：
   `npm install`
2. 复制环境变量模板并填写（将 `.env.example` 复制为 `.env.local`）：
3. 启动开发环境：
   `npm run dev`

## 构建与预览

1. 生产构建：
   `npm run build`
2. 本地预览构建产物：
   `npm run preview`

## 关键环境变量

- `VITE_GEMINI_API_KEY`：Gemini API Key（前端 AI 调用）
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`（可选）
- `VITE_FIREBASE_DATABASE_ID`（可选，默认 `(default)`）
