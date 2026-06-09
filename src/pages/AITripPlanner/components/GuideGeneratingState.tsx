import { Hourglass, Loader2, RefreshCw } from 'lucide-react';

type GuideGeneratingStateProps = {
  stageLabel: string;
  elapsedSeconds: number;
  showTimeoutActions: boolean;
  detailText: string;
  onContinueWait: () => void;
  onRetry: () => void;
};

export default function GuideGeneratingState({
  stageLabel,
  elapsedSeconds,
  showTimeoutActions,
  detailText,
  onContinueWait,
  onRetry
}: GuideGeneratingStateProps) {
  return (
    <section className="rounded-[28px] border border-sky-100 bg-white/90 p-4 shadow-sm ring-1 ring-sky-50">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-500">
          {showTimeoutActions ? <Hourglass className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{stageLabel}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">通常 15-30 秒，复杂需求会更久。当前已等待 {elapsedSeconds} 秒。</p>
          {showTimeoutActions ? (
            <>
              <p className="mt-3 text-xs leading-5 text-slate-500">如果你刚刚描述得很详细，生成时间会更长一些。</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onContinueWait}
                  className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-600"
                >
                  继续等待
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新生成
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs leading-5 text-slate-500">{detailText}</p>
          )}
        </div>
      </div>
    </section>
  );
}
