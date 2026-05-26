# 动态页（Space）UI 优化 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在动态页实现图片大图预览、时间显示到分钟、发布 icon 简化、去掉顶部用户信息。

**Architecture:** 在 `Space` 页接入一个轻量 `ImagePreviewModal` 组件；其余均为 UI 与格式化逻辑调整。

**Tech Stack:** React + TypeScript + Tailwind + lucide-react

---

### Task 1: 新增图片预览组件

**Files:**
- Create: `src/components/ImagePreviewModal/index.tsx`

- [ ] Step 1: 实现 `ImagePreviewModal`（open/close、图片切换、Esc 关闭）
- [ ] Step 2: 手动验证：在本地打开任意页面渲染该组件无报错

### Task 2: Space 页面接入图片预览

**Files:**
- Modify: `src/pages/Space/index.tsx`

- [ ] Step 1: 增加预览状态（images/index/open）
- [ ] Step 2: 点击九宫格图片时打开预览 modal
- [ ] Step 3: 验证：多图可左右切换；点击遮罩/关闭按钮可退出

### Task 3: 时间显示到分钟

**Files:**
- Modify: `src/pages/Space/index.tsx`

- [ ] Step 1: 将 `formatTime` 输出改为 `M月D日HH:mm`
- [ ] Step 2: 覆盖动态与评论的时间展示

### Task 4: 顶部栏样式调整

**Files:**
- Modify: `src/pages/Space/index.tsx`

- [ ] Step 1: 移除 header 左侧用户头像/昵称，固定显示“动态”
- [ ] Step 2: 右上发布按钮改为相机 icon-only，保持原点击逻辑

### Task 5: 验证

**Files:**
- None

- [ ] Step 1: 本地 `npm run dev` 打开 `/space` 进行交互验证
- [ ] Step 2: 检查浏览器控制台无 error/warn

