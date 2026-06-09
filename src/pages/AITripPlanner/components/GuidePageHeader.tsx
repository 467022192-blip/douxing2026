import { trackEvent } from '../../../utils/monitoring';

type GuidePageHeaderProps = {
  onOpenHistory: () => void;
};

export default function GuidePageHeader({ onOpenHistory }: GuidePageHeaderProps) {
  return (
    <header className="px-1 pt-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            trackEvent('guide_history_entry_click');
            onOpenHistory();
          }}
          className="inline-flex shrink-0 items-center rounded-full bg-white px-3 py-2 text-[13px] font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-50"
        >
          我的攻略
        </button>
      </div>

      <div className="mt-4 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-800">旅行攻略智能生成</h1>
        <p className="mt-2 text-[13px] leading-5 text-gray-500 whitespace-nowrap">
          说出你的出行天数、景点偏好、出发地等需求
        </p>
      </div>
    </header>
  );
}
