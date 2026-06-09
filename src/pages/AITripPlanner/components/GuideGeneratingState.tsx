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
    <section className="rounded-[28px] border border-emerald-100 bg-white p-4 shadow-sm ring-1 ring-emerald-50">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          {showTimeoutActions ? <Hourglass className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">{stageLabel}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">通常30秒左右，复杂需求会更久。当前已等待 {elapsedSeconds} 秒。</p>
          {showTimeoutActions ? (
            <>
              <p className="mt-3 text-xs leading-5 text-gray-500">如果你刚刚描述得很详细，生成时间会更长一些。</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onContinueWait}
                  className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                >
                  继续等待
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新生成
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs leading-5 text-gray-500">{detailText}</p>
          )}
        </div>
      </div>
    </section>
  );
}
