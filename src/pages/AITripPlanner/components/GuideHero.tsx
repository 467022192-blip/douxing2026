import { Bot, Sparkles } from 'lucide-react';

export default function GuideHero() {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 px-5 pb-6 pt-7 shadow-[0_16px_40px_rgba(15,118,110,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_55%)]" />
      <div className="relative flex flex-col items-center text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/80 bg-white shadow-[0_12px_30px_rgba(59,130,246,0.12)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-cyan-400 to-emerald-400 text-white shadow-inner">
            <Bot className="h-8 w-8" />
          </div>
          <span className="absolute right-0 top-1 rounded-full bg-violet-500 px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-sm">
            AI
          </span>
        </div>
        <h1 className="mt-5 text-[30px] font-semibold tracking-tight text-slate-900">我可以帮你做攻略</h1>
        <p className="mt-2 max-w-[280px] text-sm leading-6 text-slate-600">
          说下天数、出发地和偏好，帮你生成 3 套景点攻略
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-sky-600 shadow-sm ring-1 ring-sky-100">
          <Sparkles className="h-3.5 w-3.5" />
          结合海量真实景点库生成
        </div>
      </div>
    </section>
  );
}
