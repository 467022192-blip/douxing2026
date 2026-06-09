type GuideTabIconProps = {
  active?: boolean;
  className?: string;
};

export default function GuideTabIcon({ active = false, className = '' }: GuideTabIconProps) {
  return (
    <div
      className={`relative flex h-6 w-6 items-center justify-center ${
        active ? 'text-emerald-600' : 'text-slate-400'
      } ${className}`.trim()}
    >
      <div className={`relative h-[22px] w-[22px] transition-all ${active ? 'drop-shadow-[0_4px_10px_rgba(16,185,129,0.22)]' : ''}`}>
        <div className="absolute left-[0px] bottom-[1px] h-[14px] w-[11px] -rotate-[18deg]">
          <span className="absolute left-[1px] top-[0px] h-[3.2px] w-[3.2px] rounded-full bg-current" />
          <span className="absolute left-[4px] -top-[1px] h-[3.8px] w-[3.8px] rounded-full bg-current" />
          <span className="absolute left-[7px] top-[0px] h-[3.6px] w-[3.6px] rounded-full bg-current" />
          <span className="absolute left-[9px] top-[3px] h-[3px] w-[3px] rounded-full bg-current" />
          <span className="absolute left-[1px] top-[4px] h-[10px] w-[9px] rounded-[55%_55%_48%_48%/35%_35%_70%_70%] bg-current" />
        </div>

        <div className="absolute right-[0px] top-[0px] h-[15px] w-[11px] rotate-[16deg]">
          <span className="absolute left-[0px] top-[2px] h-[3px] w-[3px] rounded-full bg-current" />
          <span className="absolute left-[2px] top-[-1px] h-[3.8px] w-[3.8px] rounded-full bg-current" />
          <span className="absolute left-[6px] top-[-1px] h-[3.8px] w-[3.8px] rounded-full bg-current" />
          <span className="absolute left-[9px] top-[2px] h-[3.2px] w-[3.2px] rounded-full bg-current" />
          <span className="absolute left-[1px] top-[4px] h-[11px] w-[9px] rounded-[55%_55%_48%_48%/35%_35%_70%_70%] bg-current" />
        </div>
      </div>

      <span
        className={`absolute -right-[8px] -top-[5px] rounded-full px-1.5 py-[1px] text-[8px] font-semibold leading-none shadow-sm transition-all ${
          active
            ? 'animate-pulse bg-violet-500 text-white'
            : 'bg-violet-100 text-violet-600'
        }`}
      >
        AI
      </span>
    </div>
  );
}
