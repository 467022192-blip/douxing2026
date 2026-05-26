import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = {
  open: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
};

export default function ImagePreviewModal({ open, images, initialIndex = 0, onClose }: Props) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const i = Number.isFinite(initialIndex) ? Math.max(0, Math.min(initialIndex, Math.max(0, safeImages.length - 1))) : 0;
    setIndex(i);
  }, [open, initialIndex, safeImages.length]);

  const canPrev = safeImages.length > 1 && index > 0;
  const canNext = safeImages.length > 1 && index < safeImages.length - 1;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' && canPrev) {
        setIndex((v) => Math.max(0, v - 1));
      }
      if (e.key === 'ArrowRight' && canNext) {
        setIndex((v) => Math.min(safeImages.length - 1, v + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, canPrev, canNext, safeImages.length]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const src = safeImages[index];

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90"
      role="dialog"
      aria-modal="true"
      data-testid="image-preview-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="absolute right-4 top-4 z-[210] w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        onClick={onClose}
        aria-label="关闭"
      >
        <X size={22} />
      </button>

      {safeImages.length > 1 && (
        <div className="absolute top-5 left-4 z-[210] text-xs text-white/70">
          {index + 1}/{safeImages.length}
        </div>
      )}

      {safeImages.length > 1 && (
        <>
          <button
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-[210] w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              canPrev ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-white/30'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (canPrev) setIndex((v) => Math.max(0, v - 1));
            }}
            aria-label="上一张"
            disabled={!canPrev}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            className={`absolute right-3 top-1/2 -translate-y-1/2 z-[210] w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              canNext ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-white/30'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (canNext) setIndex((v) => Math.min(safeImages.length - 1, v + 1));
            }}
            aria-label="下一张"
            disabled={!canNext}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div className="w-full h-full flex items-center justify-center px-4 py-14">
        {src ? (
          <img src={src} alt="预览" className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="text-white/70 text-sm">图片加载失败</div>
        )}
      </div>
    </div>
  );
}
