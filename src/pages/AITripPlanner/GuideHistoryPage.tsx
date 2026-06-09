import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { ArrowLeft, ChevronRight, Footprints, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMyAiTripPlanSummaries } from '../../services/aiTripPlannerService';
import { useAuthStore } from '../../stores/authStore';
import type { SavedAiTripPlanSummary } from '../../types';
import { trackEvent } from '../../utils/monitoring';

export default function GuideHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const [items, setItems] = useState<SavedAiTripPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const emptyTrackedRef = useRef(false);
  const redirectStartedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated || redirectStartedRef.current) return;

    trackEvent('guide_history_empty_expose', {
      isAuthenticated: false,
      emptyType: 'needs-login'
    });
    redirectStartedRef.current = true;
    navigate('/login', {
      replace: true,
      state: { redirectTo: location.pathname }
    });
  }, [isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const data = await getMyAiTripPlanSummaries(user.id);
        setItems(data);
        if (data.length === 0 && !emptyTrackedRef.current) {
          trackEvent('guide_history_empty_expose', {
            isAuthenticated: true,
            emptyType: 'no-data'
          });
          emptyTrackedRef.current = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '加载我的攻略失败，请稍后再试';
        setErrorMessage(message || '加载我的攻略失败，请稍后再试');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [isAuthenticated, user?.id]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="mx-auto max-w-md px-4 pb-8 pt-4">
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={() => navigate('/ai-trip-planner')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-gray-100"
            aria-label="返回攻略主页"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">我的攻略</h1>
            <p className="mt-1 text-sm text-gray-500">自动保存的攻略会按时间倒序展示在这里</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600 shadow-sm">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-6 flex items-center gap-2 rounded-[28px] bg-white px-4 py-5 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载你的攻略...
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-[28px] bg-white px-5 py-8 text-center shadow-sm ring-1 ring-gray-100">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Footprints className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-800">还没有保存过攻略</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">先去生成一条专属攻略，之后就能在这里随时回看。</p>
            <button
              type="button"
              onClick={() => navigate('/ai-trip-planner')}
              className="mt-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-medium text-white"
            >
              去生成攻略
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  trackEvent('guide_history_detail_open', {
                    id: item.id,
                    source: 'history-list'
                  });
                  navigate(`/ai-trip-planner/history/${item.id}`);
                }}
                className="w-full rounded-[28px] bg-white px-4 py-4 text-left shadow-sm ring-1 ring-gray-100 transition hover:ring-emerald-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{item.input_query}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {dayjs(item.created_at).format('M月D日 HH:mm')} · 3 套方案
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
