# 自测清单（上线前）

## 0. 环境准备

- Vercel Production 环境变量已配置：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_BAIDU_MAP_AK`（可选：`VITE_APP_PUBLIC_URL`、`VITE_SENTRY_DSN`）
- Supabase 已执行 `supabase/rls_policies.sql`

## 1. 页面冒烟（未登录）

- 首页：能看到景区列表；搜索/省份筛选可用；滚动不卡顿
- 景区详情页：`/attraction/:id` 可正常打开，简介/图片有兜底
- 足迹页：地图可加载；筛选切换后点位正常；点击点位可跳详情
- 动态页：公开动态列表可加载
- 我的页：未登录提示合理；不应出现控制台报错

## 2. 账号与权限（登录后）

- 登录/注册：能正常完成；回调 URL 正确（建议配置 `VITE_APP_PUBLIC_URL` + Supabase Redirect URLs）
- 我的页：隐私开关可切换；昵称可编辑
- 打卡：想去/去过按钮可用；刷新后状态保持

## 3. 关键异常场景

- 缺少 `VITE_BAIDU_MAP_AK`：足迹页应提示“地图加载失败”而不是白屏
- Supabase URL 填错或带 `/rest/v1`：应提示“景区数据加载失败”并在控制台打印错误
- 网络较慢：列表骨架/加载态可接受，页面不应冻结

## 4. 构建与质量门禁

- `npm run lint`（无 error）
- `npm run check`
- `npm run build`

