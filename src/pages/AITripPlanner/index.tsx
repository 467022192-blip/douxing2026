import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Bookmark, Loader2, RefreshCw } from 'lucide-react';
import GuideComposer from './components/GuideComposer';
import GuideGeneratingState from './components/GuideGeneratingState';
import GuideHero from './components/GuideHero';
import GuideHistoryList from './components/GuideHistoryList';
import GuideResultCard from './components/GuideResultCard';
import { useAuthStore } from '../../stores/authStore';
import { generateAiTripPlans, getMyAiTripPlans, saveAiTripPlan } from '../../services/aiTripPlannerService';
import type { SavedAiTripPlan, TripPlanResult } from '../../types';
import { trackEvent } from '../../utils/monitoring';

const EXAMPLE_QUERIES = [
  '5天4夜的行程，一家三口，有个6岁的小孩，想去海边，从北京出发',
  '周末两天一夜，适合上海出发的轻松亲子游，不想太赶'
];

const STAGE_LABELS = ['正在理解你的需求', '正在组合景点攻略', '正在整理 3 套推荐'];
const SOFT_TIMEOUT_MS = 20_000;
const HARD_TIMEOUT_MS = 35_000;
const SAME_QUERY_GUARD_MS = 2_500;

type GenerateState = 'idle' | 'generating' | 'soft-timeout' | 'retrying' | 'failed';

type PendingGenerateOptions = {
  retry?: boolean;
};

const INSPIRATION_CARDS = [
  {
    title: '秋天适合去哪玩',
    summary: '输入天数、出发地和偏好，快速拿到 3 套轻重不同的景点攻略。'
  },
  {
    title: '周末两天怎么安排',
    summary: '适合亲子、轻松、海边、自然风景等出行场景，先给你清晰灵感。'
  }
];

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
  const { isAuthenticated, user } = useAuthStore();

  const [query, setQuery] = useState(EXAMPLE_QUERIES[0]);
  const [result, setResult] = useState<TripPlanResult | null>(null);
  const [historyItems, setHistoryItems] = useState<SavedAiTripPlan[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [stageLabel, setStageLabel] = useState(STAGE_LABELS[0]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showTimeoutActions, setShowTimeoutActions] = useState(false);

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

  const loadHistory = useCallback(async () => {
    if (!user?.id) {
      setHistoryItems([]);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const data = await getMyAiTripPlans(user.id);
      setHistoryItems(data);
    } catch (error) {
      setErrorMessage(getStorageErrorMessage(error));
    } finally {
      setIsHistoryLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    trackEvent('guide_page_expose', { isAuthenticated });
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      void loadHistory();
    } else {
      setHistoryItems([]);
      setSelectedHistoryId(null);
    }
  }, [isAuthenticated, loadHistory, user?.id]);

  useEffect(() => () => {
    abortRef.current?.abort();
    clearTimers();
  }, [clearTimers]);

  const canSave = Boolean(result && isAuthenticated && user?.id);
  const isGenerating = generateState === 'generating' || generateState === 'soft-timeout' || generateState === 'retrying';
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
    setSaveMessage('');
    setResult(null);
    setSelectedHistoryId(null);
    beginProgress(Boolean(options?.retry));

    trackEvent(options?.retry ? 'guide_retry_click' : 'guide_generate_click', {
      requestId,
      queryLength: trimmed.length
    });

    const clientStart = Date.now();

    try {
      const nextResult = await generateAiTripPlans(trimmed, { signal: controller.signal });
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
  }, [beginProgress, isGenerating, query, stopProgress]);

  const handleContinueWait = useCallback(() => {
    setShowTimeoutActions(false);
    setStageLabel('仍在整理攻略，请再等一下');
    trackEvent('guide_continue_wait', {
      elapsedSeconds
    });
  }, [elapsedSeconds]);

  const handleSave = async () => {
    if (!result) return;

    if (!isAuthenticated || !user?.id) {
      if (window.confirm('保存攻略需要先登录，是否前往登录？')) {
        navigate('/login');
      }
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSaveMessage('');
    trackEvent('guide_save_click', { hasMeta: Boolean(result.meta) });
    try {
      const saved = await saveAiTripPlan(user.id, query.trim(), result);
      setSaveMessage('已保存到你的攻略历史。');
      setSelectedHistoryId(saved.id);
      trackEvent('guide_save_success', { id: saved.id });
      await loadHistory();
    } catch (error) {
      setErrorMessage(getStorageErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseExample = (value: string) => {
    setQuery(value);
    setErrorMessage('');
    setSaveMessage('');
  };

  const handleOpenHistory = (item: SavedAiTripPlan) => {
    setQuery(item.input_query);
    setResult(item.result_json);
    setSelectedHistoryId(item.id);
    setErrorMessage('');
    setSaveMessage('');
    trackEvent('guide_history_open', { id: item.id });
  };

  const handleOpenDetail = (id: string) => {
    navigate(`/attraction/${id}`);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef8ff_0%,#f8fbff_22%,#f8fafc_100%)] pb-24">
      <div className="mx-auto max-w-md px-4 pb-8 pt-4">
        <GuideHero />

        <div className="-mt-5 px-1">
          <GuideComposer
            query={query}
            examples={EXAMPLE_QUERIES}
            isGenerating={isGenerating}
            helperText={isGenerating ? '通常 15-30 秒，复杂需求会更久' : '示例问题可直接点击后生成'}
            onQueryChange={setQuery}
            onUseExample={handleUseExample}
            onSubmit={() => {
              void triggerGenerate();
            }}
          />
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
            {errorMessage}
          </div>
        ) : null}

        {saveMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
            {saveMessage}
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
                <h2 className="text-lg font-semibold text-slate-900">为你生成的 3 套攻略</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {[latestSavedAt && `更新于 ${latestSavedAt}`, latestDuration].filter(Boolean).join(' · ') || '已生成 3 套景点攻略'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void triggerGenerate({ retry: true });
                  }}
                  disabled={isGenerating}
                  className="rounded-full bg-white p-2 text-slate-500 shadow-sm ring-1 ring-slate-100"
                  aria-label="重新生成"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                    canSave ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-100'
                  }`}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                  {isAuthenticated ? '保存这份攻略' : '登录后可保存'}
                </button>
              </div>
            </div>

            {!isAuthenticated ? (
              <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
                你可以先试用攻略生成，登录后可保存到历史中随时回看。
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              {result.options.map((option, index) => (
                <GuideResultCard key={option.id} index={index} option={option} onOpenDetail={handleOpenDetail} />
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-5 grid grid-cols-2 gap-3">
            {INSPIRATION_CARDS.map((card) => (
              <article
                key={card.title}
                className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm ring-1 ring-slate-100/80"
              >
                <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{card.summary}</p>
              </article>
            ))}
          </section>
        )}

        <div className="mt-6">
          <GuideHistoryList
            isAuthenticated={isAuthenticated}
            isLoading={isHistoryLoading}
            items={historyItems}
            selectedId={selectedHistoryId}
            onOpenHistory={handleOpenHistory}
          />
        </div>
      </div>
    </div>
  );
}
