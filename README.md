# 行程（足迹）

一个面向中国 5A 景区的移动端旅行打卡 Web 应用。项目最初名为「足迹」，当前产品文案逐步调整为「行程」。用户可以浏览景区、标记想去/去过、在地图上查看旅行足迹、规划路线，并在动态页分享旅行内容。

## 功能概览

- **景区浏览**：首页展示景区列表，支持关键词搜索、省份筛选和状态筛选。
- **景区详情**：查看景区图片、简介、开放时间、票价、地址等信息。
- **打卡状态**：登录后可将景区标记为「想去」或「去过」，状态会同步到 Supabase。
- **地图足迹**：基于百度地图展示全国景区点位，区分未标记、想去和去过状态。
- **路线规划**：选择多个景区生成行程路线，支持保存和搜索本地路线。
- **动态社区**：发布旅行动态、上传图片、点赞、评论，并支持图片大图预览。
- **账号系统**：使用 Supabase Auth 支持邮箱登录、注册、注册后自动登录，以及游客体验模式。
- **性能优化**：首页推荐列表支持本地 SWR 缓存，列表查询使用轻字段降低请求体积。

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand
- Supabase Auth / Database / Storage
- 百度地图 JavaScript API
- Framer Motion
- react-window
- Vercel

## 项目结构

```text
src/
  components/        通用组件，如底部导航、顶部搜索统计栏、图片预览弹窗
  config/            环境变量读取与校验
  constants/         省份等常量
  data/              本地景区 mock 数据
  hooks/             景区搜索和主题等自定义 Hook
  lib/               Supabase client 和通用工具
  pages/             页面模块：首页、详情、行程、路线规划、动态、我的、登录
  services/          Supabase 数据访问层
  stores/            Zustand 状态管理
  types/             业务类型和 Supabase 类型
  utils/             百度地图、本地缓存、测试辅助和监控工具
supabase/            数据库 schema、RLS、Storage 和修复脚本
docs/                部署、自测、数据处理和功能设计文档
scripts/             数据迁移、景区信息补全、图片刷新和导出脚本
public/              静态资源
```

## 环境要求

- Node.js 24.x
- pnpm 9.x（项目声明的包管理器）
- Supabase 项目
- 百度地图 Web 服务 AK

也可以使用 npm 运行现有脚本；当前仓库同时包含 `package-lock.json` 和 `pnpm-lock.yaml`。

## 环境变量

复制 `.env.example` 到 `.env.local`，并填写必要配置：

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BAIDU_MAP_AK=

VITE_SENTRY_DSN=
VITE_APP_PUBLIC_URL=
VITE_SHOW_TRAE_BADGE=

OPENAI_BASE_URL=
OPENAI_API_KEY=
MODEL_NAME=
```

必填：

- `VITE_SUPABASE_URL`：Supabase 项目根地址，例如 `https://xxxx.supabase.co`。
- `VITE_SUPABASE_ANON_KEY`：Supabase anon key。
- `VITE_BAIDU_MAP_AK`：百度地图浏览器端 AK，用于行程地图和路线规划。

可选：

- `VITE_SENTRY_DSN`：开启前端错误监控。
- `VITE_APP_PUBLIC_URL`：用于 Supabase 邮件回调和站点跳转。
- `VITE_SHOW_TRAE_BADGE`：是否显示 Trae 角标。
- `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `MODEL_NAME`：用于景区简介生成脚本。

## 本地开发

安装依赖：

```bash
pnpm install
```

启动开发服务器：

```bash
pnpm run dev
```

常用命令：

```bash
pnpm run lint     # ESLint 检查
pnpm run check    # TypeScript 检查
pnpm run build    # 生产构建
pnpm run preview  # 本地预览构建产物
```

如果使用 npm：

```bash
npm install
npm run dev
npm run lint
npm run check
npm run build
```

## Supabase 初始化

核心 SQL 位于 `supabase/` 目录：

- `supabase/schema.sql`：基础表结构、索引、触发器和 RLS 策略。
- `supabase/space_schema.sql`：动态、点赞、评论相关表结构和策略补充。
- `supabase/rls_policies.sql`：生产 RLS 最小权限策略。
- `supabase/storage_setup.sql`：图片上传 Storage 配置。

建议上线前确认：

1. 已创建并迁移 `attractions`、`profiles`、`user_checkins`、`posts`、`likes`、`comments` 等表。
2. 已开启并验证 RLS 策略。
3. 已配置公开或受控访问的图片 Storage bucket。
4. Supabase Auth 已配置正确的 Site URL 和 Redirect URLs。

更多部署事项见 `docs/DEPLOYMENT.md`。

## 数据和图片脚本

项目包含若干数据处理脚本：

- `scripts/migrate_attractions.mjs`：迁移景区数据。
- `scripts/enrich_attractions.mjs`：补充景区字段。
- `scripts/fetch_and_summarize_baike.mjs`：抓取百科信息并生成精简简介。
- `scripts/refresh_attraction_images.py`：批量更新景区图片，支持 Supabase Storage。
- `scripts/export_attractions_excel.mjs`：导出景区数据。

图片刷新说明见 `docs/refresh-attraction-images.md`。

## 上线与自测

上线前建议依次执行：

```bash
pnpm run lint
pnpm run check
pnpm run build
```

并按以下文档完成检查：

- `docs/QA_CHECKLIST.md`：上线前自测清单。
- `docs/DEPLOYMENT.md`：Vercel、环境变量、Supabase 和监控配置说明。

## 当前开发状态

项目核心 MVP 已基本成型：景区浏览、详情、打卡、地图、路线规划、动态社区和账号系统均已接入。后续重点建议放在：

1. 完成完整 QA 和线上 Supabase 配置核对。
2. 整理根目录中的临时测试脚本。
3. 优化动态页和路线规划的异常兜底。
4. 补充自动化测试或关键用户路径 e2e 测试。
