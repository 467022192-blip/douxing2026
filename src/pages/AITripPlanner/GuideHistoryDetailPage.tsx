import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import GuideResultCard from './components/GuideResultCard';
import { isPublicPopularTripPlanId, resolveAiTripPlanDetail } from '../../services/aiTripPlannerService';
import { useAuthStore } from '../../stores/authStore';
import type { ResolvedAiTripPlanDetail } from '../../types';

type DetailState = 'loading' | 'ready' | 'unavailable' | 'error';

const getDetailStateFromError = (error: unknown): DetailState => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'error';
  }

  return 'unavailable';
};

export default function GuideHistoryDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuthStore();
  const [item, setItem] = useState<ResolvedAiTripPlanDetail | null>(null);
  const [viewState, setViewState] = useState<DetailState>('loading');
  const isPublicGuide = Boolean(id && isPublicPopularTripPlanId(id));
  const backTo =
    typeof location.state === 'object' && location.state && 'backTo' in location.state && typeof location.state.backTo === 'string'
      ? location.state.backTo
      : isPublicGuide
        ? '/ai-trip-planner'
        : '/ai-trip-planner/history';

  useEffect(() => {
    if (isPublicGuide || isAuthenticated) return;

    navigate('/login', {
      replace: true,
      state: { redirectTo: location.pathname }
    });
  }, [isAuthenticated, isPublicGuide, location.pathname, navigate]);

  useEffect(() => {
    if ((!isAuthenticated && !isPublicGuide) || !id) return;

    const load = async () => {
      setViewState('loading');
      try {
        const data = await resolveAiTripPlanDetail(id);
        setItem(data);
        setViewState('ready');
      } catch (error) {
        setViewState(getDetailStateFromError(error));
      }
    };

    void load();
  }, [id, isAuthenticated, isPublicGuide]);

  const generatedAtText = useMemo(() => {
    if (!item?.created_at) return '';
    return dayjs(item.created_at).format('M月D日 HH:mm');
  }, [item?.created_at]);

  const handleOpenAttraction = (attractionId: string) => {
    navigate(`/attraction/${attractionId}`);
  };

  if (!isAuthenticated && !isPublicGuide) return null;

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="mx-auto max-w-md px-4 pb-8 pt-4">
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-gray-100"
            aria-label={backTo === '/ai-trip-planner' ? '返回攻略主页' : '返回我的攻略'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">攻略详情</h1>
            <p className="mt-1 text-sm text-gray-500">{backTo === '/ai-trip-planner' ? '查看热门攻略的完整内容' : '查看已保存的完整攻略内容'}</p>
          </div>
        </div>

        {viewState === 'loading' ? (
          <div className="mt-6 flex items-center gap-2 rounded-[28px] bg-white px-4 py-5 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载攻略详情...
          </div>
        ) : null}

        {viewState === 'unavailable' ? (
          <div className="mt-6 rounded-[28px] bg-white px-5 py-8 text-center shadow-sm ring-1 ring-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">该攻略不存在或你暂无权限查看</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">你可以先回到我的攻略列表，或重新生成一条新的攻略。</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600"
              >
                {backTo === '/ai-trip-planner' ? '返回攻略主页' : '返回我的攻略'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/ai-trip-planner')}
                className="flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-medium text-white"
              >
                返回攻略主页
              </button>
            </div>
          </div>
        ) : null}

        {viewState === 'error' ? (
          <div className="mt-6 rounded-[28px] border border-red-100 bg-red-50 px-4 py-4 text-sm leading-6 text-red-600 shadow-sm">
            加载攻略详情失败，请稍后再试。
          </div>
        ) : null}

        {viewState === 'ready' && item ? (
          <section className="mt-6">
            <div className="rounded-[28px] bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-500">{item.source_label}</p>
              <h2 className="mt-3 text-lg font-semibold leading-7 text-gray-800">{item.input_query}</h2>
              <p className="mt-2 text-sm text-gray-500">
                {generatedAtText ? `生成于 ${generatedAtText}` : item.source === 'public' ? '来自平台热门攻略' : '已保存到你的攻略历史'}
              </p>
            </div>

            <div className="mt-4 space-y-4">
              {item.result_json.options.map((option, index) => (
                <GuideResultCard key={option.id} index={index} option={option} onOpenDetail={handleOpenAttraction} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
