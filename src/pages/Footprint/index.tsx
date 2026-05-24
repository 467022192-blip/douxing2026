import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, X, CheckCircle2, Heart, Route, Database, Plus, Minus, Search } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { useAttractionSearch } from '../../hooks/useAttractionSearch';
import { getTotalAttractionsCount } from '../../services/supabaseService';
import { env } from '../../config/env';
import type { Attraction } from '../../types';
import type { BMapMap, BMapLabel } from '../../types/bmap';

export default function Footprint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<BMapMap | null>(null);
  const markersRef = useRef<{ marker: BMapLabel; attraction: Attraction; isUnmarked: boolean }[]>([]);
  const { checkins } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'visited' | 'want_to_visit'>(() => {
    const wantCount = useAppStore.getState().checkins.filter(c => c.status === 'want_to_visit').length;
    return wantCount > 0 ? 'want_to_visit' : 'all';
  });
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapConfigError, setMapConfigError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(358);

  useEffect(() => {
    getTotalAttractionsCount().then(count => {
      if (count > 0) setTotalCount(count);
    });
  }, []);

  // 根据当前 filter 提取需要过滤的 ID 列表
  const filterIds = useMemo(() => {
    if (filter === 'visited') {
      return checkins.filter(c => c.status === 'visited').map(c => c.attraction_id);
    } else if (filter === 'want_to_visit') {
      return checkins.filter(c => c.status === 'want_to_visit').map(c => c.attraction_id);
    }
    return undefined; // 'all' 不传 ids
  }, [filter, checkins]);

  // 调用后端搜索 Hook
  const { data: displayedAttractions } = useAttractionSearch(searchQuery, filterIds);

  useEffect(() => {
    const baiduMapAk = env.baiduMapAk;

    if (!baiduMapAk) {
      setMapConfigError('未配置百度地图 AK（VITE_BAIDU_MAP_AK），地图无法加载');
      return;
    }
    
    if (window.BMap) {
      setIsMapLoaded(true);
      return;
    }
    
    // 加载百度地图脚本
    const script = document.createElement('script');
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${baiduMapAk}&callback=initMap`;
    script.async = true;
    document.body.appendChild(script);

    window.initMap = () => {
        setIsMapLoaded(true);
      };

    return () => {
      if (script && script.parentNode) {
        document.body.removeChild(script);
      }
      delete window.initMap;
    };
  }, []);

  const updateMarkers = useCallback((shouldFitViewport = false) => {
    if (!mapInstanceRef.current || !window.BMap) return;

    const map = mapInstanceRef.current;

    markersRef.current.forEach(m => {
      try {
        map.removeOverlay(m.marker);
      } catch (error) {
        console.warn('Remove overlay failed', error);
      }
    });
    markersRef.current = [];

    const currentZoom = map.getZoom() || 5;

    displayedAttractions.forEach((attraction) => {
      const point = new window.BMap.Point(attraction.longitude, attraction.latitude);

      const checkin = checkins.find((c) => c.attraction_id === attraction.id);
      const isUnmarked = !checkin;
      const isVisited = checkin?.status === 'visited';

      const showLabel = !isUnmarked || currentZoom >= 7;

      let iconSvg = '';
      if (isVisited) {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><path fill="#10B981" stroke="#ffffff" stroke-width="2" d="M18 2C10.8 2 5 7.8 5 15c0 9 13 19 13 19s13-10 13-19c0-7.2-5.8-13-13-13z"/><path fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M12 15l4 4 8-8"/></svg>`;
      } else if (!isUnmarked) {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><path fill="#F59E0B" stroke="#ffffff" stroke-width="2" d="M18 2C10.8 2 5 7.8 5 15c0 9 13 19 13 19s13-10 13-19c0-7.2-5.8-13-13-13z"/><path fill="#ffffff" d="M18 19.5l-1-1c-3.5-3.2-5.8-5.3-5.8-7.9 0-2.1 1.7-3.8 3.8-3.8 1.2 0 2.4.6 3 1.5.6-.9 1.8-1.5 3-1.5 2.1 0 3.8 1.7 3.8 3.8 0 2.6-2.3 4.7-5.8 7.9l-1 1z"/></svg>`;
      } else {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="#D1D5DB" stroke="#ffffff" stroke-width="2"/></svg>`;
      }

      const displayName = attraction.short_name || attraction.name;

      const labelContent = `
        <div style="cursor: pointer; pointer-events: auto; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          ${iconSvg}
          <div class="custom-bmap-label-text" style="display: ${showLabel ? 'block' : 'none'}; background: rgba(255,255,255,0.95); padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 2px; font-size: 12px; font-weight: ${isUnmarked ? 'normal' : 'bold'}; color: ${isUnmarked ? '#6B7280' : '#374151'}; text-align: center; white-space: nowrap;">
            ${displayName}
          </div>
        </div>
      `;

      const label = new window.BMap.Label(labelContent, {
        position: point,
        offset: new window.BMap.Size(0, 0)
      });

      label.setStyle({
        border: 'none',
        backgroundColor: 'transparent',
        padding: '0',
        zIndex: isUnmarked ? '1' : '100'
      });

      const handleClick = (e?: unknown) => {
        const maybeEvent = e as { domEvent?: { stopPropagation?: () => void } } | undefined;
        maybeEvent?.domEvent?.stopPropagation?.();
        navigate(`/attraction/${attraction.id}`);
      };
      label.addEventListener('click', handleClick);
      label.addEventListener('touchend', handleClick);

      map.addOverlay(label);
      markersRef.current.push({ marker: label, attraction, isUnmarked });
    });

    if (shouldFitViewport && displayedAttractions.length > 0) {
      const focusId = searchParams.get('focus');
      if (focusId) {
        const focusAttr = displayedAttractions.find(a => a.id === focusId);
        if (focusAttr) {
          const pt = new window.BMap.Point(focusAttr.longitude, focusAttr.latitude);
          map.centerAndZoom(pt, 13);
          return;
        }
      }

      if (displayedAttractions.length === 1) {
        map.centerAndZoom(new window.BMap.Point(
          displayedAttractions[0].longitude,
          displayedAttractions[0].latitude
        ), 10);
      } else {
        const points = displayedAttractions.map(
          (a) => new window.BMap.Point(a.longitude, a.latitude)
        );
        const viewport = map.getViewport(points);
        map.centerAndZoom(viewport.center, viewport.zoom);
      }
    }
  }, [checkins, displayedAttractions, navigate, searchParams]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !window.BMap) return;

    // 初始化地图
    const map = new window.BMap.Map(mapRef.current);
    mapInstanceRef.current = map;

    // 设置中心点和缩放级别
    const point = new window.BMap.Point(116.397428, 39.90923);
    map.centerAndZoom(point, 5);
    map.enableScrollWheelZoom();
    
    // 启用个性化地图样式（可选，让地图看起来更干净）
    try {
      map.setMapStyleV2?.({
        styleJson: [
          {
            "featureType": "poi",
            "elementType": "all",
            "stylers": {
              "visibility": "off"
            }
          },
          {
            "featureType": "road",
            "elementType": "all",
            "stylers": {
              "visibility": "off"
            }
          },
          {
            "featureType": "background",
            "elementType": "all",
            "stylers": {
              "color": "#f3f4f6ff"
            }
          }
        ]
      });
    } catch (error) {
      console.warn('Map styling failed', error);
    }

    // 允许所有缩放操作，以便用户放大查看详细位置
    if (map.enableDragging) map.enableDragging();
    if (map.enablePinchToZoom) map.enablePinchToZoom();
    if (map.enableDoubleClickZoom) map.enableDoubleClickZoom();
    if (map.enableKeyboard) map.enableKeyboard();
    
    // 移除原生缩放控件，改用自定义左上角UI

    // 添加标记点
    updateMarkers(true);
  }, [isMapLoaded, updateMarkers]);
  // 监听缩放，动态控制灰色未打卡景区的名称显示，避免层叠
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;
    
    const map = mapInstanceRef.current;
    
    let currentMode = 'clean';
    const handleZoomEnd = () => {
      const zoom = map.getZoom();
      
      // Update POI visibility dynamically based on zoom level
      const newMode = zoom >= 13 ? 'detailed' : 'clean';
      if (currentMode !== newMode) {
        currentMode = newMode;
        const styleJson = newMode === 'clean' ? [
          { "featureType": "poi", "elementType": "all", "stylers": { "visibility": "off" } },
          { "featureType": "road", "elementType": "all", "stylers": { "visibility": "off" } },
          { "featureType": "background", "elementType": "all", "stylers": { "color": "#f3f4f6ff" } }
        ] : [
          { "featureType": "background", "elementType": "all", "stylers": { "color": "#f3f4f6ff" } }
        ];
        try {
          map.setMapStyleV2?.({ styleJson });
        } catch (error) {
          console.warn('Map styling failed', error);
        }
      }

      markersRef.current.forEach(({ marker, attraction, isUnmarked }) => {
        // 放大到省份级别(>=7)才显示所有未打卡景区的名称，否则只隐藏
        const showLabel = !isUnmarked || zoom >= 7;
        const displayName = attraction.short_name || attraction.name;
        
        // 由于现在 marker 本身就是 Label，且内容是复杂的 HTML
        // 我们只需简单地重新生成 HTML 并 setContent
        const isVisited = checkins.find((c) => c.attraction_id === attraction.id)?.status === 'visited';
        let iconSvg = '';
        if (isVisited) {
          iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><path fill="#10B981" stroke="#ffffff" stroke-width="2" d="M18 2C10.8 2 5 7.8 5 15c0 9 13 19 13 19s13-10 13-19c0-7.2-5.8-13-13-13z"/><path fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M12 15l4 4 8-8"/></svg>`;
        } else if (!isUnmarked) {
          iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><path fill="#F59E0B" stroke="#ffffff" stroke-width="2" d="M18 2C10.8 2 5 7.8 5 15c0 9 13 19 13 19s13-10 13-19c0-7.2-5.8-13-13-13z"/><path fill="#ffffff" d="M18 19.5l-1-1c-3.5-3.2-5.8-5.3-5.8-7.9 0-2.1 1.7-3.8 3.8-3.8 1.2 0 2.4.6 3 1.5.6-.9 1.8-1.5 3-1.5 2.1 0 3.8 1.7 3.8 3.8 0 2.6-2.3 4.7-5.8 7.9l-1 1z"/></svg>`;
        } else {
          iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="#D1D5DB" stroke="#ffffff" stroke-width="2"/></svg>`;
        }

        const labelContent = `
          <div onclick="window.handleAttractionClick('${attraction.id}')" 
               ontouchend="window.handleAttractionClick('${attraction.id}')"
               style="cursor: pointer; pointer-events: auto; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            ${iconSvg}
            <div class="custom-bmap-label-text" style="display: ${showLabel ? 'block' : 'none'}; background: rgba(255,255,255,0.95); padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 2px; font-size: 12px; font-weight: ${isUnmarked ? 'normal' : 'bold'}; color: ${isUnmarked ? '#6B7280' : '#374151'}; text-align: center; white-space: nowrap;">
              ${displayName}
            </div>
          </div>
        `;
        
        marker.setContent(labelContent);
      });
    };
    
    // 只绑定一次事件
    map.addEventListener('zoomend', handleZoomEnd);
    
    return () => {
      map.removeEventListener('zoomend', handleZoomEnd);
    };
  }, [checkins, isMapLoaded, navigate]);

  // 监听打卡数据或过滤条件的变化
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateMarkers(false); // 打卡状态改变时不重置视野
    }
  }, [displayedAttractions, checkins, updateMarkers]);

  // 仅在切换过滤器时重新适配视野
  useEffect(() => {
    if (window.BMap) {
      updateMarkers(true);
    }
  }, [filter, searchQuery, updateMarkers]);

  return (
    <div className="h-screen bg-gray-50 relative overflow-hidden flex flex-col">
      {mapConfigError && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center px-6 text-center">
          <div className="text-gray-900 font-semibold mb-2">地图加载失败</div>
          <div className="text-gray-600 text-sm">{mapConfigError}</div>
        </div>
      )}
      {/* 顶部控制栏 (搜索 + 筛选) */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-white/90 to-transparent pt-4 pb-6 px-4">
        {/* 全局搜索栏 */}
        <div className="relative mb-3 shadow-md rounded-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="搜索景区名称或城市..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-sm text-gray-900 rounded-full pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
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

        {/* 筛选标签 */}
        <div className="flex gap-2">
          {/* 全部 */}
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
              filter === 'all'
                ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100'
                : 'bg-white text-gray-600 shadow-sm border border-gray-100'
            }`}
          >
            <Database size={20} className={filter === 'all' ? 'text-blue-500' : 'text-gray-400'} />
            <span className="text-xs font-medium">推荐 {totalCount}</span>
          </button>

          {/* 想去 */}
          <button
            onClick={() => setFilter('want_to_visit')}
            className={`flex-1 py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
              filter === 'want_to_visit'
                ? 'bg-amber-50 text-amber-600 shadow-sm border border-amber-100'
                : 'bg-white text-gray-600 shadow-sm border border-gray-100'
            }`}
          >
            <Heart size={20} className={`text-amber-500 ${filter === 'want_to_visit' ? 'fill-amber-500' : ''}`} />
            <span className="text-xs font-medium">想去 {checkins.filter(c => c.status === 'want_to_visit').length}</span>
          </button>

          {/* 去过 */}
          <button
            onClick={() => setFilter('visited')}
            className={`flex-1 py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
              filter === 'visited'
                ? 'bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100'
                : 'bg-white text-gray-600 shadow-sm border border-gray-100'
            }`}
          >
            <CheckCircle2 size={20} className="text-emerald-500" />
            <span className="text-xs font-medium">去过 {checkins.filter(c => c.status === 'visited').length}</span>
          </button>
        </div>
      </div>

      {/* 开发测试工具 */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-40 right-4 z-30 flex flex-col gap-2">
          <button
            onClick={async () => {
              if (!useAuthStore.getState().isAuthenticated) {
                await useAuthStore.getState().loginAsGuest();
              }
              useAppStore.getState().clearData?.();
              useAppStore.getState().loadMockData(30, 20);
              window.location.reload();
            }}
            className="bg-purple-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-purple-600 transition-colors"
          >
            生成标准数据
          </button>
        </div>
      )}

      {/* 路线规划入口按钮 - 底部中心大按钮 */}
      <button
        onClick={() => navigate('/route-planning')}
        className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10 px-8 py-3.5 bg-blue-500 text-white rounded-full shadow-xl flex items-center gap-2 hover:bg-blue-600 transition-all font-semibold active:scale-95"
      >
        <Route size={20} />
        <span>路线规划</span>
      </button>

      {/* 地图容器 */}
      {isMapLoaded ? (
        <>
          <div ref={mapRef} className="absolute inset-0 z-0" style={{ touchAction: 'none' }} />
          {/* 自定义缩放控件 */}
          <div className="absolute top-36 left-4 z-10 flex flex-col gap-2 pointer-events-none">
            <button
              onClick={(e) => { e.preventDefault(); mapInstanceRef.current?.zoomIn(); }}
              className="pointer-events-auto w-8 h-8 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); mapInstanceRef.current?.zoomOut(); }}
              className="pointer-events-auto w-8 h-8 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <Minus size={18} />
            </button>
          </div>
        </>
      ) : (
        /* 无百度地图Key时的提示 */
        <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-emerald-50 flex items-center justify-center">
          <div className="text-center px-4">
            <MapPin size={64} className="mx-auto text-emerald-300 mb-4" />
            <p className="text-gray-600 font-medium">地图功能需要百度地图API Key</p>
            <p className="text-sm text-gray-400 mt-2">请在 .env.local 文件中配置 VITE_BAIDU_MAP_AK</p>
            <p className="text-xs text-gray-400 mt-4">当前已加载 {displayedAttractions.length} 个景区数据</p>
            <button
              onClick={() => navigate('/route-planning')}
              className="mt-6 px-6 py-3 bg-emerald-500 text-white rounded-full font-medium hover:bg-emerald-600 transition-colors"
            >
              使用路线规划功能
            </button>
          </div>
        </div>
      )}

      {/* 空状态提示 */}
      {displayedAttractions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90">
          <div className="text-center">
            <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">暂无记录</p>
            <p className="text-sm text-gray-400 mt-2">去首页标记你想去的景区吧</p>
          </div>
        </div>
      )}

    </div>
  );
}
