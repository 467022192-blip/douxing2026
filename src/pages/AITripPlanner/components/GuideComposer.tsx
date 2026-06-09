import { ArrowUp, Loader2, Sparkles } from 'lucide-react';

type GuideComposerProps = {
  query: string;
  examples: string[];
  isGenerating: boolean;
  helperText?: string;
  onQueryChange: (value: string) => void;
  onUseExample: (value: string) => void;
  onSubmit: () => void;
};

export default function GuideComposer({
  query,
  examples,
  isGenerating,
  helperText,
  onQueryChange,
  onUseExample,
  onSubmit
}: GuideComposerProps) {
  return (
    <section className="rounded-[28px] border border-sky-200/80 bg-white px-4 pb-4 pt-4 shadow-[0_18px_48px_rgba(59,130,246,0.10)]">
      <textarea
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="例如：5天4夜的行程，一家三口，有个6岁的小孩，想去海边，从北京出发"
        className="h-36 w-full resize-none rounded-[22px] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-sky-300"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onUseExample(item)}
            className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-600 transition hover:bg-sky-100"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">告诉我你的旅行想法</p>
          {helperText ? <p className="mt-1 text-xs text-slate-400">{helperText}</p> : null}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isGenerating}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-cyan-400 to-emerald-400 text-white shadow-[0_10px_24px_rgba(14,165,233,0.28)] transition disabled:cursor-not-allowed disabled:opacity-70"
          aria-label={isGenerating ? '正在生成攻略' : '开始生成攻略'}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : query.trim() ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </button>
      </div>
    </section>
  );
}
