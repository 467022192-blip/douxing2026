import { ChevronRight, MapPinned, Sparkles } from 'lucide-react';
import type { TripPlanAttractionItem, TripPlanOption } from '../../../types';

type GuideResultCardProps = {
  index: number;
  option: TripPlanOption;
  resolvingAttractionKey?: string | null;
  onOpenDetail: (item: TripPlanAttractionItem) => void;
};

const buildAttractionKey = (item: TripPlanAttractionItem) => [item.name, item.province || '', item.city || ''].join('|');

function AttractionPill({
  item,
  resolvingAttractionKey,
  onOpenDetail
}: {
  item: TripPlanAttractionItem;
  resolvingAttractionKey?: string | null;
  onOpenDetail: (item: TripPlanAttractionItem) => void;
}) {
  const attractionKey = buildAttractionKey(item);
  const isResolving = resolvingAttractionKey === attractionKey;

  return (
    <div className="rounded-2xl bg-gray-50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">{item.name}</p>
          {(item.province || item.city) && (
            <p className="mt-1 text-xs text-gray-500">{[item.province, item.city].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        {item.name ? (
          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            disabled={isResolving}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100 disabled:cursor-wait disabled:opacity-70"
          >
            {isResolving ? '查询中' : '详情'}
            <ChevronRight className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {item.summary ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600">{item.summary}</p> : null}
    </div>
  );
}

export default function GuideResultCard({ index, option, resolvingAttractionKey, onOpenDetail }: GuideResultCardProps) {
  return (
    <section className="rounded-[28px] border border-white/80 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] ring-1 ring-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-500">攻略 {index + 1}</p>
          <h3 className="mt-2 text-lg font-semibold leading-7 text-gray-800">{option.title}</h3>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-3 text-sm leading-6 text-gray-700">
        {option.reason}
      </p>

      <div className="mt-4 space-y-3">
        {option.days.map((day) => (
          <div key={`${option.id}-${day.day}`} className="rounded-2xl border border-gray-100 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Day {day.day}</p>
                <p className="mt-1 text-sm text-gray-500">{day.title}</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                <MapPinned className="h-3.5 w-3.5" />
                {day.attractions.length} 个景点
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {day.attractions.map((item, attractionIndex) => (
                <AttractionPill
                  key={`${option.id}-${day.day}-${attractionIndex}-${item.name}`}
                  item={item}
                  resolvingAttractionKey={resolvingAttractionKey}
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
