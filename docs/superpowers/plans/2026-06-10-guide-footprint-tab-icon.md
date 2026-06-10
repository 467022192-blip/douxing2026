# Guide Footprint Tab Icon Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将底部 `攻略` tab 改为更突出的「足迹 + AI」主入口图标。

**Architecture:** 保持现有 `BottomNav` 结构不变，只重做 `GuideTabIcon` 的 SVG 造型，并对 `攻略` tab 做局部尺寸与配色强化。避免影响其它 tab 的布局与交互。

**Tech Stack:** React, TypeScript, Tailwind CSS

---

### Task 1: 重做图标造型

**Files:**
- Modify: `src/components/GuideTabIcon/index.tsx`

- [ ] 将山峰轮廓替换为单只足迹轮廓
- [ ] 保留右上角 `AI` badge
- [ ] 使用 `A` 配色方向强化激活态表现

### Task 2: 强化底部主入口

**Files:**
- Modify: `src/components/BottomNav/index.tsx`

- [ ] 仅对 `攻略` tab 放大 icon 与文字权重
- [ ] 让激活态比其它 tab 更显眼，但不破坏整体对齐

### Task 3: 验证

**Files:**
- Modify: `src/components/GuideTabIcon/index.tsx`
- Modify: `src/components/BottomNav/index.tsx`

- [ ] 检查 VS Code diagnostics
- [ ] 运行 `npm run build`
