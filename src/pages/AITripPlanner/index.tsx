import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import GuideComposer from './components/GuideComposer';
import GuideGeneratingState from './components/GuideGeneratingState';
import GuidePageHeader from './components/GuidePageHeader';
import GuidePopularSection from './components/GuidePopularSection';
import GuideResultCard from './components/GuideResultCard';
import { useAuthStore } from '../../stores/authStore';
import {
  generateAiTripPlans,
  getMyAiTripPlans,
  getPopularAiTripPlans,
  resolveTripPlanAttraction,
  saveAiTripPlan,
  updateSavedAiTripPlan
} from '../../services/aiTripPlannerService';
import type { PublicPopularAiTripPlanSummary, SavedAiTripPlan, TripPlanAttractionItem, TripPlanResult } from '../../types';
import { trackEvent } from '../../utils/monitoring';

const EXAMPLE_QUERIES = [
  '5天4夜的行程，一家三口，有个6岁的小孩，想去海边，从北京出发',
  '周末两天一夜，适合上海出发的轻松亲子游，不想太赶'
];

const STAGE_LABELS = ['正在理解你的需求', '正在组合景点攻略', '正在整理首套推荐'];
const SOFT_TIMEOUT_MS = 20_000;
const HARD_TIMEOUT_MS = 35_000;
const SAME_QUERY_GUARD_MS = 2_500;
const INITIAL_RESULT_COUNT = 1;
const MAX_RESULT_COUNT = 3;
const POPULAR_FAVORITES_STORAGE_KEY = 'guide-popular-favorites';
const GUIDE_DRAFT_STORAGE_KEY = 'guide-latest-draft';
const SAVED_GUIDE_COVER_VARIANTS = [
  'premium aerial travel photo, layered landscape, cinematic depth',
  'editorial travel cover, wide scenic composition, crisp daylight',
  'realistic lifestyle travel shot, textured foreground, natural atmosphere',
  'high-end mobile cover image, distinctive angle, clean scenic framing'
];

type PopularGuideListItem = {
  id: string;
  title: string;
  summary: string;
  metaText: string;
  coverPrompt: string;
  detailId: string;
  rank: number;
};

type GenerateState = 'idle' | 'generating' | 'soft-timeout' | 'retrying' | 'failed';

type PendingGenerateOptions = {
  retry?: boolean;
};

type GeneratedSnapshot = {
  query: string;
  result: TripPlanResult;
};

const withNormalizedOptionIds = (result: TripPlanResult): TripPlanResult => ({
  ...result,
  options: result.options.map((option, index) => ({
    ...option,
    id: `plan-${index + 1}`
  }))
});

const buildAttractionKey = (item: Pick<TripPlanAttractionItem, 'name' | 'city' | 'province'>) =>
  [item.name, item.province || '', item.city || ''].join('|');

const buildSavedGuideListItem = (
  item: SavedAiTripPlan,
  index: number,
  userNickname?: string
): PopularGuideListItem => {
  const firstOption = item.result_json.options[0];
  const title = firstOption?.title || item.input_query;
  const summary = firstOption?.reason || item.input_query;
  const titlePrompt = [title, firstOption?.days[0]?.title, item.input_query, SAVED_GUIDE_COVER_VARIANTS[index % SAVED_GUIDE_COVER_VARIANTS.length]]
    .filter(Boolean)
    .join(', ');

  return {
    id: `private-${item.id}`,
    title,
    summary,
    metaText: item.created_at
      ? `${dayjs(item.created_at).format('YYYY年M月D日')}·${userNickname || '我的攻略'}`
      : userNickname || '我的攻略',
    coverPrompt: titlePrompt || 'China travel destination, premium scenic photography',
    detailId: item.id,
    rank: 300 - index
  };
};

const buildPublicGuideListItem = (
  item: PublicPopularAiTripPlanSummary,
  index: number
): PopularGuideListItem => ({
  id: item.id,
  title: item.title,
  summary: item.summary,
  metaText: item.created_at
    ? `${dayjs(item.created_at).format('YYYY年M月D日')}·${item.author_nickname}`
    : item.author_nickname,
  coverPrompt: item.cover_prompt,
  detailId: item.id,
  rank: 200 - index
});

const getStorageErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('relation') && message.includes('ai_trip_plans')) {
    return '攻略历史表还未创建，请先执行 `supabase/ai_trip_plans.sql`。';
  }
  return message || '保存或读取攻略历史失败，请稍后重试。';
};

const getGenerateErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('AbortError')) return '';
  if (message.includes('Failed to fetch')) return '网络有点波动，重新试一次看看。';
  return message || '这次生成没有成功，请重新试一次。';
};

export default function AITripPlanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  const [query, setQuery] = useState(EXAMPLE_QUERIES[0]);
  const [result, setResult] = useState<TripPlanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [stageLabel, setStageLabel] = useState(STAGE_LABELS[0]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showTimeoutActions, setShowTimeoutActions] = useState(false);
  const [latestSavedPlanId, setLatestSavedPlanId] = useState<string | null>(null);
  const [pendingAutoSaveSnapshot, setPendingAutoSaveSnapshot] = useState<GeneratedSnapshot | null>(null);
  const [popularSavedPlans, setPopularSavedPlans] = useState<SavedAiTripPlan[]>([]);
  const [publicPopularPlans, setPublicPopularPlans] = useState<PublicPopularAiTripPlanSummary[]>([]);
  const [favoritePopularIds, setFavoritePopularIds] = useState<string[]>([]);
  const [resolvingAttractionKey, setResolvingAttractionKey] = useState<string | null>(null);
  const [isAppendingOptions, setIsAppendingOptions] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const timerRefs = useRef<number[]>([]);
  const requestStartedAtRef = useRef(0);
  const lastRequestRef = useRef<{ query: string; at: number } | null>(null);

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    timerRefs.current = [];
  }, []);

  const beginProgress = useCallback((isRetry = false) => {
    clearTimers();
    setGenerateState(isRetry ? 'retrying' : 'generating');
    setStageLabel(STAGE_LABELS[0]);
    setElapsedMs(0);
    setShowTimeoutActions(false);
    requestStartedAtRef.current = Date.now();

    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - requestStartedAtRef.current);
    }, 1000);

    const stage2Id = window.setTimeout(() => setStageLabel(STAGE_LABELS[1]), 6000);
    const stage3Id = window.setTimeout(() => setStageLabel(STAGE_LABELS[2]), 15000);
    const softTimeoutId = window.setTimeout(() => {
      setGenerateState('soft-timeout');
      setStageLabel('这次需求更复杂，正在继续生成');
      trackEvent('guide_soft_timeout', {
        queryLength: query.trim().length
      });
    }, SOFT_TIMEOUT_MS);
    const hardTimeoutId = window.setTimeout(() => {
      setShowTimeoutActions(true);
      setStageLabel('生成时间比平时更长，你可以继续等或重新来一次');
      trackEvent('guide_hard_timeout', {
        queryLength: query.trim().length
      });
    }, HARD_TIMEOUT_MS);

    timerRefs.current = [intervalId, stage2Id, stage3Id, softTimeoutId, hardTimeoutId];
  }, [clearTimers, query]);

  const stopProgress = useCallback(() => {
    clearTimers();
    setElapsedMs(Date.now() - requestStartedAtRef.current);
    setShowTimeoutActions(false);
  }, [clearTimers]);

  useEffect(() => {
    trackEvent('guide_page_expose', { isAuthenticated });
  }, [isAuthenticated]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(POPULAR_FAVORITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavoritePopularIds(parsed.filter((item): item is string => typeof item === 'string'));
        }
      }
    } catch {
      setFavoritePopularIds([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(POPULAR_FAVORITES_STORAGE_KEY, JSON.stringify(favoritePopularIds));
  }, [favoritePopularIds]);

  useEffect(() => {
    try {
      const savedDraft = window.sessionStorage.getItem(GUIDE_DRAFT_STORAGE_KEY);
      if (!savedDraft) return;

      const parsed = JSON.parse(savedDraft) as Partial<GeneratedSnapshot>;
      if (typeof parsed.query === 'string' && parsed.result && Array.isArray(parsed.result.options) && parsed.result.options.length > 0) {
        setQuery(parsed.query);
        setResult(withNormalizedOptionIds(parsed.result as TripPlanResult));
      }
    } catch {
      window.sessionStorage.removeItem(GUIDE_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!result) return;
    window.sessionStorage.setItem(GUIDE_DRAFT_STORAGE_KEY, JSON.stringify({
      query,
      result,
    }));
  }, [query, result]);

  useEffect(() => {
    const loadPopularPlans = async () => {
      try {
        const data = await getPopularAiTripPlans();
        setPublicPopularPlans(data);
      } catch {
        setPublicPopularPlans([]);
      }
    };

    void loadPopularPlans();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setPopularSavedPlans([]);
      return;
    }

    const loadMyPopularPlans = async () => {
      try {
        const data = await getMyAiTripPlans(user.id);
        setPopularSavedPlans(data.slice(0, 4));
      } catch {
        setPopularSavedPlans([]);
      }
    };

    void loadMyPopularPlans();
  }, [isAuthenticated, user?.id]);

  useEffect(() => () => {
    abortRef.current?.abort();
    clearTimers();
  }, [clearTimers]);

  const isGenerating = generateState === 'generating' || generateState === 'soft-timeout' || generateState === 'retrying';
  const isWorking = isGenerating || isAppendingOptions;
  const elapsedSeconds = Math.max(1, Math.round(elapsedMs / 1000));

  const latestSavedAt = useMemo(() => {
    if (!result?.generatedAt) return '';
    return dayjs(result.generatedAt).format('M月D日 HH:mm');
  }, [result?.generatedAt]);

  const latestDuration = useMemo(() => {
    if (!result?.meta?.totalMs) return '';
    return `${Math.max(1, Math.round(result.meta.totalMs / 1000))} 秒生成`;
  }, [result?.meta?.totalMs]);

  const generatingDetailText = useMemo(() => {
    if (generateState === 'soft-timeout') {
      return '这次需求更复杂，正在继续生成。';
    }
    if (generateState === 'retrying') {
      return '正在按你的最新描述重新整理攻略。';
    }
    return '正在从景点库里筛选更合适的路线。';
  }, [generateState]);

  const persistGeneratedResult = useCallback(async (
    nextQuery: string,
    nextResult: TripPlanResult,
    source: 'initial' | 'append',
    requestId?: number
  ) => {
    if (!isAuthenticated || !user?.id) return;

    const syncSavedList = (savedId: string, createdAt?: string) => {
      setPopularSavedPlans((current) => {
        const nextItem: SavedAiTripPlan = {
          id: savedId,
          user_id: user.id,
          input_query: nextQuery,
          result_json: nextResult,
          created_at: createdAt ?? current.find((item) => item.id === savedId)?.created_at
        };

        return [nextItem, ...current.filter((item) => item.id !== savedId)].slice(0, 4);
      });
    };

    try {
      if (latestSavedPlanId) {
        const saved = await updateSavedAiTripPlan(latestSavedPlanId, nextResult);
        setLatestSavedPlanId(saved.id);
        setPendingAutoSaveSnapshot(null);
        syncSavedList(saved.id, saved.created_at);
        trackEvent('guide_auto_save_success', { id: saved.id, requestId, source });
        return;
      }

      const saved = await saveAiTripPlan(user.id, nextQuery, nextResult);
      setLatestSavedPlanId(saved.id);
      setPendingAutoSaveSnapshot(null);
      syncSavedList(saved.id, saved.created_at);
      trackEvent('guide_auto_save_success', { id: saved.id, requestId, source });
    } catch (error) {
      setPendingAutoSaveSnapshot({
        query: nextQuery,
        result: nextResult
      });
      setErrorMessage(getStorageErrorMessage(error) || '攻略已生成，但保存失败，可稍后再试');
      trackEvent('guide_auto_save_fail', { requestId, source });
    }
  }, [isAuthenticated, latestSavedPlanId, user?.id]);

  const triggerGenerate = useCallback(async (options?: PendingGenerateOptions) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setErrorMessage('先写下你的出行需求，例如天数、出发地、人群和偏好。');
      return;
    }

    const now = Date.now();
    if (isGenerating && lastRequestRef.current?.query === trimmed) {
      setErrorMessage('这条攻略正在生成，稍等一下即可。');
      return;
    }

    if (!options?.retry && lastRequestRef.current?.query === trimmed && now - lastRequestRef.current.at < SAME_QUERY_GUARD_MS) {
      setErrorMessage('刚刚已经在生成这条攻略了，稍等一下即可。');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    lastRequestRef.current = { query: trimmed, at: now };

    setErrorMessage('');
    setResult(null);
    setIsAppendingOptions(false);
    setLatestSavedPlanId(null);
    setPendingAutoSaveSnapshot(null);
    beginProgress(Boolean(options?.retry));

    trackEvent(options?.retry ? 'guide_retry_click' : 'guide_generate_click', {
      requestId,
      queryLength: trimmed.length
    });

    const clientStart = Date.now();

    try {
      const nextResult = withNormalizedOptionIds(await generateAiTripPlans(trimmed, {
        signal: controller.signal,
        targetCount: INITIAL_RESULT_COUNT
      }));
      if (requestId !== activeRequestIdRef.current) return;

      stopProgress();
      setGenerateState('idle');
      setStageLabel(STAGE_LABELS[0]);
      setResult(nextResult);

      trackEvent('guide_generate_success', {
        requestId,
        totalClientMs: Date.now() - clientStart,
        totalMs: nextResult.meta?.totalMs,
        modelMs: nextResult.meta?.modelMs,
        matchMs: nextResult.meta?.matchMs,
        cacheHit: nextResult.meta?.cacheHit,
        retried: nextResult.meta?.retried
      });

      trackEvent(nextResult.meta?.cacheHit ? 'guide_attraction_cache_hit' : 'guide_attraction_cache_miss', {
        requestId
      });

      if (isAuthenticated && user?.id) {
        trackEvent('guide_auto_save_start', { requestId, source: 'initial' });
        await persistGeneratedResult(trimmed, nextResult, 'initial', requestId);
      }
    } catch (error) {
      if (requestId !== activeRequestIdRef.current) return;
      stopProgress();

      if (error instanceof DOMException && error.name === 'AbortError') {
        setGenerateState('idle');
        setStageLabel(STAGE_LABELS[0]);
        return;
      }

      const nextMessage = getGenerateErrorMessage(error);
      setGenerateState('failed');
      setErrorMessage(nextMessage);
      trackEvent('guide_generate_fail', {
        requestId,
        totalClientMs: Date.now() - clientStart,
        message: nextMessage
      });
    }
  }, [beginProgress, isAuthenticated, isGenerating, persistGeneratedResult, query, stopProgress, user?.id]);

  const handleAppendOption = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !result || isGenerating || isAppendingOptions || result.options.length >= MAX_RESULT_COUNT) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setErrorMessage('');
    setIsAppendingOptions(true);

    trackEvent('guide_append_option_click', {
      requestId,
      currentOptionCount: result.options.length
    });

    try {
      const appendResult = withNormalizedOptionIds(await generateAiTripPlans(trimmed, {
        signal: controller.signal,
        targetCount: 1,
        existingTitles: result.options.map((option) => option.title)
      }));
      if (requestId !== activeRequestIdRef.current) return;

      const mergedResult = withNormalizedOptionIds({
        ...appendResult,
        generatedAt: appendResult.generatedAt || result.generatedAt,
        options: [...result.options, ...appendResult.options].slice(0, MAX_RESULT_COUNT),
        meta: {
          ...appendResult.meta,
          totalMs: (result.meta?.totalMs || 0) + (appendResult.meta?.totalMs || 0),
          modelMs: (result.meta?.modelMs || 0) + (appendResult.meta?.modelMs || 0),
          matchMs: (result.meta?.matchMs || 0) + (appendResult.meta?.matchMs || 0),
          cacheHit: false,
          retried: Boolean(result.meta?.retried || appendResult.meta?.retried),
        }
      });

      setResult(mergedResult);

      trackEvent('guide_append_option_success', {
        requestId,
        nextOptionCount: mergedResult.options.length,
        totalMs: appendResult.meta?.totalMs,
        retried: appendResult.meta?.retried
      });

      if (isAuthenticated && user?.id) {
        trackEvent('guide_auto_save_start', { requestId, source: 'append' });
        await persistGeneratedResult(trimmed, mergedResult, 'append', requestId);
      }
    } catch (error) {
      if (requestId !== activeRequestIdRef.current) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      const nextMessage = getGenerateErrorMessage(error) || '这次换一换没有成功，请再试一次。';
      setErrorMessage(nextMessage);
      trackEvent('guide_append_option_fail', {
        requestId,
        message: nextMessage
      });
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsAppendingOptions(false);
      }
    }
  }, [isAppendingOptions, isAuthenticated, isGenerating, persistGeneratedResult, query, result, user?.id]);

  const handleContinueWait = useCallback(() => {
    setShowTimeoutActions(false);
    setStageLabel('仍在整理攻略，请再等一下');
    trackEvent('guide_continue_wait', {
      elapsedSeconds
    });
  }, [elapsedSeconds]);

  const handleRetrySave = useCallback(async () => {
    if (!pendingAutoSaveSnapshot || !user?.id) return;

    setErrorMessage('');
    trackEvent('guide_auto_save_start', { source: 'manual-retry' });
    try {
      const saved = latestSavedPlanId
        ? await updateSavedAiTripPlan(latestSavedPlanId, pendingAutoSaveSnapshot.result)
        : await saveAiTripPlan(
            user.id,
            pendingAutoSaveSnapshot.query,
            pendingAutoSaveSnapshot.result
          );
      setLatestSavedPlanId(saved.id);
      setPendingAutoSaveSnapshot(null);
      setPopularSavedPlans((current) => {
        const nextItem: SavedAiTripPlan = {
          id: saved.id,
          user_id: user.id,
          input_query: pendingAutoSaveSnapshot.query,
          result_json: pendingAutoSaveSnapshot.result,
          created_at: saved.created_at
        };
        return [nextItem, ...current.filter((item) => item.id !== saved.id)].slice(0, 4);
      });
      trackEvent('guide_auto_save_success', { id: saved.id, source: 'manual-retry' });
    } catch (error) {
      setErrorMessage(getStorageErrorMessage(error));
      trackEvent('guide_auto_save_fail', { source: 'manual-retry' });
    }
  }, [latestSavedPlanId, pendingAutoSaveSnapshot, user?.id]);

  const handleGoLogin = useCallback(() => {
    navigate('/login', {
      state: { redirectTo: '/ai-trip-planner/history' }
    });
  }, [navigate]);

  const handleOpenHistory = useCallback(() => {
    navigate('/ai-trip-planner/history');
  }, [navigate]);

  const handleUseExample = (value: string) => {
    setQuery(value);
    setErrorMessage('');
  };

  const handleOpenDetail = useCallback(async (item: TripPlanAttractionItem) => {
    if (!isAuthenticated) {
      const shouldLogin = window.confirm('登录后才能查看景点详情，并可尽量保留当前攻略，避免稍后找不到。现在去登录吗？');
      if (shouldLogin) {
        navigate('/login', {
          state: { redirectTo: location.pathname }
        });
      } else {
        setErrorMessage('当前未登录，攻略详情可能保存失败，离开后也可能无法再次查看。');
      }
      return;
    }

    const nextKey = buildAttractionKey(item);
    setResolvingAttractionKey(nextKey);
    try {
      const attractionId = await resolveTripPlanAttraction(item);
      navigate(`/attraction/${attractionId}`, {
        state: {
          backTo: '/ai-trip-planner',
          backLabel: '返回攻略'
        }
      });
      trackEvent('guide_attraction_detail_open', {
        attractionName: item.name,
        source: item.matchedAttractionId ? 'legacy-match' : 'lazy-resolve'
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '暂无景区介绍');
      trackEvent('guide_attraction_detail_resolve_fail', {
        attractionName: item.name
      });
    } finally {
      setResolvingAttractionKey(null);
    }
  }, [isAuthenticated, location.pathname, navigate]);

  const togglePopularFavorite = useCallback((id: string) => {
    setFavoritePopularIds((current) => {
      const exists = current.includes(id);
      trackEvent(exists ? 'guide_popular_unfavorite' : 'guide_popular_favorite', { id });
      return exists ? current.filter((item) => item !== id) : [...current, id];
    });
  }, []);

  const popularGuideItems = useMemo(() => {
    const ownGuides = popularSavedPlans.slice(0, 2).map((item, index) => buildSavedGuideListItem(item, index, user?.nickname));
    const publicGuides = publicPopularPlans.map(buildPublicGuideListItem);
    const mergedGuides = [...ownGuides, ...publicGuides]
      .sort((left, right) => right.rank - left.rank)
      .slice(0, 6);

    return mergedGuides.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      metaText: item.metaText,
      coverPrompt: item.coverPrompt,
      isFavorited: favoritePopularIds.includes(item.id),
      onToggleFavorite: () => togglePopularFavorite(item.id),
      onClick: () => {
        trackEvent('guide_popular_card_open', { id: item.detailId });
        navigate(`/ai-trip-planner/history/${item.detailId}`, {
          state: { backTo: '/ai-trip-planner' }
        });
      }
    }));
  }, [favoritePopularIds, navigate, popularSavedPlans, publicPopularPlans, togglePopularFavorite, user?.nickname]);

  const resultMetaText = useMemo(() => {
    const base = [latestSavedAt, latestDuration].filter(Boolean).join(' · ');
    const optionCount = result?.options.length || 0;
    if (!base) return `已生成 ${optionCount} 套景点攻略`;
    if (latestSavedPlanId) return `${base} 已自动保存至“我的攻略”`;
    return base;
  }, [latestDuration, latestSavedAt, latestSavedPlanId, result?.options.length]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f4f7fb_0%,#f7fafc_56%,#f9fafb_100%)] pb-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.28),rgba(45,212,191,0.18)_36%,rgba(59,130,246,0.08)_52%,rgba(249,250,251,0)_74%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[240px] bg-gradient-to-b from-emerald-100/95 via-teal-100/65 to-transparent" />

      <div className="relative mx-auto max-w-md px-4 pb-8 pt-4">
        <GuidePageHeader onOpenHistory={handleOpenHistory} />

        <div className="mt-5 px-1">
          <GuideComposer
            query={query}
            examples={EXAMPLE_QUERIES}
            isGenerating={isWorking}
            onQueryChange={setQuery}
            onUseExample={handleUseExample}
            onSubmit={() => {
              void triggerGenerate();
            }}
          />
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
            <div>{errorMessage}</div>
            {pendingAutoSaveSnapshot && isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  void handleRetrySave();
                }}
                className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-medium text-red-600 ring-1 ring-red-100"
              >
                重新尝试保存
              </button>
            ) : null}
          </div>
        ) : null}

        {isGenerating ? (
          <div className="mt-4">
            <GuideGeneratingState
              stageLabel={stageLabel}
              elapsedSeconds={elapsedSeconds}
              showTimeoutActions={showTimeoutActions}
              detailText={generatingDetailText}
              onContinueWait={handleContinueWait}
              onRetry={() => {
                void triggerGenerate({ retry: true });
              }}
            />
          </div>
        ) : null}

        {result ? (
          <section className="mt-5">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">为你生成的 {result.options.length} 套攻略</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">{resultMetaText}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (result.options.length >= MAX_RESULT_COUNT) {
                      void triggerGenerate({ retry: true });
                      return;
                    }
                    void handleAppendOption();
                  }}
                  disabled={isWorking}
                  className="inline-flex shrink-0 items-center rounded-full bg-white px-3 py-2 text-[13px] font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={result.options.length >= MAX_RESULT_COUNT ? '换个试试' : '换一换'}
                >
                  <span>{result.options.length >= MAX_RESULT_COUNT ? '换个试试' : (isAppendingOptions ? '补方案中' : '换一换')}</span>
                </button>
              </div>
            </div>

            {!isAuthenticated ? (
              <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
                <div>未登录时，当前攻略可能保存失败，离开后也可能无法再次查看；查看景点详情前建议先登录。</div>
                <button
                  type="button"
                  onClick={handleGoLogin}
                  className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100"
                >
                  登录后保存
                </button>
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              {result.options.length < MAX_RESULT_COUNT ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                  当前已生成 {result.options.length} 套高质量攻略，还可再补 {MAX_RESULT_COUNT - result.options.length} 套备选方案。
                </div>
              ) : null}
              {result.options.map((option, index) => (
                <GuideResultCard
                  key={option.id}
                  index={index}
                  option={option}
                  resolvingAttractionKey={resolvingAttractionKey}
                  onOpenDetail={handleOpenDetail}
                />
              ))}
            </div>
          </section>
        ) : null}

        <GuidePopularSection items={popularGuideItems} />
      </div>
    </div>
  );
}
