import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Clock, Ticket, CheckCircle2, Heart, ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { getAttractionsById } from '../../services/supabaseService';
import type { Attraction } from '../../types';

export default function AttractionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(true);

  const { checkins, addCheckin, updateCheckin } = useAppStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getAttractionsById(id)
      .then(data => {
        setAttraction(data);
      })
      .catch(err => {
        console.error('获取景区详情失败:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-gray-500">正在加载景区信息...</p>
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
        {attraction.image_url ? (
          <img
            src={attraction.image_url}
            alt={attraction.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const fallbacks = [
                '1464822759023-fed622ff2c3b', '1437482078695-73f5ca6c96e2', 
                '1552604617-eea98aa27234', '1555881400-74d7acaacd8b',
                '1441974231531-c6227db76b6e', '1476514525535-07fb3b4ae5f1'
              ];
              const idx = (parseInt(attraction.id) || 0) % fallbacks.length;
              const fallbackUrl = 'https://images.unsplash.com/photo-' + fallbacks[idx] + '?w=800&auto=format&fit=crop&q=80';
              if (target.src !== fallbackUrl) {
                target.src = fallbackUrl;
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
            <span>{attraction.province} · {attraction.city}</span>
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
          <p className="text-gray-600 text-sm leading-relaxed">
            {attraction.description || '暂无详细简介。这可能是一个非常神秘的美丽景点，等待你去亲自探索。'}
          </p>

          <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 bg-gray-50 p-3 rounded-xl">
              <div className="p-1.5 bg-emerald-100/50 rounded-lg shrink-0">
                <Ticket size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-0.5">参考门票</p>
                <p className="text-sm font-bold text-gray-900 leading-snug">
                  {attraction.price_desc || (attraction.ticket_price === 0 ? '免费开放' : `约 ${attraction.ticket_price} 元`)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-gray-50 p-3 rounded-xl">
              <div className="p-1.5 bg-blue-100/50 rounded-lg shrink-0">
                <Clock size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-0.5">开放时间</p>
                <p className="text-sm font-bold text-gray-900 leading-snug">
                  {attraction.open_time || '全天开放'}
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