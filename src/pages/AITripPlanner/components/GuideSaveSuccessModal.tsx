import { CheckCircle2 } from 'lucide-react';

type GuideSaveSuccessModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
};

export default function GuideSaveSuccessModal({
  open,
  onClose,
  onOpenDetail
}: GuideSaveSuccessModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-center text-xl font-semibold text-gray-800">攻略已生成</h2>
        <p className="mt-2 text-center text-sm leading-6 text-gray-500">已为你保存，可前往详情页查看</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-200"
          >
            留在当前页
          </button>
          <button
            type="button"
            onClick={onOpenDetail}
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)] transition hover:opacity-95"
          >
            查看详情
          </button>
        </div>
      </div>
    </div>
  );
}
