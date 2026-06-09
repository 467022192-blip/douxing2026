# Guide History And Visual Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「攻略」页改造成更简洁的生成主页，并新增「我的攻略」列表页与详情页，同时统一攻略相关视觉和自动保存体验。

**Architecture:** 保留现有 `/ai-trip-planner` 生成主链路，在其上拆出两个新路由承接历史浏览。数据层新增“历史摘要查询 + 单条详情查询”，避免列表页继续依赖当前页的整包结果状态；主页继续展示本次生成结果，并在生成成功后自动保存已登录用户的快照。

**Tech Stack:** React, TypeScript, React Router, Zustand, Supabase, Tailwind CSS, Lucide React

---

## File Map

- Modify: `src/App.tsx`
  - 新增攻略历史列表页与详情页路由。
  - 调整底部导航隐藏规则，让列表页和详情页隐藏底导。
- Modify: `src/components/BottomNav/index.tsx`
  - 让 `/ai-trip-planner` 子路由仍归属 `攻略` tab。
  - 适配新的脚印 icon 状态色。
- Modify: `src/components/GuideTabIcon/index.tsx`
  - 将当前 icon 改成脚印感、与 `我的` 页风格统一的自定义图形。
- Modify: `src/pages/AITripPlanner/index.tsx`
  - 移除首屏 Hero/历史列表耦合。
  - 增加右上角 `我的攻略` 入口。
  - 接入自动保存、成功弹层、结果滑动提示。
- Create: `src/pages/AITripPlanner/GuideHistoryPage.tsx`
  - 已保存攻略列表页。
- Create: `src/pages/AITripPlanner/GuideHistoryDetailPage.tsx`
  - 单条攻略详情页。
- Create: `src/pages/AITripPlanner/components/GuidePageHeader.tsx`
  - 主页标题和右上角入口。
- Create: `src/pages/AITripPlanner/components/GuideSaveSuccessModal.tsx`
  - 自动保存成功后的轻提示弹层。
- Create: `src/pages/AITripPlanner/components/GuideResultsHint.tsx`
  - “向下滑动查看”提示。
- Modify: `src/pages/AITripPlanner/components/GuideComposer.tsx`
  - 按新视觉收敛输入卡片和按钮样式。
- Modify: `src/pages/AITripPlanner/components/GuideResultCard.tsx`
  - 与新的 `攻略 / 我的` 风格统一。
- Modify: `src/services/aiTripPlannerService.ts`
  - 增加历史摘要列表、单条详情、自动保存重试调用。
- Modify: `src/services/supabaseService.ts`
  - 新增 `getAiTripPlanSummariesByUser()` 和 `getAiTripPlanById()`。
- Modify: `src/types/index.ts`
  - 新增 `SavedAiTripPlanSummary` 类型。
- Modify: `src/pages/Login/index.tsx`
  - 支持携带回跳地址登录，并在登录/注册/游客登录成功后返回目标页。
- Modify: `src/utils/monitoring.ts`
  - 补充攻略历史入口、自动保存、详情打开等埋点事件类型。

## Implementation Notes

- 历史列表页不再读取完整 `result_json`，只查 `id,input_query,created_at`，`攻略方案数` 在 UI 中固定展示为 `3 套方案`。
- 首个方案标题不作为本期必做项，避免因不读取 `result_json` 而引入新字段或数据迁移。
- 自动保存失败时仅支持当前页轻量“重新尝试保存”，不做本地持久化。
- 自动保存失败时重试必须使用“本次生成成功时冻结的 query + result”快照，不能读取用户后来修改过的输入框值。
- 未登录访问 `/ai-trip-planner/history` 或 `/ai-trip-planner/history/:id` 时，跳转登录页并带上回跳地址；登录成功后返回原目标页。
- `我的攻略列表页` 和 `攻略详情页` 默认隐藏底部导航。
- 由于当前详情查询走前端直连 Supabase + RLS，无法可靠区分“无权限”和“记录不存在”；本期统一收敛为“该攻略不存在或你暂无权限查看”的不可用态。

### Task 1: Route And Data Contract

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/BottomNav/index.tsx`
- Modify: `src/types/index.ts`
- Modify: `src/services/supabaseService.ts`
- Modify: `src/services/aiTripPlannerService.ts`
- Modify: `src/pages/Login/index.tsx`

- [ ] **Step 1: 定义历史摘要和详情的数据边界**

在 `src/types/index.ts` 增加摘要类型，避免列表页继续复用完整详情类型。

```ts
export interface SavedAiTripPlanSummary {
  id: string;
  input_query: string;
  created_at: string;
}
```

- [ ] **Step 2: 为列表页和详情页补服务层方法**

在 `src/services/supabaseService.ts` 增加两个方法：

```ts
export const getAiTripPlanSummariesByUser = async (userId: string, limit = 20) => {
  const { data, error } = await supabase
    .from('ai_trip_plans')
    .select('id,input_query,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

export const getAiTripPlanById = async (id: string) => {
  const { data, error } = await supabase
    .from('ai_trip_plans')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return normalizeAiTripPlan(data);
};
```

- [ ] **Step 3: 暴露前端 service API**

在 `src/services/aiTripPlannerService.ts` 增加：

```ts
export const getMyAiTripPlanSummaries = async (userId: string) => {
  return getAiTripPlanSummariesByUser(userId);
};

export const getAiTripPlanDetail = async (id: string) => {
  return getAiTripPlanById(id);
};
```

- [ ] **Step 4: 接入新路由与底导隐藏规则**

在 `src/App.tsx`：

```tsx
const GuideHistoryPage = lazy(() => import('./pages/AITripPlanner/GuideHistoryPage'));
const GuideHistoryDetailPage = lazy(() => import('./pages/AITripPlanner/GuideHistoryDetailPage'));

const hideBottomNav =
  location.pathname === '/route-planning' ||
  location.pathname.startsWith('/attraction/') ||
  location.pathname === '/ai-trip-planner/history' ||
  location.pathname.startsWith('/ai-trip-planner/history/');
```

并新增路由：

```tsx
<Route path="/ai-trip-planner/history" element={<GuideHistoryPage />} />
<Route path="/ai-trip-planner/history/:id" element={<GuideHistoryDetailPage />} />
```

- [ ] **Step 5: 让攻略子路由仍归属攻略 tab**

在 `src/components/BottomNav/index.tsx` 将 active 判断改成：

```ts
const isGuidePath = location.pathname === '/ai-trip-planner' || location.pathname.startsWith('/ai-trip-planner/');
const isActive = item.path === '/ai-trip-planner' ? isGuidePath : location.pathname === item.path;
```

- [ ] **Step 6: 运行基础验证**

同时在 `src/pages/Login/index.tsx` 补登录回跳支持：

```ts
const location = useLocation();
const navigate = useNavigate();
const redirectTo =
  (location.state as { redirectTo?: string } | null)?.redirectTo || '/profile';
```

登录、注册、游客登录成功后统一：

```ts
navigate(redirectTo, { replace: true });
```

- [ ] **Step 7: 运行基础验证**

Run: `npm run build`
Expected: build 成功，无 route/type 报错

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/components/BottomNav/index.tsx src/types/index.ts src/services/supabaseService.ts src/services/aiTripPlannerService.ts src/pages/Login/index.tsx
git commit -m "refactor: split guide history data flow"
```

### Task 2: Simplify Guide Home

**Files:**
- Modify: `src/pages/AITripPlanner/index.tsx`
- Modify: `src/pages/AITripPlanner/components/GuideComposer.tsx`
- Modify: `src/pages/AITripPlanner/components/GuideResultCard.tsx`
- Create: `src/pages/AITripPlanner/components/GuidePageHeader.tsx`
- Create: `src/pages/AITripPlanner/components/GuideResultsHint.tsx`

- [ ] **Step 1: 新建主页头部组件**

在 `GuidePageHeader.tsx` 中封装：

```tsx
type GuidePageHeaderProps = {
  onOpenHistory: () => void;
};

export default function GuidePageHeader({ onOpenHistory }: GuidePageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 px-1 pt-2">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-800">旅行攻略智能生成</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          说出你的出行天数、景点偏好、出发地等需求
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          trackEvent('guide_history_entry_click');
          onOpenHistory();
        }}
      >
        我的攻略
      </button>
    </header>
  );
}
```

- [ ] **Step 2: 从主页移除旧 Hero 和正文历史列表**

在 `src/pages/AITripPlanner/index.tsx`：
- 删除 `GuideHero`、`GuideHistoryList` 依赖。
- 删除 `historyItems / isHistoryLoading / selectedHistoryId` 这类主页只为列表服务的状态。
- 保留 `result` 作为本次生成结果。

- [ ] **Step 3: 接入新的首页结构**

首页结构调整为：

```tsx
<div className="min-h-screen bg-gray-50 pb-24">
  <div className="mx-auto max-w-md px-4 pb-8 pt-4">
    <GuidePageHeader onOpenHistory={() => navigate('/ai-trip-planner/history')} />
    <GuideComposer ... />
    {errorMessage ? <ErrorBanner /> : null}
    {isGenerating ? <GuideGeneratingState ... /> : null}
    {result ? (
      <>
        <GuideResultsHint />
        <ResultsSection />
      </>
    ) : null}
  </div>
</div>
```

- [ ] **Step 4: 调整输入区视觉**

在 `GuideComposer.tsx`：
- 改为 `gray-50 + white + emerald` 体系。
- 保留 1-2 条示例问题。
- 去掉旧的蓝色大面积渐变或解释性提示块。

- [ ] **Step 5: 加入滑动提示**

在 `GuideResultsHint.tsx` 中渲染：

```tsx
export default function GuideResultsHint() {
  return (
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      已生成 3 套攻略，向下滑动查看
    </div>
  );
}
```

- [ ] **Step 6: 统一结果卡片视觉**

在 `GuideResultCard.tsx`：
- 统一标题色、正文色、卡片圆角与阴影。
- 让结果区更贴近 `我的` 页的白卡片风格。

- [ ] **Step 7: 运行页面验证**

Run: `npm run build`
Expected: build 成功；主页无 `GuideHero` / `GuideHistoryList` 残留引用

- [ ] **Step 8: Commit**

```bash
git add src/pages/AITripPlanner/index.tsx src/pages/AITripPlanner/components/GuideComposer.tsx src/pages/AITripPlanner/components/GuideResultCard.tsx src/pages/AITripPlanner/components/GuidePageHeader.tsx src/pages/AITripPlanner/components/GuideResultsHint.tsx
git commit -m "feat: simplify guide home page"
```

### Task 3: Auto Save And Success Feedback

**Files:**
- Modify: `src/pages/AITripPlanner/index.tsx`
- Create: `src/pages/AITripPlanner/components/GuideSaveSuccessModal.tsx`
- Modify: `src/utils/monitoring.ts`

- [ ] **Step 1: 将“手动保存”改为自动保存主链路**

在 `triggerGenerate()` 的成功分支中加入：

```ts
const nextSnapshot = {
  query: trimmed,
  result: nextResult
};
setLatestGeneratedSnapshot(nextSnapshot);

if (isAuthenticated && user?.id) {
  trackEvent('guide_auto_save_start', { requestId });
  try {
    const saved = await saveAiTripPlan(user.id, nextSnapshot.query, nextSnapshot.result);
    setLatestSavedPlanId(saved.id);
    setShowSaveSuccessModal(true);
    trackEvent('guide_auto_save_success', { id: saved.id, requestId });
  } catch (error) {
    setPendingAutoSaveSnapshot(nextSnapshot);
    setErrorMessage('攻略已生成，但保存失败，可稍后再试');
    trackEvent('guide_auto_save_fail', { requestId });
  }
}
```

- [ ] **Step 2: 增加轻量重试保存**

仍在 `index.tsx` 中保留仅当前页有效的重试保存按钮：

```ts
const handleRetrySave = async () => {
  if (!pendingAutoSaveSnapshot || !user?.id) return;
  const saved = await saveAiTripPlan(
    user.id,
    pendingAutoSaveSnapshot.query,
    pendingAutoSaveSnapshot.result
  );
  setLatestSavedPlanId(saved.id);
};
```

- [ ] **Step 3: 新建保存成功弹层**

`GuideSaveSuccessModal.tsx`：

```tsx
type GuideSaveSuccessModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
};
```

内容包含：
- 标题：`攻略已生成`
- 副文案：`已为你保存，可前往详情页查看`
- 按钮：`查看详情`、`留在当前页`

- [ ] **Step 4: 移除旧的手动保存主按钮**

主页结果区不再展示“保存这份攻略 / 登录后可保存”的主按钮；未登录用户仅展示一条轻提示：

```tsx
你可以先试用攻略生成，登录后自动保存到我的攻略。
```

- [ ] **Step 5: 补齐埋点常量或 helper 类型**

在 `src/utils/monitoring.ts` 中补充：
- `guide_history_entry_click`
- `guide_auto_save_start`
- `guide_auto_save_success`
- `guide_auto_save_fail`
- `guide_history_detail_open`
- `guide_history_empty_expose`

- [ ] **Step 6: 运行功能验证**

Run: `npm run build`
Expected: build 成功；无未使用的 `Bookmark`/`isSaving` 等残留

- [ ] **Step 7: Commit**

```bash
git add src/pages/AITripPlanner/index.tsx src/pages/AITripPlanner/components/GuideSaveSuccessModal.tsx src/utils/monitoring.ts
git commit -m "feat: auto save generated guide results"
```

### Task 4: Build Guide History List Page

**Files:**
- Create: `src/pages/AITripPlanner/GuideHistoryPage.tsx`
- Modify: `src/services/aiTripPlannerService.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: 创建列表页骨架**

```tsx
export default function GuideHistoryPage() {
  return <div className="min-h-screen bg-gray-50">...</div>;
}
```

页面结构：
- 返回按钮
- 标题 `我的攻略`
- 列表区
- 空状态

- [ ] **Step 2: 接入登录态与回跳**

在页面里读取 `useAuthStore()`；未登录则：

```ts
navigate('/login', { state: { redirectTo: location.pathname } });
```

登录后应由登录页或认证初始化逻辑回到原地址；若当前项目无统一回跳实现，则在本任务内补最小可用的 `location.state?.redirectTo` 处理。

- [ ] **Step 3: 加载历史摘要列表**

```ts
const items = await getMyAiTripPlanSummaries(user.id);
```

列表项展示：
- `input_query`
- `dayjs(created_at).format('M月D日 HH:mm')`
- 固定文案 `3 套方案`

- [ ] **Step 4: 空状态处理**

两种空状态：
- 未登录：登录后查看已保存攻略
- 已登录但无数据：先生成一条攻略

首屏进入空状态时触发：

```ts
trackEvent('guide_history_empty_expose', {
  isAuthenticated,
  emptyType: isAuthenticated ? 'no-data' : 'needs-login'
});
```

- [ ] **Step 5: 列表项跳转详情**

```ts
navigate(`/ai-trip-planner/history/${item.id}`);
```

点击时埋点：

```ts
trackEvent('guide_history_detail_open', { id: item.id, source: 'history-list' });
```

- [ ] **Step 6: 运行页面验证**

Run: `npm run build`
Expected: build 成功；列表页无类型错误

- [ ] **Step 7: Commit**

```bash
git add src/pages/AITripPlanner/GuideHistoryPage.tsx src/services/aiTripPlannerService.ts src/types/index.ts
git commit -m "feat: add guide history list page"
```

### Task 5: Build Guide Detail Page

**Files:**
- Create: `src/pages/AITripPlanner/GuideHistoryDetailPage.tsx`
- Modify: `src/services/aiTripPlannerService.ts`
- Modify: `src/pages/AITripPlanner/components/GuideResultCard.tsx`

- [ ] **Step 1: 创建详情页骨架**

详情页结构：
- 返回按钮
- 原始需求摘要
- 生成时间
- 3 套攻略结果列表

- [ ] **Step 2: 读取路由参数并拉详情**

```ts
const { id } = useParams();
const item = await getAiTripPlanDetail(id!);
```

- [ ] **Step 3: 处理 3 类异常态**
- [ ] **Step 3: 处理 2 类异常态**

- 该攻略不存在或你暂无权限查看
- 加载失败

统一提供返回路径：
- 返回 `我的攻略`
- 返回 `攻略主页`

- [ ] **Step 4: 复用结果卡片**

```tsx
item.result_json.options.map((option, index) => (
  <GuideResultCard key={option.id} index={index} option={option} onOpenDetail={handleOpenAttraction} />
))
```

- [ ] **Step 5: 运行页面验证**

Run: `npm run build`
Expected: build 成功；详情页渲染完整结果不卡类型

- [ ] **Step 6: Commit**

```bash
git add src/pages/AITripPlanner/GuideHistoryDetailPage.tsx src/services/aiTripPlannerService.ts src/pages/AITripPlanner/components/GuideResultCard.tsx
git commit -m "feat: add guide history detail page"
```

### Task 6: Visual Polish And Manual Verification

**Files:**
- Modify: `src/components/GuideTabIcon/index.tsx`
- Modify: `src/pages/AITripPlanner/index.tsx`
- Modify: `src/pages/AITripPlanner/GuideHistoryPage.tsx`
- Modify: `src/pages/AITripPlanner/GuideHistoryDetailPage.tsx`

- [ ] **Step 1: 重绘攻略 tab icon**

目标：
- 脚印感而非 emoji
- active 态 `emerald/teal`
- inactive 态与其他 tab 一致
- 大小与 `22px` 左右 tab icon 协调

- [ ] **Step 2: 统一攻略三页背景和字阶**

统一约束：
- 页面背景 `bg-gray-50`
- 内容卡片 `bg-white`
- 标题 `text-gray-800`
- 次级说明 `text-gray-500`
- 强调按钮 `emerald-500 ~ teal-600`

- [ ] **Step 3: 手动验证路由和交互**

本地检查：
- `/ai-trip-planner`
- `/ai-trip-planner/history`
- `/ai-trip-planner/history/:id`

核对点：
- 主页右上角入口正常
- 主页生成后保留结果
- 成功弹层能进详情
- 历史列表能进详情
- 列表页与详情页隐藏底导

- [ ] **Step 4: 运行最终校验**

Run: `npm run build`
Expected: build 成功

Run: `git status --short`
Expected: 仅包含本次计划内文件

- [ ] **Step 5: Commit**

```bash
git add src/components/GuideTabIcon/index.tsx src/pages/AITripPlanner/index.tsx src/pages/AITripPlanner/GuideHistoryPage.tsx src/pages/AITripPlanner/GuideHistoryDetailPage.tsx
git commit -m "style: unify guide history visual design"
```

## Manual QA Checklist

- 已登录生成一条攻略后，主页自动保存成功并弹出提示。
- 点击 `查看详情` 可进入 `/ai-trip-planner/history/:id`。
- 点击右上角 `我的攻略` 可进入列表页并看到最新记录在顶部。
- 未登录访问历史列表或详情时，会进入登录并能回跳。
- 自动保存失败时，主页仍保留结果，并能在当前页重试保存。
- 攻略 tab icon 与 `我的` 页配色风格一致。
- 攻略主页、列表页、详情页背景和字阶统一。

## Open Decisions Locked For This Plan

- 列表页不展示首个方案标题，避免拉取完整 `result_json`。
- 自动保存失败仅支持当前页重试，不做本地离线暂存。
- 历史页与详情页默认隐藏底部导航。

## Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-09-guide-history-and-visual-unification.md`. Ready to execute?
