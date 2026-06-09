import { Sparkles } from 'lucide-react';

type GuideTabIconProps = {
  active?: boolean;
  className?: string;
};

export default function GuideTabIcon({ active = false, className = '' }: GuideTabIconProps) {
  return (
    <div className={`relative flex h-6 w-6 items-center justify-center ${className}`.trim()}>
      <div
        className={`flex h-[22px] w-[22px] items-center justify-center rounded-[9px] border transition-all ${
          active
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-400 via-cyan-400 to-sky-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.25)]'
            : 'border-sky-100 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 text-sky-500'
        }`}
      >
        <Sparkles className={`h-3.5 w-3.5 ${active ? 'scale-105' : ''}`} />
      </div>
      <span
        className={`absolute -right-2 -top-1 rounded-full px-1.5 py-[1px] text-[8px] font-semibold leading-none ${
          active ? 'bg-violet-500 text-white' : 'bg-violet-100 text-violet-600'
        }`}
      >
        AI
      </span>
    </div>
  );
}
