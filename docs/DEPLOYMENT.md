# 上线部署检查清单

## 1. 环境变量

前端为 Vite 项目，所有以 `VITE_` 开头的变量会在构建时注入。

建议：本地用 `.env.local`，线上在部署平台配置环境变量。

必须配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BAIDU_MAP_AK`

注意：`VITE_SUPABASE_URL` 必须是项目根域名（形如 `https://xxxx.supabase.co`），不要带 `/rest/v1` 后缀。

可选配置：

- `VITE_SENTRY_DSN`（开启前端错误监控）
- `VITE_APP_PUBLIC_URL`（用于 Supabase 邮件跳转/回调的站点 URL）
- `VITE_SHOW_TRAE_BADGE=true`（如需显示 Trae 角标）
- `OPENAI_BASE_URL`（AI 行程规划服务端调用火山方舟的 OpenAI 兼容 Base URL）
- `OPENAI_API_KEY`（仅服务端使用，不要暴露到浏览器）
- `MODEL_NAME`（AI 行程规划使用的模型名）

仓库已提供 `.env.example` 作为模板。

## 2. 百度地图 AK

`足迹` 页面需要 `VITE_BAIDU_MAP_AK`。未配置时页面会提示“地图加载失败”。

建议使用你自己的 AK，避免额度/风控影响。

## 3. Supabase 生产安全（RLS）

生产库建议开启 RLS 并配置最小权限策略。

已提供 SQL：

- `supabase/rls_policies.sql`

执行方式：

1. 打开 Supabase Console → SQL Editor
2. 复制粘贴执行 `supabase/rls_policies.sql`
3. 验证：未登录用户只能读取公开内容；登录用户只能读写自己的数据

如果线上首页出现“暂无景区数据”，通常是 `attractions` 开启了 RLS 但没有 `select` 策略导致的。`rls_policies.sql` 已包含 `attractions` 的公开读取策略。

## 4. Supabase Auth 域名/回调

需要在 Supabase Console 配置：

1. Authentication → URL Configuration
2. 设置 Site URL（例如 `https://your-domain.com`）
3. 添加 Redirect URLs（至少包含：`https://your-domain.com/*`）

如果你使用多环境（staging/prod），两个环境都要配置对应域名。

## 5. 前端监控与错误兜底

项目已内置：

- ErrorBoundary：生产环境展示友好错误页，开发环境显示堆栈
- 全局 `error`/`unhandledrejection` 捕获

如需接入 Sentry：

1. 配置 `VITE_SENTRY_DSN`
2. 重新构建部署

## 5.1 AI 行程规划服务

项目新增了 `/api/ai-trip-plans` 服务端接口，用于代理火山方舟模型调用并完成景点库匹配。

注意：

1. `OPENAI_API_KEY` 只应配置在部署平台服务端环境变量中
2. 浏览器前端不要直接读取或注入 `OPENAI_API_KEY`
3. 若未配置 AI 相关环境变量，AI 规划页应展示明确错误提示，而不是白屏

## 6. 构建包体优化

项目已在 `vite.config.ts` 中配置 `manualChunks`，把 React、Router、Supabase、虚拟列表等拆为独立 chunk。

如仍出现 `chunk > 500k` 的提示，可继续细分或提高 `chunkSizeWarningLimit`。

## 7. Vercel 部署

### 7.1 一键部署

1. 把仓库推到 GitHub / GitLab
2. Vercel → New Project → Import
3. Framework 选择 Vite（项目已提供 `vercel.json`）

建议在 Vercel Project → Settings → General 中将 Node.js 版本设置为 `22.x`。

### 7.2 Vercel 环境变量

在 Vercel Project → Settings → Environment Variables 添加：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BAIDU_MAP_AK`
- `VITE_APP_PUBLIC_URL`（建议填你的线上域名，如 `https://your-app.vercel.app` 或自定义域名）
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `MODEL_NAME`

可选：

- `VITE_SENTRY_DSN`
- `VITE_SHOW_TRAE_BADGE=true`

注意：Vercel 的 `Production` / `Preview` / `Development` 三个环境可以分别配置。

### 7.4 常见构建失败：`npm error Exit handler never called!`

这通常发生在依赖安装阶段，是 npm CLI 的已知异常（并非业务代码报错）。

推荐处理：

1. 使用 Node `22.x`（本项目已添加 `.nvmrc` 与 `package.json#engines`）
2. 确保使用 `npm ci` 安装依赖（本项目已在 `vercel.json` 设置 `installCommand`）
3. 在 Vercel 重新部署前点击一次 "Clear build cache"

### 7.3 Supabase 侧配置

1. 执行 RLS：`supabase/rls_policies.sql`
2. 如启用 AI 规划历史，额外执行：`supabase/ai_trip_plans.sql`
3. Authentication → URL Configuration
   - Site URL：填 `VITE_APP_PUBLIC_URL`
   - Redirect URLs：至少包含 `VITE_APP_PUBLIC_URL/*`
