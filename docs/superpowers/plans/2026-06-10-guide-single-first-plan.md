# Guide Single-First Plan Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AI 攻略首屏只返回 1 套高质量方案，用户每点一次“换一换”再补 1 套，补满 3 套后切换为“重新生成”。

**Architecture:** 后端 AI 接口增加按需生成单套方案与排重上下文输入；前端结果区从一次渲染 3 套改为渐进追加；登录态下首次创建攻略，后续追加仅更新同一条已保存记录。

**Tech Stack:** React、TypeScript、Vite、Supabase、Vercel Serverless API

---

### Task 1: 扩展数据契约

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/aiTripPlannerService.ts`

- [ ] 增加 AI 攻略请求参数类型，支持 `targetCount`、`existingOptions`
- [ ] 增加服务层生成方法签名，允许首轮与追加轮共用一套调用入口

### Task 2: 改造生成接口

**Files:**
- Modify: `api/ai-trip-plans.ts`

- [ ] 让接口按 `targetCount` 只生成所需套数
- [ ] 在 prompt 中带入已存在方案标题，尽量避免“换一换”重复
- [ ] 复用现有长行程 token / 容错解析逻辑，保证 10 天长行程仍稳定
- [ ] 返回单套或追加套数对应的 `options`

### Task 3: 补齐保存更新能力

**Files:**
- Modify: `src/services/supabaseService.ts`
- Modify: `src/services/aiTripPlannerService.ts`

- [ ] 新增更新 `ai_trip_plans.result_json` 的方法
- [ ] 首轮生成后创建记录
- [ ] 追加第 2/3 套后更新同一条记录，避免生成多条重复攻略

### Task 4: 改造攻略页交互

**Files:**
- Modify: `src/pages/AITripPlanner/index.tsx`
- Modify: `src/pages/AITripPlanner/components/GuideResultCard.tsx`

- [ ] 首轮只展示 1 套方案
- [ ] 增加“补方案中”状态，与首轮生成态区分
- [ ] “换一换”每次追加 1 套，最多补到 3 套
- [ ] 满 3 套后按钮改为“重新生成”
- [ ] 追加失败时保留已生成内容，只提示失败

### Task 5: 验证

**Files:**
- Modify: `src/pages/AITripPlanner/index.tsx`（若需微调文案）

- [ ] 运行 `npm run build`
- [ ] 手动验证首轮生成 1 套、两次换一换后补满 3 套、补满后重新生成
- [ ] 检查登录态下“我的攻略”只有 1 条记录被持续更新
