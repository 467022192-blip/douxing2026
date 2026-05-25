import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, MapPin, Clock, Ticket, CheckCircle2, Heart, ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { getAttractionsById } from '../../services/supabaseService';
import { getLocalCache, setLocalCache } from '../../utils/localCache';
import type { Attraction } from '../../types';

export default function AttractionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadError, setLoadError] = useState<string>('');
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const cacheKey = id ? `attractions:detail:${id}` : '';

  const { checkins, addCheckin, updateCheckin } = useAppStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLoadError('缺少景区 ID');
      return;
    }

    const preview = (location.state as { attraction?: Attraction } | null)?.attraction;
    const cached = cacheKey ? getLocalCache<Attraction>(cacheKey) : null;
    if (preview) {
      setAttraction(preview);
      setLoading(false);
      setIsFetchingDetails(true);
    } else if (cached) {
      setAttraction(cached);
      setLoading(false);
      setIsFetchingDetails(true);
    } else {
      setLoading(true);
      setIsFetchingDetails(true);
    }
    setLoadError('');

    let active = true;
    const timeoutMs = 15000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });

    Promise.race([getAttractionsById(id), timeoutPromise])
      .then((data) => {
        if (!active) return;
        setAttraction(data);
        if (cacheKey) {
          setLocalCache(cacheKey, data, 24 * 60 * 60 * 1000);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('获取景区详情失败:', err);
        if (!preview && !cached) {
          setLoadError('景区详情加载失败，请重试');
        }
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setIsFetchingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [cacheKey, id, location.state]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-gray-500">正在加载景区信息...</p>
      </div>
    );
  }

  if (loadError && !attraction) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-gray-700 font-medium">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-full text-sm"
        >
          重试
        </button>
      </div>
    );
  }

  if (!attraction) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">未找到该景区信息</p>
        <button 
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-emerald-500 text-white rounded-full text-sm"
        >
          返回上一页
        </button>
      </div>
    );
  }

  const checkin = checkins.find((c) => c.attraction_id === attraction.id);
  const isVisited = checkin?.status === 'visited';
  const isWantToVisit = checkin?.status === 'want_to_visit';

  const handleCheckin = async (status: 'visited' | 'want_to_visit') => {
    if (!isAuthenticated) {
      if (window.confirm('标记景区需要先登录，是否前往登录？')) {
        navigate('/login');
      }
      return;
    }

    if (checkin) {
      if (checkin.status === status) {
        // 如果再次点击相同状态，目前简单处理为无操作或可通过 removeCheckin 取消
        // 这里为了简化，仅支持状态切换
      } else {
        await updateCheckin(checkin.id, { status });
      }
    } else {
      await addCheckin({
        user_id: 'current-user', // 将在 store 中被真实 user_id 替换
        attraction_id: attraction.id,
        status,
        visit_count: status === 'visited' ? 1 : 0,
        visited_at: status === 'visited' ? new Date().toISOString() : null,
      });
    }
  };

  const openDouyinSearch = () => {
    const searchQuery = encodeURIComponent(`${attraction.city} ${attraction.name}`);
    window.open(`https://www.douyin.com/search/${searchQuery}`, '_blank');
  };

  const descriptionText = (() => {
    const tips = attraction.tips?.trim();
    if (tips) return tips;
    if (isFetchingDetails) return '简介加载中…';
    return '暂无详细简介。这可能是一个非常神秘的美丽景点，等待你去亲自探索。';
  })();
  const isLongText = descriptionText.length > 100;

  const formatPriceDesc = (raw: string) => {
    const text = raw.trim();
    if (!text) return '';
    if (text.includes('旺季') && text.includes('淡季')) {
      const normalized = text.replace(/\s*\/\s*/g, '\n');
      return normalized;
    }
    return text;
  };

  const ticketText = (() => {
    if (attraction.price_desc) return formatPriceDesc(attraction.price_desc);
    if (attraction.ticket_price === 0) return '免费开放';
    return `约 ${attraction.ticket_price} 元`;
  })();

  const openTimeText = attraction.open_time || '全天开放';

  const imagePlaceholder =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="576" viewBox="0 0 800 576"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#e5f7f0" offset="0"/><stop stop-color="#eaf2ff" offset="1"/></linearGradient></defs><rect width="800" height="576" fill="url(#g)"/><path d="M0 460 C 120 380, 240 520, 400 460 S 680 380, 800 460 V 576 H 0 Z" fill="#d7efe6" opacity="0.9"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-size="24" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial">图片加载中</text></svg>`
    );

  const safeImageUrl = (() => {
    const raw = attraction.image_url || '';
    if (!raw) return '';
    if (raw.startsWith('http://')) return raw.replace('http://', 'https://');
    if (raw.includes('images.unsplash.com')) return '';
    return raw;
  })();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 头部导航 */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 truncate flex-1 text-center px-4">
          {attraction.name}
        </h1>
        <div className="w-10"></div> {/* 占位以保证标题居中 */}
      </div>

        {/* 头图 */}
      <div className="w-full h-72 bg-gray-200 relative overflow-hidden">
        {safeImageUrl ? (
          <img
            src={safeImageUrl}
            alt={attraction.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== imagePlaceholder) {
                target.src = imagePlaceholder;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
            <ImageIcon size={48} className="mb-2 opacity-20" />
            <span className="text-sm">暂无实景图片</span>
          </div>
        )}

        {/* 右上角操作按钮 */}
        <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCheckin('want_to_visit');
            }}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full backdrop-blur-md transition-colors ${
              isWantToVisit ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-black/40 text-white/90 border border-white/20 hover:bg-black/60'
            }`}
          >
            <Heart size={20} className={isWantToVisit ? "text-white fill-white" : "text-amber-400"} />
            <span className="text-[10px] mt-0.5 leading-none font-medium scale-90 origin-top">{isWantToVisit ? '想去' : '想去'}</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCheckin('visited');
            }}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-full backdrop-blur-md transition-colors ${
              isVisited ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-black/40 text-white/90 border border-white/20 hover:bg-black/60'
            }`}
          >
            <CheckCircle2 size={20} className={isVisited ? "text-white" : "text-emerald-400"} />
            <span className="text-[10px] mt-0.5 leading-none font-medium scale-90 origin-top">{isVisited ? '去过' : '去过'}</span>
          </button>
        </div>
        
        {/* 底部渐变遮罩 */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-1.5 text-sm opacity-90 mb-1">
            <MapPin size={14} />
            <span className="truncate">{attraction.address || `${attraction.province} · ${attraction.city}`}</span>
          </div>
          <h2 className="text-2xl font-bold">{attraction.name}</h2>
        </div>
      </div>

      {/* 核心信息面板 */}
      <div className="px-4 py-5 space-y-5">
        
        {/* 外部链接：抖音模块 */}
        <button 
          onClick={openDouyinSearch}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center text-white shadow-md">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900 text-[15px]">去抖音看该景区</p>
              <p className="text-xs text-gray-500 mt-0.5">查看最新动态，获取游玩攻略</p>
            </div>
          </div>
          <ExternalLink size={18} className="text-gray-400" />
        </button>

        {/* 基础信息 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
            景区简介
          </h3>
          <div className="relative">
            <p className={`text-gray-600 text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-4'}`}>
              {descriptionText}
            </p>
            {isLongText && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-emerald-500 text-xs font-medium mt-1 flex items-center gap-0.5"
              >
                {isExpanded ? '收起' : '展开阅读'} 
                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 bg-gray-50 p-3 rounded-xl">
              <div className="p-1.5 bg-emerald-100/50 rounded-lg shrink-0">
                <Ticket size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-0.5">参考门票</p>
                <p className="text-xs font-semibold text-gray-900 leading-snug whitespace-pre-line">
                  {ticketText}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-gray-50 p-3 rounded-xl">
              <div className="p-1.5 bg-blue-100/50 rounded-lg shrink-0">
                <Clock size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-0.5">开放时间</p>
                <p className="text-xs font-semibold text-gray-900 leading-snug whitespace-pre-line">
                  {openTimeText}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 详细地址 */}
        <div 
          className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => navigate(`/footprint?focus=${attraction.id}`)}
        >
          <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
            详细地址
          </h3>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600 leading-relaxed flex-1">
              {attraction.address || `${attraction.province}${attraction.city}${attraction.name}`}
            </p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full shrink-0">
              <MapPin size={16} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
