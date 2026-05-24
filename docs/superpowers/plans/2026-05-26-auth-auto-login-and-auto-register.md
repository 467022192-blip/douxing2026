# Auth Auto Login & Auto Register Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 注册成功后自动登录；登录失败时提示未注册并支持一键注册后自动登录。

**Architecture:** 在 `useAuthStore` 中补齐“成功后立即拉取 profile 并 set state”的逻辑，登录页增加“登录失败→确认→自动注册”的交互。保持 Email confirmations 已关闭作为前提。

**Tech Stack:** React + Zustand + Supabase Auth

---

## File Map

- Modify: `src/stores/authStore.ts`
- Modify: `src/pages/Login/index.tsx`
- Test: `npm run lint && npm run check && npm run build`

---

### Task 1: AuthStore 即时写入登录态

**Files:**
- Modify: `src/stores/authStore.ts`

- [ ] Step 1: 为 `loginWithEmail` 增加“登录成功后拉取 profile 并 set({user,isAuthenticated})”
- [ ] Step 2: 为 `registerWithEmail` 增加“注册成功且有 session 后拉取 profile 并 set({user,isAuthenticated})”
- [ ] Step 3: 处理 profile 可能短暂不可读的重试（复用现有重试策略或抽出小工具函数）

### Task 2: 登录失败引导注册并自动登录

**Files:**
- Modify: `src/pages/Login/index.tsx`

- [ ] Step 1: login 模式下登录失败时弹出 confirm（“可能未注册，是否创建并登录？”）
- [ ] Step 2: 用户确认后调用 `registerWithEmail(email, password, emailPrefix)`
- [ ] Step 3: 若注册成功：跳转 `'/profile'`；若失败：提示“邮箱可能已注册/请检查密码”

### Task 3: 验证与发布

**Commands:**
- [ ] Step 1: `npm run lint`
- [ ] Step 2: `npm run check`
- [ ] Step 3: `npm run build`
- [ ] Step 4: 本地冒烟：注册→自动登录、登录失败→确认→自动注册→自动登录
- [ ] Step 5: Commit + push 触发 Vercel 自动部署

