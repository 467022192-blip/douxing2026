import dayjs from 'dayjs';
import { ChevronRight, History, Loader2 } from 'lucide-react';
import type { SavedAiTripPlan } from '../../../types';

type GuideHistoryListProps = {
  isAuthenticated: boolean;
  isLoading: boolean;
  items: SavedAiTripPlan[];
  selectedId: string | null;
  onOpenHistory: (item: SavedAiTripPlan) => void;
};

export default function GuideHistoryList({
  isAuthenticated,
  isLoading,
  items,
  selectedId,
  onOpenHistory
}: GuideHistoryListProps) {
  return (
    <section className="rounded-[28px] border border-white/80 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">我的攻略</h2>
        </div>
        {isAuthenticated && items.length > 0 ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{items.length} 条</span>
        ) : null}
      </div>

      {!isAuthenticated ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">登录后可保存并回看你的专属攻略。</div>
      ) : isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载你的攻略...
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">还没有保存过攻略，先生成一条看看。</div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenHistory(item)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  isSelected ? 'bg-sky-50 ring-1 ring-sky-200' : 'bg-slate-50 ring-1 ring-transparent hover:bg-slate-100'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.input_query}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dayjs(item.created_at).format('M月D日 HH:mm')} · {item.result_json?.options?.length || 0} 套攻略
                  </p>
                </div>
                <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
