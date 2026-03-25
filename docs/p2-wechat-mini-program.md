# P2 微信登录与小程序精简端说明

本文档对应 P2 第一优先级任务：微信登录 + 小程序最小闭环。

## 1. 已上线后端能力

- 微信登录接口：`POST /api/auth/wechat/login`
- 小程序专用接口：
  - `GET /api/mp/wiki`
  - `POST /api/mp/posts`
  - `POST /api/mp/comments`

## 2. 环境变量

在 `.env` 或 `.env.local` 中增加：

```env
WECHAT_MP_APPID=""
WECHAT_MP_APP_SECRET=""
WECHAT_LOGIN_MOCK="false"
```

说明：

- `WECHAT_MP_APPID` / `WECHAT_MP_APP_SECRET`：微信小程序凭据，用于 `code2session`。
- `WECHAT_LOGIN_MOCK=true`：开发调试模式，不调用微信网关，可使用 mock code 登录。

## 3. 微信登录接口

### 3.1 请求

`POST /api/auth/wechat/login`

```json
{
  "code": "wx.login 获取到的 code",
  "displayName": "可选昵称",
  "photoURL": "可选头像 URL"
}
```

### 3.2 开发模式（mock）

当 `WECHAT_LOGIN_MOCK=true` 时：

- `code = "mock:openId"`
- `code = "mock:openId:unionId"`

服务端会直接解析 openId/unionId 创建或登录账号。

### 3.3 账号绑定规则

- 优先按 `wechatOpenId` 查找账号。
- 若请求包含 `unionId`，会一起参与匹配。
- 首次登录自动创建本地账号（占位邮箱：`{openid}@wechat.local`）。

## 4. 小程序接口约定

### 4.1 `GET /api/mp/wiki`

查询参数：

- `category`：默认 `all`
- `page`：默认 `1`
- `limit`：默认 `20`，最大 `100`

仅返回 `published` 内容。

### 4.2 `POST /api/mp/posts`

请求体：

```json
{
  "title": "标题",
  "section": "music",
  "content": "markdown 内容",
  "tags": ["tag1", "tag2"]
}
```

行为：

- 普通用户创建为 `pending` 并记录 `ModerationLog.submit`。
- 管理员创建为 `published`。

### 4.3 `POST /api/mp/comments`

请求体：

```json
{
  "postId": "帖子 ID",
  "content": "评论内容",
  "parentId": null
}
```

仅允许对已发布帖子评论。

## 5. 前端联调入口

Web 导航登录弹窗已增加“微信登录”模式，支持输入：

- `wx.login code`
- 可选昵称
- 可选头像 URL

用于在无小程序客户端时进行后端联调。

## 6. 验收建议

- 使用 `WECHAT_LOGIN_MOCK=true` 完成一轮登录、发帖、评论闭环。
- 再切换真实 `APPID/SECRET` 测试 `code2session`。
- 确认新字段 `wechatOpenId` / `wechatUnionId` 已落库并建立索引。
