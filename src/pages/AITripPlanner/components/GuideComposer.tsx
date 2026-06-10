import { ArrowUp, Loader2, Sparkles } from 'lucide-react';

type GuideComposerProps = {
  query: string;
  examples: string[];
  isGenerating: boolean;
  onQueryChange: (value: string) => void;
  onUseExample: (value: string) => void;
  onSubmit: () => void;
};

export default function GuideComposer({
  query,
  examples,
  isGenerating,
  onQueryChange,
  onUseExample,
  onSubmit
}: GuideComposerProps) {
  return (
    <section className="rounded-[28px] border border-emerald-100 bg-white px-4 pb-4 pt-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="relative">
        <textarea
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="输入你的需求，比如出行天数、景点偏好、出发地等需求"
          className="h-48 w-full resize-none rounded-[22px] bg-gray-50 px-4 py-4 pr-14 text-sm leading-6 text-gray-800 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-emerald-300"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={isGenerating}
          className="absolute bottom-3 right-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.26)] transition disabled:cursor-not-allowed disabled:opacity-70"
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
