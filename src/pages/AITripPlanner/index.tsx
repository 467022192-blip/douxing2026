import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Bookmark,
  Loader2,
  Sparkles,
  Wand2,
  ChevronRight,
  History,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { generateAiTripPlans, getMyAiTripPlans, saveAiTripPlan } from '../../services/aiTripPlannerService';
import type { SavedAiTripPlan, TripPlanAttractionItem, TripPlanResult } from '../../types';

const EXAMPLE_QUERIES = [
  '5天4夜的行程，一家三口，有个6岁的小孩，想去海边，从北京出发',
  '周末两天一夜，适合上海出发的轻松亲子游，不想太赶',
  '国庆前错峰出行，想看海和自然风景，从广州出发'
];

const getStorageErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('relation') && message.includes('ai_trip_plans')) {
    return 'AI 规划历史表还未创建，请先执行 `supabase/ai_trip_plans.sql`。';
  }
  return message || '保存或读取 AI 规划历史失败，请稍后重试。';
};

const PlanAttraction = ({
  item,
  onOpenDetail
}: {
  item: TripPlanAttractionItem;
  onOpenDetail: (id: string) => void;
}) => {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
          {(item.city || item.province) && (
            <p className="mt-1 text-xs text-gray-500">
              {[item.province, item.city].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {item.matchedAttractionId && (
          <button
            type="button"
            onClick={() => onOpenDetail(item.matchedAttractionId!)}
            className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-600 shadow-sm"
          >
            景区详情
          </button>
        )}
      </div>
      {item.summary && <p className="mt-2 text-sm leading-6 text-gray-600">{item.summary}</p>}
    </div>
  );
};

const PlanCard = ({
  index,
  result,
  onOpenDetail
}: {
  index: number;
  result: TripPlanResult['options'][number];
  onOpenDetail: (id: string) => void;
}) => {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
            方案 {index + 1}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-gray-900">{result.title}</h3>
        </div>
        <Sparkles className="mt-1 h-5 w-5 shrink-0 text-amber-500" />
      </div>

      <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-700">
        {result.reason}
      </p>

      <div className="mt-4 space-y-3">
        {result.days.map((day) => (
          <div key={`${result.id}-${day.day}`} className="rounded-2xl border border-gray-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Day {day.day}</p>
                <p className="mt-1 text-sm text-gray-500">{day.title}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                {day.attractions.length} 个景点
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {day.attractions.map((item, attractionIndex) => (
                <PlanAttraction
                  key={`${result.id}-${day.day}-${attractionIndex}-${item.name}`}
                  item={item}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default function AITripPlanner() {
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoading: authLoading } = useAuthStore();

  const [query, setQuery] = useState(EXAMPLE_QUERIES[0]);
  const [result, setResult] = useState<TripPlanResult | null>(null);
  const [historyItems, setHistoryItems] = useState<SavedAiTripPlan[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

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
    if (isAuthenticated && user?.id) {
      void loadHistory();
    } else {
      setHistoryItems([]);
      setSelectedHistoryId(null);
    }
  }, [isAuthenticated, user?.id, loadHistory]);

  const canSave = Boolean(result && isAuthenticated && user?.id);

  const latestSavedAt = useMemo(() => {
    if (!result?.generatedAt) return '';
    return dayjs(result.generatedAt).format('M月D日 HH:mm');
  }, [result?.generatedAt]);

  const handleGenerate = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setErrorMessage('先写下你的出行需求，例如天数、出发地、人群和偏好。');
      return;
    }

    setErrorMessage('');
    setSaveMessage('');
    setIsGenerating(true);
    try {
      const nextResult = await generateAiTripPlans(trimmed);
      setResult(nextResult);
      setSelectedHistoryId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'AI 行程规划生成失败，请稍后重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;

    if (!isAuthenticated || !user?.id) {
      if (window.confirm('保存 AI 规划需要先登录，是否前往登录？')) {
        navigate('/login');
      }
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSaveMessage('');
    try {
      const saved = await saveAiTripPlan(user.id, query.trim(), result);
      setSaveMessage('已保存到你的 AI 规划历史。');
      setSelectedHistoryId(saved.id);
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
  };

  const handleOpenDetail = (id: string) => {
    navigate(`/attraction/${id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-md px-4 pb-8 pt-4">
        <section className="rounded-[28px] bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-500 px-5 py-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold opacity-90">AI 规划</p>
              <h1 className="mt-2 text-2xl font-semibold leading-8">把需求说清楚，给你 3 套行程灵感</h1>
              <p className="mt-3 text-sm leading-6 text-emerald-50">
                输入出发地、天数、人群和偏好，AI 会先给你按天拆分的景点方案。
              </p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <Wand2 className="h-6 w-6" />
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">描述你的需求</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
              首版先支持文字
            </span>
          </div>

          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：5天4夜的行程，一家三口，有个6岁的小孩，想去海边，从北京出发"
            className="mt-4 h-36 w-full resize-none rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-900 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-emerald-500"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleUseExample(item)}
                className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600 transition hover:bg-gray-200"
              >
                {item}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                正在生成 3 套方案...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                开始 AI 规划
              </>
            )}
          </button>

          {errorMessage && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
              {errorMessage}
            </div>
          )}

          {saveMessage && (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
              {saveMessage}
            </div>
          )}
        </section>

        {result && (
          <section className="mt-4">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-semibold text-gray-900">推荐结果</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {latestSavedAt ? `生成于 ${latestSavedAt}` : '已生成 3 套参考方案'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="rounded-full bg-white p-2 text-gray-500 shadow-sm ring-1 ring-gray-100"
                  aria-label="重新生成"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                    canSave
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-gray-500 ring-1 ring-gray-100'
                  }`}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                  {isAuthenticated ? '保存本次规划' : '登录后可保存'}
                </button>
              </div>
            </div>

            {!isAuthenticated && !authLoading && (
              <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
                你现在可以先试用 AI 规划，登录后可保存到历史记录并随时回看。
              </div>
            )}

            <div className="mt-4 space-y-4">
              {result.options.map((option, index) => (
                <PlanCard
                  key={option.id}
                  index={index}
                  result={option}
                  onOpenDetail={handleOpenDetail}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">历史规划</h2>
            </div>
            {isAuthenticated && historyItems.length > 0 && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                {historyItems.length} 条
              </span>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-500">
              登录后可保存并查看你的 AI 规划历史。
            </div>
          ) : isHistoryLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载历史规划...
            </div>
          ) : historyItems.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-500">
              还没有保存过 AI 规划，先生成一条看看。
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {historyItems.map((item) => {
                const isSelected = selectedHistoryId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenHistory(item)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                      isSelected
                        ? 'bg-emerald-50 ring-1 ring-emerald-200'
                        : 'bg-gray-50 ring-1 ring-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{item.input_query}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {dayjs(item.created_at).format('M月D日 HH:mm')} · {item.result_json?.options?.length || 0} 套方案
                      </p>
                    </div>
                    <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-gray-400" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
