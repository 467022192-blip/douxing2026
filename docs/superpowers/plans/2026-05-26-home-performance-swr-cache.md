# Home Performance (SWR Cache + Lite Fields) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首页推荐列表支持 24h 本地 SWR 缓存并减少景区列表请求体积。

**Architecture:** 将景区列表查询改为“轻字段选择”；在 `useAttractionSearch` 内实现仅对“推荐列表（无关键词/无 filterIds/全部省份）”启用 SWR 缓存，失败时不阻断已缓存数据。

**Tech Stack:** React + Zustand + Supabase

---

## File Map

- Create: `src/utils/localCache.ts`
- Modify: `src/services/supabaseService.ts`
- Modify: `src/hooks/useAttractionSearch.ts`
- Modify: `src/pages/Home/index.tsx`

---

### Task 1: 列表查询改为轻字段

**Files:**
- Modify: `src/services/supabaseService.ts`

- [ ] Step 1: 定义景区列表字段常量（id/name/province/city/lat/lng/image/ticket/open_time/price_desc）
- [ ] Step 2: 将 `getAttractions/getAttractionsByProvince/searchAttractions` 的 `select('*')` 改为轻字段
- [ ] Step 3: 保持 `getAttractionsById` 仍使用 `select('*')`（详情页需要长字段）

### Task 2: SWR 本地缓存工具

**Files:**
- Create: `src/utils/localCache.ts`

- [ ] Step 1: 实现 `getCache/setCache`，包含版本、时间戳、TTL 校验

### Task 3: useAttractionSearch 支持推荐缓存

**Files:**
- Modify: `src/hooks/useAttractionSearch.ts`

- [ ] Step 1: 当参数满足“推荐模式”（keyword 空、filterIds undefined、province=全部）时，先读缓存并 setData
- [ ] Step 2: 后台请求成功后更新 data + 写缓存；请求失败时保留已有 data
- [ ] Step 3: Home 页错误展示改为“仅无数据时才阻断”，并提供重试

### Task 4: 验证

- [ ] Step 1: `npm run lint`
- [ ] Step 2: `npm run check`
- [ ] Step 3: `npm run build`
- [ ] Step 4: 本地冷启动验证（清空 localStorage 后/弱网下）
- [ ] Step 5: Commit + push 触发 Vercel

