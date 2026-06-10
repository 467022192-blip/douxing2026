# Home And Space Min Images Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为首页景区卡片和动态列表接入 min 图片优先链路，在保留原图质量的前提下降低首屏图片加载耗时。

**Architecture:** 首页景区图采用“优先读取 min 字段，缺失时回退原图”的兼容方案；动态图片改成“每张图保存 original + min”的结构，并在上传阶段前端同步生成缩略图上传。老数据保持可读，不要求一次性迁移。

**Tech Stack:** React, TypeScript, Supabase Storage, Supabase Postgres JSON, Canvas 图片压缩

---

### Task 1: 图片数据结构与类型

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/supabaseService.ts`

- [ ] 定义动态图片对象类型，支持 `original` 与 `min`
- [ ] 为景区类型补充 `image_url_min`
- [ ] 为 `Post.images` 增加兼容读取逻辑，允许老字符串数组与新对象数组共存

### Task 2: 首页景区图 min 优先

**Files:**
- Modify: `src/pages/Home/index.tsx`
- Modify: `src/services/supabaseService.ts`

- [ ] 查询景区列表时把 `image_url_min` 一起取回
- [ ] 列表图片优先显示 `image_url_min`
- [ ] 当 `image_url_min` 缺失时回退原图，不影响现有线上数据

### Task 3: 动态上传与列表缩略图

**Files:**
- Modify: `src/pages/Space/index.tsx`
- Modify: `src/services/supabaseService.ts`
- Create: `src/utils/imageVariants.ts`

- [ ] 新增前端缩略图生成工具，输出适合列表的压缩版文件
- [ ] 发布动态时同时上传原图和 min 图
- [ ] 动态列表显示 min 图，图片预览继续使用原图
- [ ] 保持老动态字符串数组可正常展示

### Task 4: 验证

**Files:**
- Modify: `src/pages/Home/index.tsx`
- Modify: `src/pages/Space/index.tsx`
- Modify: `src/services/supabaseService.ts`
- Modify: `src/types/index.ts`
- Create: `src/utils/imageVariants.ts`

- [ ] 运行 `npm run build`
- [ ] 检查 recently edited files diagnostics
- [ ] 手工验证首页卡片与动态列表仍能回退展示旧图片数据
