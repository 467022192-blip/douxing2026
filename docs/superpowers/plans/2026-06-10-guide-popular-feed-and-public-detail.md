# Guide Popular Feed And Public Detail Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real, clickable "热门攻略" feed that supports platform/public entries and personal saved entries, while keeping generation progress and results above the feed.

**Architecture:** Add a minimal public popular-guide API layer without weakening `ai_trip_plans` RLS, then update the guide page to render a two-column vertical feed backed by real detail IDs. Reuse the existing detail route and extend its data loader to resolve both private saved plans and public popular plans.

**Tech Stack:** React, TypeScript, Vite, Supabase, Vercel Serverless API, Tailwind CSS

---

### Task 1: Add Public Popular Guide API

**Files:**
- Create: `api/popular-trip-plans/index.ts`
- Create: `api/popular-trip-plans/[id].ts`
- Create: `src/data/popularTripPlans.ts`

- [ ] **Step 1: Define the public popular guide payload**

```ts
export type PublicPopularTripPlan = {
  id: string;
  title: string;
  inputQuery: string;
  summary: string;
  coverPrompt: string;
  createdAt: string;
  result: TripPlanResult;
};
```

- [ ] **Step 2: Add curated public guide seeds**

```ts
export const POPULAR_TRIP_PLAN_SEEDS = [...]
```

- [ ] **Step 3: Create list API**

Run behavior: `GET /api/popular-trip-plans` returns brief cards with `id`, `title`, `summary`, `coverPrompt`, `createdAt`.

- [ ] **Step 4: Create detail API**

Run behavior: `GET /api/popular-trip-plans/:id` returns the full guide detail payload for a public hot guide.

- [ ] **Step 5: Commit**

```bash
git add api/popular-trip-plans src/data/popularTripPlans.ts
git commit -m "feat: add public popular trip plan api"
```

### Task 2: Extend Client Data Services

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/aiTripPlannerService.ts`

- [ ] **Step 1: Add shared types for public popular cards and public detail**

```ts
export interface PublicPopularTripPlanSummary { ... }
export interface ResolvedAiTripPlanDetail { ... }
```

- [ ] **Step 2: Add service methods**

```ts
export const getPopularAiTripPlans = async (): Promise<PublicPopularTripPlanSummary[]> => ...
export const getPublicAiTripPlanDetail = async (id: string) => ...
```

- [ ] **Step 3: Add a resolver for detail route**

```ts
export const resolveAiTripPlanDetail = async (id: string) => ...
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/services/aiTripPlannerService.ts
git commit -m "feat: add popular guide client services"
```

### Task 3: Rebuild Popular Feed UI

**Files:**
- Modify: `src/pages/AITripPlanner/components/GuidePopularSection.tsx`
- Modify: `src/pages/AITripPlanner/index.tsx`

- [ ] **Step 1: Change popular section to two-column vertical grid**

```tsx
<div className="grid grid-cols-2 gap-3">...</div>
```

- [ ] **Step 2: Remove extra helper copy and noisy badge/action text**

Expected UI: cards only keep image, title, summary, and a small time/source row.

- [ ] **Step 3: Load public popular guides and merge with personal saved guides**

Expected behavior: all cards have real detail IDs and click into detail pages.

- [ ] **Step 4: Reorder sections**

Expected behavior:
- idle: composer -> popular feed
- generating: composer -> generating state -> popular feed
- has result: composer -> result -> popular feed

- [ ] **Step 5: Commit**

```bash
git add src/pages/AITripPlanner/components/GuidePopularSection.tsx src/pages/AITripPlanner/index.tsx
git commit -m "feat: rebuild popular guide feed"
```

### Task 4: Support Public Detail Route

**Files:**
- Modify: `src/pages/AITripPlanner/GuideHistoryDetailPage.tsx`

- [ ] **Step 1: Resolve public vs private detail by ID prefix**

```ts
const detail = await resolveAiTripPlanDetail(id)
```

- [ ] **Step 2: Keep existing detail UI but adapt header/meta copy**

Expected behavior: both personal and public guides render in the same detail screen.

- [ ] **Step 3: Run focused verification**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/AITripPlanner/GuideHistoryDetailPage.tsx
git commit -m "feat: support public guide detail route"
```

### Task 5: Validate

**Files:**
- Modify: `src/pages/AITripPlanner/index.tsx`
- Modify: `src/pages/AITripPlanner/components/GuidePopularSection.tsx`
- Modify: `src/pages/AITripPlanner/GuideHistoryDetailPage.tsx`

- [ ] **Step 1: Run diagnostics**

Run: use editor diagnostics on all modified files
Expected: no TypeScript errors

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Manual smoke checks**

Run behavior:
- idle state shows two-column popular feed
- generating state keeps progress above feed
- result state keeps result above feed
- personal and public cards both open detail pages

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add real popular guide feed"
```
