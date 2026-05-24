import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  CheckCircle2,
  Car,
  Train,
  Plane,
  Footprints,
  RotateCcw,
  Bookmark,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Minus,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { useAttractionSearch } from '../../hooks/useAttractionSearch';
import type { Attraction } from '../../types';
import type { BMapMap, BMapPoint, BMapMarker, BMapLabel, BMapPolyline } from '../../types/bmap';

interface RoutePoint {
  attraction: Attraction;
  order: number;
}

interface RouteSegment {
  from: RoutePoint;
  to: RoutePoint;
  distance: number;
  transportMode: TransportType;
  duration: number;
  realPath?: BMapPoint[];
}

type TransportType = 'walk' | 'bike' | 'taxi' | 'subway' | 'drive' | 'train' | 'fly';

interface TransportOption {
  type: TransportType;
  label: string;
  icon: typeof Car;
  speed: number;
  suitable: (distance: number) => boolean;
  description: string;
}

const SUBWAY_CITIES = [
  '北京', '上海', '广州', '深圳', '成都', '重庆', '武汉', '西安', 
  '杭州', '南京', '天津', '郑州', '长沙', '沈阳', '青岛', '大连',
  '苏州', '宁波', '长春', '南昌', '哈尔滨', '南宁', '昆明', '无锡',
  '合肥', '福州', '石家庄', '厦门', '东莞', '常州', '徐州', '温州',
  '济南', '佛山', '南通', '洛阳', '绍兴', '太原', '乌鲁木齐', '贵阳',
  '呼和浩特', '金华', '台州', '兰州', '芜湖', '嘉兴'
];

const TRANSPORT_OPTIONS: TransportOption[] = [
  { type: 'walk', label: '步行', icon: Footprints, speed: 5, suitable: (d) => d < 3, description: '适合短距离，慢慢欣赏沿途风景' },
  { type: 'bike', label: '骑行', icon: Navigation, speed: 15, suitable: (d) => d >= 3 && d < 10, description: '轻松惬意，适合城市间短途' },
  { type: 'taxi', label: '打车', icon: Car, speed: 40, suitable: (d) => d >= 5 && d < 40, description: '方便快捷，随叫随到' },
  { type: 'subway', label: '地铁', icon: Train, speed: 35, suitable: (d) => d >= 10 && d < 80, description: '经济实惠，避开拥堵' },
  { type: 'drive', label: '自驾', icon: Car, speed: 60, suitable: (d) => d >= 30 && d < 400, description: '自由灵活，沿途可停靠' },
  { type: 'train', label: '高铁', icon: Train, speed: 250, suitable: (d) => d >= 150 && d < 1500, description: '快速舒适，适合中长途' },
  { type: 'fly', label: '飞机', icon: Plane, speed: 800, suitable: (d) => d >= 1000, description: '省时高效，跨越千里' },
];

interface RoutePlan {
  points: RoutePoint[];
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  mainTransportMode: TransportType;
}

interface SavedRoute {
  id: string;
  name: string;
  points: RoutePoint[];
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  mainTransportMode: TransportType;
  createdAt: number;
}

// 路线颜色 - 使用蓝色系，与橙绿红差异化
const ROUTE_COLORS = {
  line: '#3B82F6', // 蓝色路线
  marker: '#1D4ED8', // 深蓝色标记
  markerText: '#FFFFFF',
  segmentLine: ['#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF'], // 渐变蓝色
};

export default function RoutePlanning() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<BMapMap | null>(null);
  const routeLinesRef = useRef<BMapPolyline[]>([]);
  const routeLabelsRef = useRef<BMapLabel[]>([]);
  const markersRef = useRef<BMapMarker[]>([]);
  const { checkins, addCheckin, removeCheckin } = useAppStore();
  const { isAuthenticated, user } = useAuthStore();
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  // 页面状态
  const [step, setStep] = useState<'select' | 'loading' | 'result'>('select');
  const [selectedAttractions, setSelectedAttractions] = useState<Attraction[]>([]);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [filter, setFilter] = useState<'want_to_visit' | 'visited' | 'all'>(() => {
    const wantCount = useAppStore.getState().checkins.filter(c => c.status === 'want_to_visit').length;
    return wantCount > 0 ? 'want_to_visit' : 'all';
  });
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 拖拽排序状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // 浮层展开/收起状态
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // 切换“想去”状态
  const handleToggleWantToVisit = async (attraction: Attraction) => {
    if (!isAuthenticated || !user) {
      if (window.confirm('标记景区需要先登录，是否前往登录？')) {
        navigate('/login');
      }
      return;
    }
    const checkin = checkins.find((c) => c.attraction_id === attraction.id);
    if (checkin) {
      // 如果已经是想去或者去过，点击则取消（为了简单处理，统一为取消标记，或者仅取消想去）
      await removeCheckin(checkin.id);
    } else {
      await addCheckin({
        user_id: user.id,
        attraction_id: attraction.id,
        status: 'want_to_visit',
        visit_count: 0,
        visited_at: null
      });
    }
  };

  // 从localStorage加载保存的路线
  useEffect(() => {
    const saved = localStorage.getItem('savedRoutes');
    if (saved) {
      try {
        setSavedRoutes(JSON.parse(saved));
      } catch (e) {
        console.error('加载保存的路线失败', e);
      }
    }
  }, []);

  // 保存路线列表，支持搜索过滤
  const filteredSavedRoutes = useMemo(() => {
    if (!searchQuery.trim()) return savedRoutes;
    const lowerQuery = searchQuery.trim().toLowerCase();
    return savedRoutes.filter(route => 
      route.name.toLowerCase().includes(lowerQuery) ||
      route.points.some(p => p.attraction.name.toLowerCase().includes(lowerQuery))
    );
  }, [savedRoutes, searchQuery]);

  // 高亮文本辅助函数
  const highlightText = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${query.trim()})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.trim().toLowerCase() ? 
        <span key={i} className="text-emerald-400 font-black">{part}</span> : part
    );
  };

  // 保存路线到localStorage
  const saveRoutesToStorage = (routes: SavedRoute[]) => {
    localStorage.setItem('savedRoutes', JSON.stringify(routes));
    setSavedRoutes(routes);
  };

  // 按省市聚类景区
  const groupAttractionsByProvince = (attractions: Attraction[]) => {
    const grouped: Record<string, Attraction[]> = {};
    attractions.forEach((attraction) => {
      if (!grouped[attraction.province]) {
        grouped[attraction.province] = [];
      }
      grouped[attraction.province].push(attraction);
    });
    return grouped;
  };

  // 根据 filter 获取 filterIds
  const filterIds = useMemo(() => {
    if (filter === 'visited') {
      return checkins.filter(c => c.status === 'visited').map(c => c.attraction_id);
    } else if (filter === 'want_to_visit') {
      return checkins.filter(c => c.status === 'want_to_visit').map(c => c.attraction_id);
    } else if (filter === 'all') {
      // 推荐的景点是用户还没有「去过」的景点
      // 在这里我们不用 filterIds 去过滤，因为我们需要获取所有没去过的
      return undefined;
    }
    return undefined;
  }, [checkins, filter]);

  // 调用后端搜索 Hook 获取景区数据
  const { data: fetchedAttractions } = useAttractionSearch(searchQuery, filterIds);

  // 获取可选择的景区（如果 filter 是 all，且没有搜索，则过滤掉已经 visited 的）
  const availableAttractions = useMemo(() => {
    if (searchQuery.trim()) {
      return fetchedAttractions; // 搜索时展示全部符合条件的
    }
    if (filter === 'all') {
      const visitedIds = checkins
        .filter((c) => c.status === 'visited')
        .map((c) => c.attraction_id);
      return fetchedAttractions.filter(a => !visitedIds.includes(a.id));
    }
    return fetchedAttractions;
  }, [fetchedAttractions, filter, checkins, searchQuery]);

  // 按省市聚类的景区
  const groupedAttractions = useMemo(() => {
    const grouped = groupAttractionsByProvince(availableAttractions);
    
    const getStatusScore = (id: string) => {
      const status = checkins.find(c => c.attraction_id === id)?.status;
      if (status === 'want_to_visit') return 2;
      if (status === 'visited') return 0;
      return 1; // unmarked
    };

    // 对每个省份内的景点进行排序
    Object.keys(grouped).forEach(province => {
      grouped[province].sort((a, b) => {
        const scoreA = getStatusScore(a.id);
        const scoreB = getStatusScore(b.id);
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // 想去(2) > 未标记(1) > 去过(0)
        }
        return 0;
      });
    });

    return grouped;
  }, [availableAttractions, checkins]);

  // 加载百度地图
  useEffect(() => {
    const baiduMapAk = import.meta.env.VITE_BAIDU_MAP_AK;
    let script: HTMLScriptElement | null = null;
    
    if (!baiduMapAk || baiduMapAk === 'your-baidu-map-ak' || baiduMapAk === 'mock-key-for-development') {
      console.warn('百度地图API Key未配置，使用静态示意模式');
      setIsMapLoaded(false);
      return;
    }
    
    if (window.BMap) {
      setIsMapLoaded(true);
      return;
    }

    script = document.createElement('script');
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${baiduMapAk}&callback=initRouteMap`;
    script.async = true;
    document.body.appendChild(script);

    window.initRouteMap = () => {
      setIsMapLoaded(true);
    };

    return () => {
      if (script && script.parentNode) {
        document.body.removeChild(script);
      }
      delete window.initRouteMap;
    };
  }, []);

  // 初始化地图
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !window.BMap) return;

    const map = new window.BMap.Map(mapRef.current);
    mapInstanceRef.current = map;

    const point = new window.BMap.Point(116.397428, 39.90923);
    map.centerAndZoom(point, 5);
    // 开启所有需要的交互能力
    map.enableScrollWheelZoom();
    if (map.enableDragging) map.enableDragging();
    if (map.enablePinchToZoom) map.enablePinchToZoom();
    if (map.enableKeyboard) map.enableKeyboard();
    if (map.enableDoubleClickZoom) map.enableDoubleClickZoom();

    // 移除原生缩放控件，改用自定义左上角UI

    updateMapMarkers();
  }, [isMapLoaded]);

  // 当选择的景区变化时，更新地图标记
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateMapMarkers();
    }
  }, [selectedAttractions]);

  // 当步骤变化时（地图容器大小变化），触发 resize 确保地图重新计算布局
  useEffect(() => {
    if (mapInstanceRef.current && step === 'result') {
      // 稍微延迟一下，等待 CSS 动画和 DOM 渲染完成
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        // 仅在步骤变化时重新计算视口，展开收起浮层时不再重算，以保护用户自行调整的缩放状态
        updateMapMarkers();
      }, 300);
    }
  }, [step]);

  // 更新地图标记
  const updateMapMarkers = (points?: RoutePoint[]) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    
    markersRef.current.forEach(marker => map.removeOverlay(marker));
    markersRef.current = [];

    // 优先使用传入的points（路线规划后的顺序），否则使用selectedAttractions
    const pointsToShow = points || (routePlan?.points.length ? routePlan.points : selectedAttractions.map((a, i) => ({ attraction: a, order: i + 1 })));

    if (pointsToShow.length > 0) {
      pointsToShow.forEach((point) => {
        const attraction = 'attraction' in point ? point.attraction : point;
        const order = 'order' in point ? point.order : 1;
        const bmapPoint = new window.BMap.Point(attraction.longitude, attraction.latitude);
        
        const marker = new window.BMap.Marker(bmapPoint);
        
        const label = new window.BMap.Label(`${order}. ${attraction.name}`, {
          offset: new window.BMap.Size(15, -15),
        });
        label.setStyle({
          color: '#fff',
          backgroundColor: ROUTE_COLORS.marker,
          border: 'none',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '12px',
          fontWeight: 'bold',
        });
        marker.setLabel(label);

        map.addOverlay(marker);
        markersRef.current.push(marker);
      });

      const bmapPoints = pointsToShow.map(
        (p) => {
          const attraction = 'attraction' in p ? p.attraction : p;
          return new window.BMap.Point(attraction.longitude, attraction.latitude);
        }
      );
      
      // 根据浮层状态动态计算地图视口的底部边距（避免被浮层遮挡）
      // 注意：现在由于我们去掉了 isPanelExpanded 触发的重新计算，这里计算的主要是初始展开时的边距
      // 底部留出 160px，确保缩放后所有节点都可见，且不被底部的常驻面板遮挡
      const bottomMargin = 160;
      
      const viewport = map.getViewport(bmapPoints, {
        margins: [50, 50, bottomMargin, 50] // [top, right, bottom, left]
      });
      map.centerAndZoom(viewport.center, viewport.zoom);
    }
  };

  // 选择/取消选择景区
  const toggleAttraction = (attraction: Attraction) => {
    setSelectedAttractions(prev => {
      const exists = prev.find(a => a.id === attraction.id);
      if (exists) {
        return prev.filter(a => a.id !== attraction.id);
      }
      if (prev.length >= 10) {
        alert('最多选择10个景区');
        return prev;
      }
      return [...prev, attraction];
    });
  };

  // 计算距离
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 获取推荐交通方式
  const getRecommendedTransport = (distance: number, from: Attraction, to: Attraction): TransportOption => {
    // 检查是否有地铁（根据常识中的地铁城市列表校验）
    const fromHasSubway = SUBWAY_CITIES.some(city => 
      from.address?.includes(city) || from.city?.includes(city) || from.name?.includes(city) || from.province?.includes(city)
    );
    const toHasSubway = SUBWAY_CITIES.some(city => 
      to.address?.includes(city) || to.city?.includes(city) || to.name?.includes(city) || to.province?.includes(city)
    );
    
    // 是否同省/同城周边游（通过距离粗略判断，距离<150km一般算同城或周边，且不开飞机/高铁）
    const isLocal = distance < 150;
    
    const availableOptions = TRANSPORT_OPTIONS.filter(t => {
      // 地铁：必须两地都有地铁，且距离在同城范围内
      if (t.type === 'subway') {
        return fromHasSubway && toHasSubway && isLocal;
      }
      // 高铁：必须距离大于100km（跨城），不推荐在同城坐高铁
      if (t.type === 'train') {
        return distance >= 100;
      }
      // 飞机：必须距离大于500km，短途不飞
      if (t.type === 'fly') {
        return distance >= 500;
      }
      return true;
    });

    const suitable = availableOptions.filter(t => t.suitable(distance));
    if (suitable.length > 0) {
      return suitable[0];
    }
    
    // 降级策略
    if (isLocal) {
      return TRANSPORT_OPTIONS.find(t => t.type === 'drive') || TRANSPORT_OPTIONS[4];
    } else {
      if (distance > 1000) return TRANSPORT_OPTIONS.find(t => t.type === 'fly') || TRANSPORT_OPTIONS[6];
      return TRANSPORT_OPTIONS.find(t => t.type === 'train') || TRANSPORT_OPTIONS[5];
    }
  };

  // 辅助函数：计算并校准真实路段信息
  const createSegment = async (fromPoint: RoutePoint, toPoint: RoutePoint): Promise<RouteSegment> => {
    const fromAttr = fromPoint.attraction;
    const toAttr = toPoint.attraction;
    const start = new window.BMap.Point(fromAttr.longitude, fromAttr.latitude);
    const end = new window.BMap.Point(toAttr.longitude, toAttr.latitude);
    
    // 异步获取路书（包含真实驾车距离和时间）
    const routeData = await fetchDrivingRoute(start, end);
    const distance = routeData.distanceKm;
    
    // 根据真实驾车距离推荐交通方式
    const transport = getRecommendedTransport(distance, fromAttr, toAttr);
    
    // 校准时间
    let finalDuration = routeData.durationMinutes;
    if (transport.type === 'walk') {
      finalDuration = (distance / transport.speed) * 60;
    } else if (transport.type === 'bike') {
      finalDuration = (distance / transport.speed) * 60;
    } else if (transport.type === 'subway') {
      finalDuration = (distance / transport.speed) * 60 + 10; // 加10分钟进出站
    } else if (transport.type === 'train') {
      finalDuration = (distance / transport.speed) * 60 + 60; // 加60分钟进出站候车
    } else if (transport.type === 'fly') {
      finalDuration = (distance / transport.speed) * 60 + 120; // 加120分钟机场候机
    }
    finalDuration = Math.round(finalDuration);
    
    return {
      from: fromPoint,
      to: toPoint,
      distance: distance,
      transportMode: transport.type,
      duration: finalDuration,
      realPath: routeData.path
    };
  };

  // 计算两点间距离
  const getDistance = (a: Attraction, b: Attraction): number => {
    return calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  };

  // 2-opt 优化算法 - 减少回头路
  const optimizeRoute2Opt = (route: Attraction[]): Attraction[] => {
    if (route.length < 3) return route;
    
    let improved = true;
    let bestRoute = [...route];
    
    // 计算总距离
    const getTotalDistance = (r: Attraction[]): number => {
      let dist = 0;
      for (let i = 0; i < r.length - 1; i++) {
        dist += getDistance(r[i], r[i + 1]);
      }
      return dist;
    };
    
    let bestDistance = getTotalDistance(bestRoute);
    const maxIterations = 100; // 防止无限循环
    let iteration = 0;
    
    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;
      
      for (let i = 0; i < bestRoute.length - 1; i++) {
        for (let j = i + 2; j < bestRoute.length; j++) {
          // 尝试交换路径段
          const newRoute = [...bestRoute];
          // 反转 i+1 到 j 之间的路径
          const segment = newRoute.slice(i + 1, j + 1).reverse();
          newRoute.splice(i + 1, j - i, ...segment);
          
          const newDistance = getTotalDistance(newRoute);
          
          if (newDistance < bestDistance) {
            bestRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
    }
    
    return bestRoute;
  };

  // 基于方向的智能起点选择 - 减少回头路
  const findSmartStartPoint = (attractions: Attraction[]): Attraction => {
    if (attractions.length === 0) return attractions[0];
    
    // 计算所有点的边界框中心
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    attractions.forEach(a => {
      minLat = Math.min(minLat, a.latitude);
      maxLat = Math.max(maxLat, a.latitude);
      minLng = Math.min(minLng, a.longitude);
      maxLng = Math.max(maxLng, a.longitude);
    });
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // 找到距离中心最远的点作为起点（边缘开始）
    let startPoint = attractions[0];
    let maxDistFromCenter = 0;
    
    attractions.forEach(a => {
      const dist = Math.sqrt(
        Math.pow(a.latitude - centerLat, 2) + 
        Math.pow(a.longitude - centerLng, 2)
      );
      if (dist > maxDistFromCenter) {
        maxDistFromCenter = dist;
        startPoint = a;
      }
    });
    
    return startPoint;
  };

  // 生成最优路线 - 使用改进的算法减少回头路，并接入百度地图 API
  const generateRoute = async () => {
    if (selectedAttractions.length < 2) {
      alert('请至少选择2个景区');
      return;
    }

    setStep('loading');

    // 第一步：使用改进的贪心算法生成初始路线（决定景点的顺序）
    const unvisited = [...selectedAttractions];
    const route: Attraction[] = [];
    
    // 智能选择起点（从边缘开始，减少回头路）
    const startPoint = findSmartStartPoint(unvisited);
    const startIndex = unvisited.findIndex(a => a.id === startPoint.id);
    route.push(unvisited.splice(startIndex, 1)[0]);

    // 贪心选择最近邻（基于直线距离排序）
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const distance = getDistance(route[route.length - 1], unvisited[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }

      route.push(unvisited.splice(nearestIndex, 1)[0]);
    }

    // 第二步：使用2-opt优化减少回头路
    const optimizedRoute = optimizeRoute2Opt(route);

    // 转换为 RoutePoint 格式
    const routePoints: RoutePoint[] = optimizedRoute.map((attraction, index) => ({
      attraction,
      order: index + 1,
    }));

    // 第三步：调用百度地图驾车 API 获取真实路段数据
    const segmentPromises = [];
    for (let i = 0; i < routePoints.length - 1; i++) {
      segmentPromises.push(createSegment(routePoints[i], routePoints[i + 1]));
    }
    const segments = await Promise.all(segmentPromises);
    
    let totalDistance = 0;
    let totalTransportDuration = 0;
    segments.forEach(segment => {
      totalDistance += segment.distance;
      totalTransportDuration += segment.duration;
    });

    // 确定主要交通方式（取最多使用的）
    const transportCounts: Record<string, number> = {};
    segments.forEach(s => {
      transportCounts[s.transportMode] = (transportCounts[s.transportMode] || 0) + 1;
    });
    const mainTransportMode = Object.entries(transportCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as TransportType;

    // 总时长 = 交通时间 + 游览时间（每个景点2小时）
    const visitingTime = routePoints.length * 120;
    const totalDuration = totalTransportDuration + visitingTime;

    const plan: RoutePlan = {
      points: routePoints,
      segments,
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalDuration: Math.round(totalDuration),
      mainTransportMode,
    };

    setRoutePlan(plan);
    setStep('result');
    
    setTimeout(() => {
      updateMapMarkers(plan.points);
      drawRouteOnMap(plan);
    }, 300);
  };

  // 辅助函数：获取真实驾车路线
  const fetchDrivingRoute = (start: BMapPoint, end: BMapPoint): Promise<{ path: BMapPoint[], distanceStr: string, durationStr: string, durationMinutes: number, distanceKm: number }> => {
    return new Promise((resolve, reject) => {
      if (!window.BMap || !mapInstanceRef.current) {
        reject(new Error('BMap not loaded'));
        return;
      }
      
      const timeoutId = setTimeout(() => {
        console.warn('获取真实路书超时，降级返回直线路线');
        resolve({
          path: [start, end],
          distanceStr: '未知',
          durationStr: '未知',
          durationMinutes: 0,
          distanceKm: 0
        });
      }, 3000); // 3秒超时，避免阻塞太久

      const driving = new window.BMap.DrivingRoute(mapInstanceRef.current, {
        onSearchComplete: (results: unknown) => {
          clearTimeout(timeoutId);
          if (driving.getStatus() === 0) { // BMAP_STATUS_SUCCESS
            const resultsObj = results as {
              getPlan?: (index: number) => {
                getRoute: (index: number) => { getPath: () => BMapPoint[] };
                getDistance: (human: boolean) => string;
                getDuration: (human: boolean) => string;
              };
            };

            if (!resultsObj.getPlan) {
              resolve({
                path: [start, end],
                distanceStr: '未知',
                durationStr: '未知',
                durationMinutes: 0,
                distanceKm: 0
              });
              return;
            }

            const plan = resultsObj.getPlan(0);
            const route = plan.getRoute(0);
            const path = route.getPath();
            const distanceStr = plan.getDistance(true);
            const durationStr = plan.getDuration(true);

            const distNum = parseFloat(plan.getDistance(false)) / 1000;
            const durNum = Math.round(parseFloat(plan.getDuration(false)) / 60);

            resolve({
              path,
              distanceStr,
              durationStr,
              durationMinutes: durNum,
              distanceKm: Math.round(distNum * 10) / 10
            });
          } else {
            // 如果驾车路线规划失败（例如跨海无法驾车），降级返回直线
            resolve({
              path: [start, end],
              distanceStr: '未知',
              durationStr: '未知',
              durationMinutes: 0,
              distanceKm: 0
            });
          }
        }
      });
      driving.search(start, end);
    });
  };
  // 在地图上绘制路线
  const drawRouteOnMap = (plan: RoutePlan) => {
    if (!mapInstanceRef.current || plan.points.length < 2) return;

    const map = mapInstanceRef.current;
    
    routeLinesRef.current.forEach(line => map.removeOverlay(line));
    routeLinesRef.current = [];

    routeLabelsRef.current.forEach(label => map.removeOverlay(label));
    routeLabelsRef.current = [];

    // 绘制真实驾车连线 - 使用蓝色系
    for (let i = 0; i < plan.segments.length; i++) {
      const segment = plan.segments[i];
      const pathPoints = segment.realPath || [];

      if (pathPoints.length > 0) {
        const polyline = new window.BMap.Polyline(pathPoints, {
          strokeColor: ROUTE_COLORS.segmentLine[i % ROUTE_COLORS.segmentLine.length],
          strokeWeight: 5,
          strokeOpacity: 0.8,
        });

        map.addOverlay(polyline);
        routeLinesRef.current.push(polyline);

        // 在路段中间添加距离和用时信息的文字标签
        const midIndex = Math.floor(pathPoints.length / 2);
        const midPoint = pathPoints[midIndex];
        
        const labelText = `${segment.distance}km`;
        
        const label = new window.BMap.Label(labelText, {
          position: midPoint,
          offset: new window.BMap.Size(-40, -10) // 适当偏移以居中
        });
        
        label.setStyle({
          color: '#4B5563', // text-gray-600
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid #E5E7EB', // border-gray-200
          borderRadius: '12px',
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: '500',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          transform: 'translate(-50%, -50%)', // 真正的居中
          zIndex: '10'
        });

        map.addOverlay(label);
        routeLabelsRef.current.push(label);
      }
    }

    const points = plan.points.map(p => 
      new window.BMap.Point(p.attraction.longitude, p.attraction.latitude)
    );
    const viewport = map.getViewport(points);
    map.centerAndZoom(viewport.center, viewport.zoom);
  };

  // 格式化时间 - 简洁版本
  const formatDuration = (minutes: number, short: boolean = false): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (short) {
      // 短格式：用于统计卡片 - 始终带单位，避免混淆
      if (days > 0) {
        return `${days}天${remainingHours}小时`;
      }
      if (hours > 0) {
        return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
      }
      return `${mins}分钟`;
    }
    
    // 长格式：用于详细展示
    if (days > 0) {
      return `${days}天${remainingHours}小时${mins > 0 ? mins + '分钟' : ''}`;
    }
    if (hours > 0) {
      return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
    }
    return `${mins}分钟`;
  };
  
  // 格式化时间 - 用于显示单位（简化，因为时间本身已带完整单位）
  const getDurationUnit = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    if (hours >= 24) {
      return '预计行程';
    }
    return '预计用时';
  };

  // 获取交通方式信息
  const getTransportInfo = (type: TransportType) => {
    return TRANSPORT_OPTIONS.find(t => t.type === type) || TRANSPORT_OPTIONS[4];
  };

  // 重新开始
  const handleReset = () => {
    setStep('select');
    setSelectedAttractions([]);
    setRoutePlan(null);
    setExpandedSegments([]);
    
    if (mapInstanceRef.current) {
      routeLinesRef.current.forEach(line => mapInstanceRef.current?.removeOverlay(line));
      routeLinesRef.current = [];
      markersRef.current.forEach(marker => mapInstanceRef.current?.removeOverlay(marker));
      markersRef.current = [];

      routeLabelsRef.current.forEach(label => mapInstanceRef.current?.removeOverlay(label));
      routeLabelsRef.current = [];
    }
  };

  // 保存路线
  const handleSaveRoute = () => {
    if (!routePlan) return;
    
    const newRoute: SavedRoute = {
      id: Date.now().toString(),
      name: `${routePlan.points[0].attraction.name} → ${routePlan.points[routePlan.points.length - 1].attraction.name}`,
      points: routePlan.points,
      segments: routePlan.segments,
      totalDistance: routePlan.totalDistance,
      totalDuration: routePlan.totalDuration,
      mainTransportMode: routePlan.mainTransportMode,
      createdAt: Date.now(),
    };
    
    const updatedRoutes = [...savedRoutes, newRoute];
    saveRoutesToStorage(updatedRoutes);
    alert('路线已保存！');
  };

  // 拖拽排序处理函数
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 重新排序路线点
    if (routePlan) {
      const newPoints = [...routePlan.points];
      const draggedPoint = newPoints[draggedIndex];
      
      // 移除拖拽的点
      newPoints.splice(draggedIndex, 1);
      // 插入到新位置
      newPoints.splice(dropIndex, 0, draggedPoint);
      
      // 更新顺序号
      const reorderedPoints = newPoints.map((point, idx) => ({
        ...point,
        order: idx + 1,
      }));

      setStep('loading');

      // 重新计算路段信息
      const segmentPromises = [];
      for (let i = 0; i < reorderedPoints.length - 1; i++) {
        segmentPromises.push(createSegment(reorderedPoints[i], reorderedPoints[i + 1]));
      }
      const newSegments = await Promise.all(segmentPromises);
      
      let totalDistance = 0;
      let totalTransportDuration = 0;
      newSegments.forEach(segment => {
        totalDistance += segment.distance;
        totalTransportDuration += segment.duration;
      });

      // 确定主要交通方式
      const transportCounts: Record<string, number> = {};
      newSegments.forEach(s => {
        transportCounts[s.transportMode] = (transportCounts[s.transportMode] || 0) + 1;
      });
      const mainTransportMode = Object.entries(transportCounts)
        .sort((a, b) => b[1] - a[1])[0][0] as TransportType;

      // 总时长
      const visitingTime = reorderedPoints.length * 120;
      const totalDuration = totalTransportDuration + visitingTime;

      const newPlan: RoutePlan = {
        points: reorderedPoints,
        segments: newSegments,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalDuration: Math.round(totalDuration),
        mainTransportMode,
      };

      setRoutePlan(newPlan);
      setStep('result');
      
      // 更新地图 - 传入新的points确保序号正确
      setTimeout(() => {
        updateMapMarkers(newPlan.points);
        drawRouteOnMap(newPlan);
      }, 100);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 加载保存的路线
  const loadSavedRoute = (route: SavedRoute) => {
    const plan: RoutePlan = {
      points: route.points,
      segments: route.segments,
      totalDistance: route.totalDistance,
      totalDuration: route.totalDuration,
      mainTransportMode: route.mainTransportMode,
    };
    
    setSelectedAttractions(route.points.map(p => p.attraction));
    setRoutePlan(plan);
    setStep('result');
    setShowSavedRoutes(false);
    
    setTimeout(() => {
      updateMapMarkers(plan.points);
      drawRouteOnMap(plan);
    }, 300);
  };

  // 删除保存的路线
  const deleteSavedRoute = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedRoutes = savedRoutes.filter(r => r.id !== id);
    saveRoutesToStorage(updatedRoutes);
  };

  // 切换路段展开状态
  const toggleSegmentExpand = (index: number) => {
    setExpandedSegments(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  // 浮层触摸/滑动处理
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartY.current = clientY;
    touchCurrentY.current = clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchCurrentY.current = clientY;
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    
    const diff = touchCurrentY.current - touchStartY.current;
    const threshold = 50; // 滑动阈值
    
    if (diff > threshold && isPanelExpanded) {
      // 向下滑动，收起面板
      setIsPanelExpanded(false);
    } else if (diff < -threshold && !isPanelExpanded) {
      // 向上滑动，展开面板
      setIsPanelExpanded(true);
    }
    
    touchStartY.current = 0;
    touchCurrentY.current = 0;
    isDraggingRef.current = false;
  };

  // 切换面板展开状态
  const togglePanel = () => {
    setIsPanelExpanded(!isPanelExpanded);
  };

  // 收起浮层面板
  const collapsePanel = () => {
    if (isPanelExpanded) {
      setIsPanelExpanded(false);
    }
  };

  // 监听地图交互，自动收起浮层
  useEffect(() => {
    if (step !== 'result' || !mapRef.current) return;

    const mapElement = mapRef.current;
    
    // 监听地图交互事件 - 仅使用 click 降低敏感度
    const handleMapInteraction = () => {
      // 只有在展开状态时才需要收起
      if (isPanelExpanded) {
        collapsePanel();
      }
    };

    // 对于真实百度地图，通过实例监听 click 更好
    if (mapInstanceRef.current) {
      mapInstanceRef.current.addEventListener('click', handleMapInteraction);
      // 监听拖拽开始，同样收起浮层
      mapInstanceRef.current.addEventListener('dragstart', handleMapInteraction);
      mapInstanceRef.current.addEventListener('zoomstart', handleMapInteraction);
    } else {
      // 静态示意图，使用原生的 mousedown/touchstart
      mapElement.addEventListener('click', handleMapInteraction);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeEventListener('click', handleMapInteraction);
        mapInstanceRef.current.removeEventListener('dragstart', handleMapInteraction);
        mapInstanceRef.current.removeEventListener('zoomstart', handleMapInteraction);
      } else {
        mapElement.removeEventListener('click', handleMapInteraction);
      }
    };
  }, [step, isPanelExpanded]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col relative overflow-hidden">
      {/* 头部 */}
      <div className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/footprint')}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {step === 'select' ? '路线规划' : '推荐路线'}
          </h1>
          <button
            onClick={() => setShowSavedRoutes(true)}
            className="p-2 -mr-2 hover:bg-gray-100 rounded-full relative"
          >
            <Bookmark size={24} className="text-gray-700" />
            {savedRoutes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {savedRoutes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 地图区域 - 动态样式，全页面共用一个地图容器 */}
      <div 
        className={`bg-gray-200 transition-all duration-300 ${
          step === 'select' 
            ? 'relative flex-1 shrink-0 z-0' 
            : 'fixed inset-0 top-[57px] z-0 max-w-md mx-auto'
        }`}
        style={{
          // 当处于结果页且浮层收起时，为了给地图更多展示空间，地图高度需要铺满除了顶部导航以外的所有区域。
          // 底部的 146px 留给收起后的常驻浮层，通过 marginBottom 预留出这部分空间，避免关键节点被遮挡
          height: step === 'result' ? 'calc(100vh - 57px)' : undefined
        }}
      >
        {isMapLoaded ? (
          <>
            <div ref={mapRef} className="w-full h-full" style={{ touchAction: 'none' }} />
            {/* 自定义缩放控件 */}
             <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
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
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `
                linear-gradient(${ROUTE_COLORS.line} 1px, transparent 1px),
                linear-gradient(90deg, ${ROUTE_COLORS.line} 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }} />
            
            {routePlan && routePlan.points.length > 0 ? (
              <div className="relative w-full h-full p-8">
                {/* 绘制曲线路线 */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {routePlan.points.map((point, index) => {
                    if (index >= routePlan.points.length - 1) return null;
                    
                    const x1 = ((point.attraction.longitude - 100) / 30) * 100;
                    const y1 = ((40 - point.attraction.latitude) / 20) * 100;
                    const x2 = ((routePlan.points[index + 1].attraction.longitude - 100) / 30) * 100;
                    const y2 = ((40 - routePlan.points[index + 1].attraction.latitude) / 20) * 100;
                    
                    // 计算控制点，创建曲线效果
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    const offset = 15; // 曲线偏移量
                    
                    return (
                      <path
                        key={`curve-${index}`}
                        d={`M ${Math.max(10, Math.min(90, x1))}% ${Math.max(10, Math.min(90, y1))}% Q ${midX}% ${midY - offset}% ${Math.max(10, Math.min(90, x2))}% ${Math.max(10, Math.min(90, y2))}%`}
                        fill="none"
                        stroke={ROUTE_COLORS.segmentLine[index % ROUTE_COLORS.segmentLine.length]}
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>
                
                {routePlan.points.map((point) => {
                  const x = ((point.attraction.longitude - 100) / 30) * 100;
                  const y = ((40 - point.attraction.latitude) / 20) * 100;
                  
                  return (
                    <div
                      key={point.attraction.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                      style={{ left: `${Math.max(10, Math.min(90, x))}%`, top: `${Math.max(10, Math.min(90, y))}%` }}
                    >
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 border-white"
                          style={{ backgroundColor: ROUTE_COLORS.marker }}
                        >
                          {point.order}
                        </div>
                        <span className="mt-1 text-xs font-medium text-gray-700 bg-white/80 px-2 py-0.5 rounded whitespace-nowrap">
                          {point.attraction.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
                <div className="absolute bottom-2 left-2 right-2 text-center">
                  <span className="text-xs text-gray-500 bg-white/80 px-3 py-1 rounded-full">
                    地图示意模式（配置百度地图Key可显示真实地图）
                  </span>
                </div>
              </div>
            ) : selectedAttractions.length > 0 ? (
              <div className="relative w-full h-full p-8">
                {selectedAttractions.map((attraction, index) => {
                  const x = ((attraction.longitude - 100) / 30) * 100;
                  const y = ((40 - attraction.latitude) / 20) * 100;
                  
                  return (
                    <div
                      key={attraction.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${Math.max(10, Math.min(90, x))}%`, top: `${Math.max(10, Math.min(90, y))}%` }}
                    >
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 border-white"
                          style={{ backgroundColor: ROUTE_COLORS.marker }}
                        >
                          {index + 1}
                        </div>
                        <span className="mt-1 text-xs font-medium text-gray-700 bg-white/80 px-2 py-0.5 rounded whitespace-nowrap">
                          {attraction.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center">
                <MapPin size={48} className="mx-auto text-blue-300 mb-3" />
                <p className="text-gray-500 text-sm">选择景区后将在地图上显示</p>
                <p className="text-gray-400 text-xs mt-1">（配置百度地图Key可显示真实地图）</p>
              </div>
            )}
          </div>
        )}

        {/* 路线生成中加载提示 */}
        {step === 'loading' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-800 font-medium">正在为您规划最优路线...</p>
              <p className="text-gray-500 text-xs mt-2">预计需要几秒钟</p>
            </div>
          </div>
        )}
      </div>

      {/* 已保存路线弹窗 */}
      {showSavedRoutes && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-800">已存路线 ({filteredSavedRoutes.length})</h3>
              <button
                onClick={() => setShowSavedRoutes(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[50vh]">
              {filteredSavedRoutes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bookmark size={48} className="mx-auto text-gray-300 mb-4" />
                  <p>暂无保存的路线</p>
                  <p className="text-sm text-gray-400 mt-2">规划路线后点击收藏保存</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {filteredSavedRoutes.map((route) => {
                    const TransportIcon = getTransportInfo(route.mainTransportMode).icon;
                    return (
                        <div
                          key={route.id}
                          onClick={() => loadSavedRoute(route)}
                          className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-800">{highlightText(route.name, searchQuery)}</h4>
                              <p className="text-sm text-gray-500 mt-1">
                                {route.points.length}个景点 · {route.totalDistance}km · {formatDuration(route.totalDuration)}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <TransportIcon size={16} className="text-blue-500" />
                                <span className="text-xs text-gray-500">
                                  {getTransportInfo(route.mainTransportMode).label}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => deleteSavedRoute(route.id, e)}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 'select' ? (
        /* 选择页面 */
        <div className="h-[75vh] shrink-0 bg-white rounded-t-3xl -mt-4 relative z-10 flex flex-col min-h-0">
          {/* 全局搜索栏 */}
          <div className="px-4 pt-4 pb-2 shrink-0 border-b">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="搜索并添加想去的景区..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 text-sm text-gray-900 rounded-full pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
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
          </div>

          {/* 筛选标签 - 动态顺序 */}
          <div className="flex gap-2 p-4 border-b shrink-0 relative">
            <AnimatePresence>
            {(() => {
              const wantCount = useAppStore.getState().checkins.filter(c => c.status === 'want_to_visit').length;
              
              // 按钮定义，使用 motion.button 实现平滑顺序切换动画
              const wantButton = (
                <motion.button
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  key="want_to_visit"
                  onClick={() => setFilter('want_to_visit')}
                  className={`flex-1 py-2 px-3 rounded-full text-sm font-medium transition-colors ${
                    filter === 'want_to_visit'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  想去
                </motion.button>
              );
              
              const recommendedButton = (
                <motion.button
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  key="all"
                  onClick={() => setFilter('all')}
                  className={`flex-1 py-2 px-3 rounded-full text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  推荐
                </motion.button>
              );
              
              const visitedButton = (
                <motion.button
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  key="visited"
                  onClick={() => setFilter('visited')}
                  className={`flex-1 py-2 px-3 rounded-full text-sm font-medium transition-colors ${
                    filter === 'visited'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  去过
                </motion.button>
              );

              // 根据想去的数量决定顺序
              if (wantCount >= 2) {
                return [wantButton, recommendedButton, visitedButton];
              } else {
                return [recommendedButton, wantButton, visitedButton];
              }
            })()}
            </AnimatePresence>
          </div>

          {/* 选择提示 */}
          <div className="px-4 py-3 bg-blue-50 shrink-0">
            <p className="text-sm text-blue-700">
              已选择 <span className="font-bold">{selectedAttractions.length}</span> 个景区
              {selectedAttractions.length > 0 && '（点击已选中的可取消）'}
            </p>
          </div>

          {/* 景区列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
            {Object.keys(groupedAttractions).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
                <p>暂无记录</p>
                <p className="text-sm text-gray-400 mt-2">试试搜索其他景区吧</p>
              </div>
            ) : (
              // 所有模式：按省市聚类展示
              Object.entries(groupedAttractions).map(([province, attractions]) => (
                <div key={province} className="space-y-2">
                  {/* 省市标题 */}
                  <div className="flex items-center gap-2 py-2">
                    <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                    <h3 className="font-semibold text-gray-800">{province}</h3>
                    <span className="text-sm text-gray-500">({attractions.length}个景区)</span>
                  </div>
                  {/* 该省市的景区列表 */}
                  <div className="space-y-2 pl-3">
                    {attractions.map((attraction) => {
                      const isSelected = selectedAttractions.find(a => a.id === attraction.id);
                      const selectedIndex = selectedAttractions.findIndex(a => a.id === attraction.id);
                      const checkin = checkins.find((c) => c.attraction_id === attraction.id);
                      const isWantToVisit = checkin?.status === 'want_to_visit';
                      
                      return (
                        <div
                          key={attraction.id}
                          onClick={() => toggleAttraction(attraction)}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-blue-500'
                              : 'bg-white border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isSelected ? selectedIndex + 1 : <CheckCircle2 size={14} />}
                          </div>

                          <div className="flex-1">
                            <h3 className={`font-medium text-sm ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                              {highlightText(attraction.name, searchQuery)}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              📍 {highlightText(attraction.city || '', searchQuery)}
                            </p>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleWantToVisit(attraction);
                            }}
                            className={`p-2 rounded-full transition-colors ${
                              isWantToVisit ? 'text-amber-500 bg-amber-50' : 'text-amber-400 hover:text-amber-500 hover:bg-amber-50'
                            }`}
                          >
                            <Heart size={18} fill={isWantToVisit ? "currentColor" : "none"} />
                          </button>

                          {isSelected && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ml-1">
                              <CheckCircle2 size={12} className="text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 底部按钮 */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-md mx-auto">
            <button
              onClick={generateRoute}
              disabled={selectedAttractions.length < 2}
              className={`w-full py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                selectedAttractions.length >= 2
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Navigation size={20} />
              {selectedAttractions.length < 2 
                ? `请再选择${2 - selectedAttractions.length}个景区` 
                : '生成最优路线'}
            </button>
          </div>
        </div>
      ) : (
        /* 结果页面 */
        routePlan && (
          <>
            {/* 底部浮层 - 路线详情（从底部浮起，不遮挡地图上方区域） */}
            <div 
              ref={panelRef}
              className={`fixed left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 ease-out z-40 max-w-md mx-auto flex flex-col`}
              style={{ 
                bottom: '0',
                height: isPanelExpanded ? '75vh' : '146px', // 动态控制高度
                transform: 'translateY(0)' // 移除 translateY 动画
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleTouchStart}
              onMouseMove={handleTouchMove}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {/* 常驻显示区域 (把手 + 概览) */}
              <div className="shrink-0 bg-white rounded-t-3xl z-10" onClick={togglePanel}>
                {/* 拖拽指示条 */}
                <div className="flex flex-col items-center pt-3 pb-1 cursor-pointer">
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1" />
                  <span className="text-[10px] text-gray-400">
                    {isPanelExpanded ? '下滑收起' : '上滑展开'}
                  </span>
                </div>

                {/* 路线概览（始终显示） */}
                <div className="flex items-center gap-3 px-4 pb-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${ROUTE_COLORS.line}20` }}
                  >
                    {(() => {
                      const TransportIcon = getTransportInfo(routePlan.mainTransportMode).icon;
                      return <TransportIcon size={20} style={{ color: ROUTE_COLORS.line }} />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-gray-800 leading-tight">推荐路线</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {routePlan.points.length}个景点 · {routePlan.totalDistance}km · {formatDuration(routePlan.totalDuration, true)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 浮层内容 - 可滚动 */}
              <div className={`flex-1 overflow-y-auto px-4 transition-opacity duration-300 ${
                isPanelExpanded ? 'opacity-100' : 'opacity-0 hidden'
              }`}>
                {/* 统计数据 */}
                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-gray-100 mb-4">
                  <div className="flex flex-col items-center justify-center p-2 bg-purple-50 rounded-xl h-16">
                    <p className="text-lg font-bold text-purple-600 leading-none mb-1">{routePlan.points.length}</p>
                    <p className="text-xs text-gray-600">途经景点</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 bg-blue-50 rounded-xl h-16">
                    <p className="text-lg font-bold text-blue-600 leading-none mb-1">{routePlan.totalDistance}<span className="text-xs font-normal">km</span></p>
                    <p className="text-xs text-gray-600">总距离</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 bg-emerald-50 rounded-xl h-16">
                    <p className="text-lg font-bold text-emerald-600 leading-none mb-1">
                      {formatDuration(routePlan.totalDuration, true)}
                    </p>
                    <p className="text-xs text-gray-600">{getDurationUnit(routePlan.totalDuration)}</p>
                  </div>
                </div>

                {/* 路线详情列表 */}
                <div className="space-y-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm">路线详情</h3>
                    <span className="text-xs text-gray-400">拖拽可调整顺序</span>
                  </div>
                  
                  {routePlan.points.map((point, index) => (
                    <div 
                      key={point.attraction.id} 
                      className={`relative transition-all duration-200 ${
                        draggedIndex === index ? 'opacity-50' : ''
                      } ${
                        dragOverIndex === index ? 'bg-blue-50 rounded-xl' : ''
                      }`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-start gap-3 p-1 cursor-move">
                        {/* 序号 */}
                        <div className="flex flex-col items-center">
                          <div 
                            className="w-8 h-8 text-white rounded-full flex items-center justify-center font-bold text-sm cursor-grab active:cursor-grabbing"
                            style={{ backgroundColor: ROUTE_COLORS.marker }}
                          >
                            {point.order}
                          </div>
                          {index < routePlan.points.length - 1 && (
                            <div 
                              className="w-0.5 h-8 my-0.5"
                              style={{ backgroundColor: `${ROUTE_COLORS.line}40` }}
                            />
                          )}
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-1">
                            <h4 className="font-medium text-gray-800 text-sm">
                              {point.attraction.name}
                            </h4>
                            <span className="text-xs text-gray-300">⋮⋮</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {point.attraction.province} · {point.attraction.city}
                          </p>
                          
                          {/* 到下一站的交通方式 */}
                          {index < routePlan.points.length - 1 && routePlan.segments[index] && (
                            <div className="mt-2">
                              <div 
                                className="p-2 rounded-lg border cursor-pointer transition-colors"
                                style={{ 
                                  backgroundColor: expandedSegments.includes(index) ? `${ROUTE_COLORS.line}10` : '#F9FAFB',
                                  borderColor: expandedSegments.includes(index) ? ROUTE_COLORS.line : '#E5E7EB'
                                }}
                                onClick={() => toggleSegmentExpand(index)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    {(() => {
                                      const segment = routePlan.segments[index];
                                      const TransportIcon = getTransportInfo(segment.transportMode).icon;
                                      return (
                                        <>
                                          <div 
                                            className="w-6 h-6 rounded flex items-center justify-center"
                                            style={{ backgroundColor: `${ROUTE_COLORS.line}20` }}
                                          >
                                            <TransportIcon size={12} style={{ color: ROUTE_COLORS.line }} />
                                          </div>
                                          <span className="text-xs font-medium text-gray-700">
                                            {getTransportInfo(segment.transportMode).label}
                                          </span>
                                        </>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      {routePlan.segments[index].distance}km
                                    </span>
                                    <span className="text-xs text-gray-400">·</span>
                                    <span className="text-xs text-gray-500">
                                      {formatDuration(routePlan.segments[index].duration, true)}
                                    </span>
                                    {expandedSegments.includes(index) ? (
                                      <ChevronUp size={14} className="text-gray-400 ml-1" />
                                    ) : (
                                      <ChevronDown size={14} className="text-gray-400 ml-1" />
                                    )}
                                  </div>
                                </div>
                                
                                {/* 展开详情 */}
                                {expandedSegments.includes(index) && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    {(() => {
                                      const segment = routePlan.segments[index];
                                      const transport = getTransportInfo(segment.transportMode);
                                      return (
                                        <div className="text-xs text-gray-600">
                                          <p className="mb-1">
                                            <span className="font-medium">推荐理由：</span>
                                            {transport.description}
                                          </p>
                                          <p>
                                            预计{transport.label}用时{formatDuration(segment.duration)}
                                          </p>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 出行建议 */}
                <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs font-medium text-blue-800 mb-1">💡 出行建议</p>
                  <p className="text-xs text-blue-700">
                    本次以<strong>{getTransportInfo(routePlan.mainTransportMode).label}</strong>为主，
                    建议安排{Math.ceil(routePlan.totalDuration / 60 / 24)}天行程
                  </p>
                </div>
              </div>

              {/* 底部按钮 - 重新规划、收藏保存（整合到浮层中，始终吸底） */}
              <div className="shrink-0 px-4 py-3 border-t bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-1.5 hover:bg-gray-200 transition-colors text-sm"
                  >
                    <RotateCcw size={16} />
                    重新规划
                  </button>
                  <button
                    onClick={handleSaveRoute}
                    className="flex-1 py-3 text-white rounded-xl font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity text-sm"
                    style={{ backgroundColor: ROUTE_COLORS.line }}
                  >
                    <Bookmark size={16} />
                    收藏保存
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
