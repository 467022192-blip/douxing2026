import { ChevronRight, MapPinned, Sparkles } from 'lucide-react';
import type { TripPlanAttractionItem, TripPlanOption } from '../../../types';

type GuideResultCardProps = {
  index: number;
  option: TripPlanOption;
  onOpenDetail: (id: string) => void;
};

function AttractionPill({ item, onOpenDetail }: { item: TripPlanAttractionItem; onOpenDetail: (id: string) => void }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
          {(item.province || item.city) && (
            <p className="mt-1 text-xs text-slate-500">{[item.province, item.city].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        {item.matchedAttractionId ? (
          <button
            type="button"
            onClick={() => onOpenDetail(item.matchedAttractionId!)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-sky-600 shadow-sm"
          >
            详情
            <ChevronRight className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {item.summary ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{item.summary}</p> : null}
    </div>
  );
}

export default function GuideResultCard({ index, option, onOpenDetail }: GuideResultCardProps) {
  return (
    <section className="rounded-[28px] border border-white/80 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-500">攻略 {index + 1}</p>
          <h3 className="mt-2 text-lg font-semibold leading-7 text-slate-900">{option.title}</h3>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-500">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-3 rounded-2xl bg-gradient-to-r from-sky-50 to-emerald-50 px-3 py-3 text-sm leading-6 text-slate-700">
        {option.reason}
      </p>

      <div className="mt-4 space-y-3">
        {option.days.map((day) => (
          <div key={`${option.id}-${day.day}`} className="rounded-2xl border border-slate-100 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Day {day.day}</p>
                <p className="mt-1 text-sm text-slate-500">{day.title}</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                <MapPinned className="h-3.5 w-3.5" />
                {day.attractions.length} 个景点
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {day.attractions.map((item, attractionIndex) => (
                <AttractionPill
                  key={`${option.id}-${day.day}-${attractionIndex}-${item.name}`}
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
}
