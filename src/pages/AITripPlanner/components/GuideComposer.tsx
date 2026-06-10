import { ArrowUp, Loader2, Sparkles } from 'lucide-react';

type GuideComposerProps = {
  query: string;
  examples: string[];
  isGenerating: boolean;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  onUseExample: (value: string) => void;
  onSubmit: () => void;
};

function ClearBroomIcon() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className="h-9 w-9">
      <circle cx="18" cy="18" r="18" fill="#3B3E57" />
      <g transform="translate(6.48 6.48) scale(0.64)">
        <rect x="14.4" y="4.2" width="7.2" height="8.9" rx="2.2" fill="white" />
        <path
          d="M11.3 12.4C12 11 13.4 10.2 15 10.2H21C22.6 10.2 24 11 24.7 12.4L27.6 17.6C28.1 18.4 27.5 19.4 26.6 19.4H9.4C8.5 19.4 7.9 18.4 8.4 17.6L11.3 12.4Z"
          fill="white"
        />
        <rect x="8.6" y="20.25" width="18.8" height="1.35" rx="0.675" fill="white" />
        <path
          d="M8.95 21.95H27.2V23.35C27.2 24.3 26.88 25.2 26.3 25.95L23.45 29.35C22.98 29.92 22.28 30.24 21.54 30.24H12.3C9.7 30.24 7.6 28.14 7.6 25.54C7.6 24.15 8.12 22.96 8.95 22.08V21.95Z"
          fill="white"
        />
        <path d="M13.4 22.55L11 29.7" stroke="#3B3E57" strokeWidth="1.55" strokeLinecap="round" />
        <path d="M17.7 22.55L14.9 29.85" stroke="#3B3E57" strokeWidth="1.55" strokeLinecap="round" />
        <path d="M22 22.55L19.2 29.85" stroke="#3B3E57" strokeWidth="1.55" strokeLinecap="round" />
        <path d="M25.45 22.8L23.95 28.95" stroke="#3B3E57" strokeWidth="1.55" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function GuideComposer({
  query,
  examples,
  isGenerating,
  onQueryChange,
  onClearQuery,
  onUseExample,
  onSubmit
}: GuideComposerProps) {
  const hasInput = query.length > 0;
  const hasQuery = Boolean(query.trim());

  return (
    <section className="rounded-[28px] border border-emerald-100 bg-white px-4 pb-4 pt-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="relative">
        <textarea
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="输入你的需求，比如出行天数、景点偏好、出发地等需求"
          className="h-48 w-full resize-none rounded-[22px] bg-gray-50 px-4 py-4 pr-28 text-sm leading-6 text-gray-800 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-emerald-300"
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {hasInput ? (
            <button
              type="button"
              onClick={onClearQuery}
              disabled={isGenerating}
              className="flex h-9 w-9 shrink-0 items-center justify-center transition hover:scale-[1.04] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="清空当前输入"
            >
              <ClearBroomIcon />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isGenerating}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.26)] transition disabled:cursor-not-allowed disabled:opacity-70"
            aria-label={isGenerating ? '正在生成攻略' : '开始生成攻略'}
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : hasQuery ? (
              <ArrowUp className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onUseExample(item)}
            className="rounded-full bg-emerald-50 px-3 py-1.5 text-left text-xs font-medium leading-5 text-emerald-700 transition hover:bg-emerald-100"
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
