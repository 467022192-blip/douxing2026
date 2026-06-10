# [Guide Lazy Attraction Resolve] Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove attraction-database matching from AI guide generation so results return faster, while preserving attraction detail navigation through click-time lazy resolution.

**Architecture:** The guide generation API stops reading and matching the attraction table entirely and returns model-native attraction items only. A new lightweight resolve API performs single-attraction lookup on demand, and the guide UI switches to async detail opening with old-data compatibility.

**Tech Stack:** Vercel serverless API, React, TypeScript, Supabase

---

### Task 1: Remove generation-time matching

**Files:**
- Modify: `api/ai-trip-plans.ts`

- [ ] Remove Supabase attraction cache and match helpers from the guide generation path.
- [ ] Keep the existing JSON repair, retry, and long-trip validation behavior intact.
- [ ] Return option/day/attraction structures without `matchedAttraction*` enrichment.
- [ ] Preserve `meta.matchMs` as `0` for response compatibility.

### Task 2: Add lazy resolve API

**Files:**
- Create: `api/attractions/resolve.ts`

- [ ] Implement `GET /api/attractions/resolve` accepting `name`, optional `city`, `province`.
- [ ] Query Supabase for a small candidate set, score candidates server-side, and return the best match id.
- [ ] Return `404` when no acceptable match exists.
- [ ] Keep matching logic simple and bounded to avoid reintroducing generation latency.

### Task 3: Wire client-side resolve flow

**Files:**
- Modify: `src/services/aiTripPlannerService.ts`
- Modify: `src/pages/AITripPlanner/components/GuideResultCard.tsx`
- Modify: `src/pages/AITripPlanner/index.tsx`
- Modify: `src/pages/AITripPlanner/GuideHistoryDetailPage.tsx`

- [ ] Add a client helper that calls `/api/attractions/resolve`.
- [ ] Cache resolve results in memory to avoid duplicate requests for the same attraction.
- [ ] Change guide detail opening from sync id navigation to async attraction-item navigation.
- [ ] Continue to use legacy `matchedAttractionId` directly when old saved data already contains it.
- [ ] Show a lightweight failure message when a match cannot be resolved.

### Task 4: Validate and ship

**Files:**
- Modify: `docs/superpowers/plans/2026-06-10-guide-lazy-attraction-resolve.md`

- [ ] Run `npm run build`.
- [ ] Check edited files with diagnostics.
- [ ] Smoke-test new guide generation plus lazy detail opening.
- [ ] Commit and push the changes for deployment.
