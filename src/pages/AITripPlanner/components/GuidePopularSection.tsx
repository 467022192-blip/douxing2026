import { Heart } from 'lucide-react';

type PopularGuideItem = {
  id: string;
  title: string;
  summary: string;
  metaText: string;
  coverPrompt: string;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
};

type GuidePopularSectionProps = {
  items: PopularGuideItem[];
};

const buildGuideCoverUrl = (prompt: string) =>
  `https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `${prompt}, cinematic travel photography, unique composition, premium editorial cover, realistic natural light, mobile app card cover, no text`
  )}&image_size=landscape_16_9`;

export default function GuidePopularSection({ items }: GuidePopularSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="px-1">
        <h2 className="text-lg font-semibold text-gray-800">热门攻略</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className="overflow-hidden rounded-[24px] bg-white text-left shadow-[0_16px_36px_rgba(15,23,42,0.08)] ring-1 ring-emerald-100/80 transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.12)]"
            >
              <div className="relative m-2 overflow-hidden rounded-[20px] bg-gray-100">
                <img
                  src={buildGuideCoverUrl(item.coverPrompt)}
                  alt={item.title}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  aria-label={item.isFavorited ? '取消收藏攻略' : '收藏攻略'}
                  onClick={(event) => {
                    event.stopPropagation();
                    item.onToggleFavorite();
                  }}
                  className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
                    item.isFavorited
                      ? 'bg-amber-500 text-white'
                      : 'border border-white/20 bg-black/40 hover:bg-black/60'
                  }`}
                >
                  <Heart
                    size={18}
                    className={item.isFavorited ? 'fill-white text-white' : 'text-amber-400'}
                  />
                </button>
              </div>
              <div className="px-3 pb-3 pt-1">
                <h3 className="line-clamp-2 text-[15px] font-semibold leading-6 text-gray-900">{item.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">{item.summary}</p>
                <div className="mt-3 text-xs text-emerald-600">{item.metaText}</div>
              </div>
            </button>
          ))}
      </div>
    </section>
  );
}
