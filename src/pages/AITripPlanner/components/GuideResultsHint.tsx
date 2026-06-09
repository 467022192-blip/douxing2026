import { ArrowDown } from 'lucide-react';

export default function GuideResultsHint() {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      <ArrowDown className="h-4 w-4 shrink-0" />
      <span>已生成 3 套攻略，向下滑动查看</span>
    </div>
  );
}
