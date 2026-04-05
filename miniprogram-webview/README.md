# Mini Program WebView Shell

This folder contains a minimal WeChat Mini Program shell that opens the web app in a `<web-view>` and performs `wx.login` before redirect.

## Setup

1. Create or use a WeChat Mini Program app in WeChat Official Platform.
2. Add your web domain to **Business Domain**.
3. Open this folder in WeChat DevTools.
4. Update `config.js` with your production H5 URL.

## Login Flow

1. `pages/index` calls `wx.login()`.
2. It redirects to `pages/webview` and passes `wx_code`.
3. `pages/webview` loads `${WEB_APP_URL}?wx_code=...`.
4. The web app auto-calls `/api/auth/wechat/login`.

## Optional profile forwarding

The current implementation only forwards `wx_code`.
If you want nickname/avatar syncing on first login, extend the index page to call `wx.getUserProfile` and append:

- `wx_display_name`
- `wx_photo_url`

The web app already supports these optional query params.
