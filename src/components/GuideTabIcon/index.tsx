type GuideTabIconProps = {
  active?: boolean;
  className?: string;
};

export default function GuideTabIcon({ active = false, className = '' }: GuideTabIconProps) {
  return (
    <div
      className={`relative flex h-6 w-6 items-center justify-center transition-all ${
        active ? 'text-emerald-600' : 'text-slate-400'
      } ${className}`.trim()}
    >
      <div className={`relative h-[22px] w-[22px] transition-all ${active ? 'scale-[1.03]' : ''}`}>
        <svg
          viewBox="0 0 25 26"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <g transform="translate(0.9 8.4) rotate(-14 5.4 7.2)">
            <ellipse cx="1.2" cy="1.95" rx="0.95" ry="1.15" fill="currentColor" opacity="0.86" />
            <ellipse cx="3.3" cy="1.15" rx="1" ry="1.28" fill="currentColor" opacity="0.9" />
            <ellipse cx="5.55" cy="0.82" rx="1.1" ry="1.42" fill="currentColor" />
            <ellipse cx="7.85" cy="1.18" rx="1.06" ry="1.34" fill="currentColor" opacity="0.94" />
            <ellipse cx="10.15" cy="1.92" rx="0.98" ry="1.2" fill="currentColor" opacity="0.9" />
            <path
              d="M2.05 3.15C1.18 3.88 0.7 5.02 0.7 6.52C0.7 8.72 1.95 11.18 3.38 13.2C4.15 14.28 5.15 15 6.38 15C7.42 15 8.24 14.5 8.86 13.6C10.05 11.9 10.82 9.82 10.82 7.75C10.82 4.78 9.05 2.92 6.35 2.92C4.72 2.92 3.12 2.92 2.05 3.15Z"
              fill="currentColor"
            />
            <path
              d="M7.58 9.05C7.1 9.55 6.92 10.58 7.12 11.7C7.35 12.9 7.08 13.58 6.45 14.18C7.26 14.03 7.88 13.46 8.36 12.72C8.78 12.05 9.03 11.08 9.08 10.18C9.12 9.4 8.38 8.2 7.58 9.05Z"
              fill={active ? 'rgba(255,255,255,0.92)' : 'rgba(240,253,250,0.9)'}
            />
          </g>
          <g transform="translate(9.3 0.9) rotate(10 6.7 10.6)">
            <ellipse cx="1.25" cy="2.18" rx="0.98" ry="1.22" fill="currentColor" opacity="0.88" />
            <ellipse cx="3.48" cy="1.18" rx="1.08" ry="1.44" fill="currentColor" opacity="0.92" />
            <ellipse cx="6.08" cy="0.74" rx="1.22" ry="1.62" fill="currentColor" />
            <ellipse cx="8.78" cy="0.98" rx="1.16" ry="1.5" fill="currentColor" opacity="0.95" />
            <ellipse cx="11.18" cy="1.98" rx="1.02" ry="1.26" fill="currentColor" opacity="0.9" />
            <path
              d="M2.55 3.28C1.42 4.18 0.82 5.62 0.82 7.58C0.82 10.55 2.5 13.92 4.42 16.68C5.45 18.15 6.8 19.08 8.45 19.08C9.82 19.08 10.92 18.38 11.72 17.18C13.28 14.87 14.25 12.02 14.25 9.18C14.25 5.08 11.82 2.55 8.12 2.55C5.88 2.55 3.78 2.8 2.55 3.28Z"
              fill="currentColor"
            />
            <path
              d="M10.22 10.08C9.65 10.72 9.42 12.05 9.68 13.42C9.95 14.88 9.58 15.88 8.78 16.62C9.88 16.45 10.75 15.72 11.42 14.72C12.02 13.82 12.38 12.55 12.45 11.35C12.5 10.3 11.18 8.98 10.22 10.08Z"
              fill={active ? 'rgba(255,255,255,0.92)' : 'rgba(240,253,250,0.9)'}
            />
          </g>
        </svg>
      </div>

      <span
        className={`absolute right-[-15px] top-[-6px] inline-flex min-w-[18px] items-center justify-center px-[5px] py-[1.5px] text-[8px] leading-none shadow-[0_4px_12px_rgba(124,58,237,0.26)] transition-all ${
          active
            ? 'animate-pulse bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500 text-white font-bold'
            : 'bg-gradient-to-r from-violet-100 via-fuchsia-50 to-cyan-100 text-violet-700 font-extrabold'
        }`}
        style={{
          clipPath: 'polygon(14% 0%, 100% 0%, 100% 72%, 86% 100%, 0% 100%, 0% 28%)',
        }}
      >
        <span className="absolute inset-[1px] opacity-40" aria-hidden="true" />
        <span className="relative tracking-[0.015em]">AI</span>
      </span>
    </div>
  );
}
