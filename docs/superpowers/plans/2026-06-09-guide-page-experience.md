# 攻略页体验优化 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化「攻略」页的生成速度、等待体验和页面视觉，同时把底部导航中的「攻略」移动到第 3 个 tab。

**Architecture:** 保持现有 `/ai-trip-planner` 路由和 `TripPlanResult` 数据结构不变；后端在 `api/ai-trip-plans.ts` 上做 prompt/参数/缓存优化，前端在 `AITripPlanner` 页增加请求状态机、分阶段提示、超时兜底和全新首屏布局，并将底部导航统一改名为「攻略」。

**Tech Stack:** React + TypeScript + Tailwind CSS + lucide-react + Vercel Serverless + Supabase

---

### Task 1: 优化攻略生成接口

**Files:**
- Modify: `api/ai-trip-plans.ts`
- Modify: `src/types/index.ts`

- [ ] Step 1: 精简 prompt 模板，减少重复约束和冗长 JSON 示例。
- [ ] Step 2: 调整模型参数，适度降低 `temperature` 和 `max_tokens`。
- [ ] Step 3: 增加景区基础数据的进程内缓存和 TTL。
- [ ] Step 4: 为模型结构失败增加 1 次轻量重试。
- [ ] Step 5: 在返回体中增加 `meta` 字段，至少包含 `totalMs`、`modelMs`、`matchMs`、`cacheHit`、`retried`。
- [ ] Step 6: 同步更新前端类型，确保 `TripPlanResult` 能安全接收新字段。
- [ ] Step 7: 用本地脚本或 `curl` 验证接口仍能稳定返回 3 套攻略和 `meta`。
- [ ] Step 8: Commit

### Task 2: 扩展前端请求状态与等待控制

**Files:**
- Modify: `src/services/aiTripPlannerService.ts`
- Modify: `src/pages/AITripPlanner/index.tsx`
- Modify: `src/types/index.ts`

- [ ] Step 1: 在前端生成请求中接入 `AbortController`。
- [ ] Step 2: 为每次生成增加 `requestId`，确保仅最新请求可写回页面。
- [ ] Step 3: 为连续相同输入增加短时间保护，避免瞬时重复发起同内容请求。
- [ ] Step 4: 在页面中实现 `idle / generating / soft-timeout / retrying / failed` 状态流转。
- [ ] Step 5: 增加分阶段提示、预计等待时间和“继续等待 / 重新生成”。
- [ ] Step 6: 对 `AbortError` 做静默处理，不作为失败提示展示。
- [ ] Step 7: 重新生成时清理旧计时器、旧错误态和旧慢请求状态。
- [ ] Step 8: 长阈值后允许编辑输入，但不影响当前请求；点击重新生成时必须读取最新输入发新请求。
- [ ] Step 9: 验证“继续等待”不会发新请求，“重新生成”会取消旧请求并发起新请求。
- [ ] Step 10: 验证取消旧请求后不会被旧结果覆盖。
- [ ] Step 11: Commit

### Task 3: 重构攻略页首屏与结果布局

**Files:**
- Modify: `src/pages/AITripPlanner/index.tsx`
- Create: `src/pages/AITripPlanner/components/GuideHero.tsx`
- Create: `src/pages/AITripPlanner/components/GuideComposer.tsx`
- Create: `src/pages/AITripPlanner/components/GuideGeneratingState.tsx`
- Create: `src/pages/AITripPlanner/components/GuideResultCard.tsx`
- Create: `src/pages/AITripPlanner/components/GuideHistoryList.tsx`

- [ ] Step 1: 将页面对外文案统一从 `AI规划` 改为 `攻略`。
- [ ] Step 2: 抽离 `GuideHero` 和 `GuideComposer`，重构首屏为“AI 主视觉 + 输入大卡片 + 更轻文案”的结构。
- [ ] Step 3: 收敛示例问题展示，只保留精选示例。
- [ ] Step 4: 抽离 `GuideGeneratingState`，承载阶段提示、预计等待时间和超时兜底操作。
- [ ] Step 5: 抽离 `GuideResultCard`，优化结果区标题、卡片层级和日程块样式。
- [ ] Step 6: 抽离 `GuideHistoryList`，将历史区调整为更下沉的“我的攻略”区域。
- [ ] Step 7: 验证移动端宽度下无折行和明显挤压。
- [ ] Step 8: Commit

### Task 4: 调整底部导航顺序、文案与图标

**Files:**
- Modify: `src/components/BottomNav/index.tsx`
- Create: `src/components/GuideTabIcon/index.tsx`

- [ ] Step 1: 将底部导航顺序改为“首页 / 行程 / 攻略 / 动态 / 我的”。
- [ ] Step 2: 把原 `AI规划` 文案统一替换为 `攻略`。
- [ ] Step 3: 接入带 AI 小角标的异形图标，替换默认 `Sparkles`。
- [ ] Step 4: 验证 active/inactive 态和 320/375/390 宽度表现。
- [ ] Step 5: Commit

### Task 5: 补充轻量观测与错误文案

**Files:**
- Modify: `src/utils/monitoring.ts`
- Modify: `src/pages/AITripPlanner/index.tsx`
- Modify: `api/ai-trip-plans.ts`

- [ ] Step 1: 在 `monitoring.ts` 中增加轻量事件上报封装，先支持开发环境 `console` 和生产环境可扩展接口。
- [ ] Step 2: 接入 `guide_page_expose`、`guide_generate_click`、`guide_generate_success`、`guide_generate_fail`。
- [ ] Step 3: 接入 `guide_soft_timeout`、`guide_hard_timeout`、`guide_continue_wait`、`guide_retry_click`。
- [ ] Step 4: 接入 `guide_save_click`、`guide_save_success`、`guide_history_open`、`guide_attraction_cache_hit`、`guide_attraction_cache_miss`。
- [ ] Step 5: 把接口 `meta` 与前端事件关联，至少能汇总 `totalMs`、`modelMs`、`matchMs`、`cacheHit`、`retried`。
- [ ] Step 6: 给最终验收准备简单统计口径，至少能人工汇总 `成功率 / 重试率 / 慢请求占比 / p50 / p90`。
- [ ] Step 7: 优化失败文案和结构失败兜底文案，避免技术提示直出。
- [ ] Step 8: Commit

### Task 6: 构建与手动验证

**Files:**
- None

- [ ] Step 1: 运行 `pnpm build`
- [ ] Step 2: 验证示例需求能成功生成 3 套攻略。
- [ ] Step 3: 验证生成中 `1s` 内出现等待反馈。
- [ ] Step 4: 验证阶段提示按阈值切换，软超时和长阈值状态可见。
- [ ] Step 5: 验证“继续等待”不发新请求，“重新生成”会取消旧请求并发起新请求。
- [ ] Step 6: 验证长阈值后修改输入不会影响当前请求，重新生成会读取新输入。
- [ ] Step 7: 验证被取消的旧请求不会覆盖新结果。
- [ ] Step 8: 验证保存攻略后，“我的攻略”可正常回显。
- [ ] Step 9: 验证底部导航顺序正确，且 `攻略` 位于第 3 个。
- [ ] Step 10: 使用 `GetDiagnostics` 检查最近修改文件无新增诊断错误。
- [ ] Step 11: 基于 `meta` 和事件日志汇总 `成功率 / 重试率 / 慢请求占比 / p50 / p90` 的首轮结果。
- [ ] Step 12: 汇总实际耗时变化和剩余风险。
