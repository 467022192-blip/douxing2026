import { useState, useMemo, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Ticket, CheckCircle2, Heart, Grid, Search, X, Loader2 } from 'lucide-react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { PROVINCES } from '../../constants/provinces';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { useAttractionSearch } from '../../hooks/useAttractionSearch';
import { getTotalAttractionsCount } from '../../services/supabaseService';
import type { Attraction, UserCheckin } from '../../types';

export default function Home() {
  const navigate = useNavigate();
  const [selectedProvince, setSelectedProvince] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { checkins, isLoading, addCheckin, updateCheckin, removeCheckin } = useAppStore();
  const { isAuthenticated, user } = useAuthStore();

  const [filterType, setFilterType] = useState<'all' | 'visited' | 'want_to_visit' | 'undecided'>('all');
  const [totalCount, setTotalCount] = useState(358);
  const [stableCheckins, setStableCheckins] = useState(checkins);

  useEffect(() => {
    getTotalAttractionsCount().then(count => {
      if (count > 0) setTotalCount(count);
    });
  }, []);

  const checkinsRef = useRef(checkins);
  useEffect(() => {
    checkinsRef.current = checkins;
  }, [checkins]);

  const lastLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (lastLoadingRef.current && !isLoading) {
      setStableCheckins(checkins);
    }
    lastLoadingRef.current = isLoading;
  }, [isLoading, checkins]);

  useEffect(() => {
    setStableCheckins(checkinsRef.current);
  }, [filterType, searchQuery, selectedProvince]);

  // 根据当前 filterType 提取需要过滤的 ID 列表
  const filterIds = useMemo(() => {
    if (filterType === 'visited') {
      return stableCheckins.filter(c => c.status === 'visited').map(c => c.attraction_id);
    } else if (filterType === 'want_to_visit') {
      return stableCheckins.filter(c => c.status === 'want_to_visit').map(c => c.attraction_id);
    }
    return undefined; // 'all' 不传 ids
  }, [filterType, stableCheckins]);

  // 调用后端搜索 Hook
  const { data: displayedAttractions, loading } = useAttractionSearch(searchQuery, filterIds, selectedProvince);

  const stats = useMemo(() => {
    if (!checkins || !Array.isArray(checkins)) return { visited: 0, wantToVisit: 0, undecided: 0 };
    return {
      visited: checkins.filter((c) => c && c.status === 'visited').length,
      wantToVisit: checkins.filter((c) => c && c.status === 'want_to_visit').length,
      undecided: 0 // "再想想" 目前未在模型里实现
    };
  }, [checkins]);

  const getCheckinStatus = (attractionId: string): UserCheckin | undefined => {
    if (!checkins || !Array.isArray(checkins)) return undefined;
    return checkins.find((c) => c && c.attraction_id === attractionId);
  };

  const handleCheckin = async (attraction: Attraction, status: 'visited' | 'want_to_visit') => {
    if (!isAuthenticated || !user) {
      if (window.confirm('标记景区需要先登录，是否前往登录？')) {
        navigate('/login');
      }
      return;
    }

    const existing = getCheckinStatus(attraction.id);
    if (existing) {
      if (existing.status === status) {
        await removeCheckin(existing.id);
      } else {
        await updateCheckin(existing.id, { status });
      }
    } else {
      await addCheckin({
        user_id: user.id,
        attraction_id: attraction.id,
        status,
        visit_count: status === 'visited' ? 1 : 0,
        visited_at: status === 'visited' ? new Date().toISOString() : null,
      });
    }
  };


  // 排序：先按行为 (想去>未标记>去过)，再按伪热度
  const sortedAttractions = useMemo(() => {
    // 简单的字符串哈希，生成稳定的伪热度分数
    const getPopularity = (id: string) => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash) % 10000;
    };

    // 将 stableCheckins 转换为 Map，将 O(N*M) 的查找优化为 O(N)
    const checkinMap = new Map(stableCheckins.map(c => [c.attraction_id, c.status]));

    const getStatusScore = (id: string) => {
      const status = checkinMap.get(id);
      if (status === 'want_to_visit') return 2;
      if (status === 'visited') return 0;
      return 1; // unmarked
    };

    // 预计算所有排序字段，大幅提升性能 (Schwartzian transform)
    const mapped = displayedAttractions.map(attraction => ({
      attraction,
      score: getStatusScore(attraction.id),
      popularity: getPopularity(attraction.id)
    }));

    mapped.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return b.popularity - a.popularity;
    });

    return mapped.map(item => item.attraction);
  }, [displayedAttractions, stableCheckins]);

  const visibleAttractions = sortedAttractions;

  // 辅助函数：高亮搜索文本
  const highlightText = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${query.trim()})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.trim().toLowerCase() ? 
        <span key={i} className="text-emerald-400 font-black">{part}</span> : part
    );
  };

  // 辅助函数：优化图片加载大小，将 1200 宽度的图片压缩到 600，降低 quality 到 80，兼顾加载速度与图片质量
  const getOptimizedImageUrl = (url: string) => {
    if (!url) return '';
    return url.replace(/w=\d+/, 'w=600').replace(/quality=\d+/, 'quality=80');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
      {/* 头部：数据概览与搜索 */}
      <div className="bg-white px-4 pt-4 pb-4 shrink-0">
        
        {/* 全局搜索栏 */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="搜索景区名称或城市..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 text-sm text-gray-900 rounded-full pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X size={16} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* 数据概览卡片 */}
        <div className="flex justify-between">
          <div 
            className={`flex flex-col items-center justify-center p-3 rounded-2xl flex-1 mr-2 transition-colors ${filterType === 'all' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'} cursor-pointer`}
            onClick={() => setFilterType('all')}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Grid size={16} className={filterType === 'all' ? 'text-blue-500' : 'text-gray-400'} />
              <span className="font-medium text-sm">推荐</span>
            </div>
            <div className={`text-xs px-2 py-0.5 rounded-full font-bold ${filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {totalCount}
            </div>
          </div>
          
          <div 
            className={`flex flex-col items-center justify-center p-3 rounded-2xl flex-1 mr-2 transition-colors ${filterType === 'want_to_visit' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-600'} cursor-pointer`}
            onClick={() => setFilterType('want_to_visit')}
          >
            <div className={`flex items-center gap-1.5 mb-1 ${filterType === 'want_to_visit' ? 'text-amber-600' : 'text-gray-500'}`}>
              <Heart size={16} className={`text-amber-500 ${filterType === 'want_to_visit' ? 'fill-amber-500' : ''}`} />
              <span className="text-xs whitespace-nowrap">想去</span>
            </div>
            <span className="font-bold text-lg leading-none">{stats.wantToVisit}</span>
          </div>

          <div 
            className={`flex flex-col items-center justify-center p-3 rounded-2xl flex-1 transition-colors ${filterType === 'visited' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-600'} cursor-pointer`}
            onClick={() => setFilterType('visited')}
          >
            <div className={`flex items-center gap-1.5 mb-1 ${filterType === 'visited' ? 'text-emerald-600' : 'text-gray-500'}`}>
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xs whitespace-nowrap">去过</span>
            </div>
            <span className="font-bold text-lg leading-none">{stats.visited}</span>
          </div>
        </div>
      </div>

      {/* 省份筛选标签 (横向滚动) */}
      <div className="bg-gray-50 pt-3 pb-2 shrink-0 shadow-sm border-b border-gray-100 z-10">
        <div className="flex overflow-x-auto px-4 gap-2 no-scrollbar">
          {PROVINCES.map((province) => (
            <button
              key={province.code}
              onClick={() => setSelectedProvince(province.name)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm transition-colors border ${
                selectedProvince === province.name
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {province.name}
            </button>
          ))}
        </div>
      </div>

      {/* 景区列表区域 */}
      <div className="flex-1 px-4 pt-4 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : displayedAttractions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>暂无景区数据</p>
          </div>
        ) : (
          <AutoSizer
            renderProp={({ height, width }) => {
              if (!height || !width) return null;

              const bottomNavHeight = 64;
              const listHeight = Math.max(0, height - bottomNavHeight);

              type RowProps = {
                attractions: Attraction[];
                searchQuery: string;
                getCheckinStatus: (attractionId: string) => UserCheckin | undefined;
                handleCheckin: (attraction: Attraction, status: 'visited' | 'want_to_visit') => Promise<void>;
                removeCheckin: (id: string) => Promise<void>;
                highlightText: (text: string, query: string) => ReactNode;
                getOptimizedImageUrl: (url: string) => string;
                navigate: ReturnType<typeof useNavigate>;
              };

              const rowProps: RowProps = {
                attractions: visibleAttractions,
                searchQuery,
                getCheckinStatus,
                handleCheckin,
                removeCheckin,
                highlightText,
                getOptimizedImageUrl,
                navigate
              };

              const rowComponent = (props: {
                ariaAttributes: {
                  'aria-posinset': number;
                  'aria-setsize': number;
                  role: 'listitem';
                };
                index: number;
                style: CSSProperties;
              } & RowProps): JSX.Element | null => {
                const { index, style, ...rest } = props;
                const attraction = rest.attractions[index];
                if (!attraction || !attraction.id) return null;

                const checkin = rest.getCheckinStatus(attraction.id);
                const isVisited = checkin?.status === 'visited';
                const isWantToVisit = checkin?.status === 'want_to_visit';

                return (
                  <div style={{ ...style, paddingBottom: 16 }}>
                    <div
                      className="relative rounded-2xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer h-full overflow-hidden group"
                      onClick={() => rest.navigate(`/attraction/${attraction.id}`)}
                    >
                      <img
                        src={rest.getOptimizedImageUrl(attraction.image_url)}
                        alt={attraction.name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallbacks = [
                            '1464822759023-fed622ff2c3b',
                            '1437482078695-73f5ca6c96e2',
                            '1552604617-eea98aa27234',
                            '1555881400-74d7acaacd8b',
                            '1441974231531-c6227db76b6e',
                            '1476514525535-07fb3b4ae5f1'
                          ];
                          const idx = (parseInt(attraction.id) || 0) % fallbacks.length;
                          const fallbackUrl = `https://images.unsplash.com/photo-${fallbacks[idx]}?w=600&auto=format&fit=crop&q=80`;

                          if (target.src !== fallbackUrl) {
                            target.src = fallbackUrl;
                          }
                        }}
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40"></div>

                      <div className="relative z-10 flex flex-col h-full justify-between p-4">
                        <div className="flex justify-end">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isWantToVisit && checkin) {
                                  void rest.removeCheckin(checkin.id);
                                } else {
                                  void rest.handleCheckin(attraction, 'want_to_visit');
                                }
                              }}
                              className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                                isWantToVisit
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-black/40 border border-white/20 hover:bg-black/60'
                              }`}
                            >
                              <Heart size={18} className={isWantToVisit ? 'text-white fill-white' : 'text-amber-400'} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isVisited && checkin) {
                                  void rest.removeCheckin(checkin.id);
                                } else {
                                  void rest.handleCheckin(attraction, 'visited');
                                }
                              }}
                              className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                                isVisited
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-black/40 border border-white/20 hover:bg-black/60'
                              }`}
                            >
                              <CheckCircle2 size={18} className={isVisited ? 'text-white' : 'text-emerald-400'} />
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-bold text-white text-lg truncate mb-1 shadow-sm">
                            {rest.highlightText(attraction.name, rest.searchQuery)}
                          </h3>

                          <div className="flex items-center gap-1 text-xs text-gray-200 mb-2">
                            <MapPin size={12} />
                            <span className="truncate">
                              {rest.highlightText(attraction.address || `${attraction.province} · ${attraction.city}`, rest.searchQuery)}
                            </span>
                          </div>

                          <p className="text-xs text-gray-300 line-clamp-1 mb-3">{attraction.description || '暂无简介'}</p>

                          <div className="flex items-center justify-between text-xs text-gray-200">
                            <div className="flex items-center gap-1 shrink-0">
                              <Ticket size={12} className="text-emerald-400" />
                              <span>{attraction.ticket_price === 0 ? '免费' : `${attraction.ticket_price}元`}</span>
                            </div>
                            <div className="flex items-center gap-1 truncate ml-3">
                              <Clock size={12} className="shrink-0 text-blue-400" />
                              <span className="truncate">{attraction.open_time || '全天开放'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <List<RowProps>
                  rowCount={visibleAttractions.length}
                  rowHeight={208}
                  overscanCount={6}
                  style={{ height: listHeight, width, overflow: 'auto' }}
                  rowComponent={rowComponent}
                  rowProps={rowProps}
                />
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
