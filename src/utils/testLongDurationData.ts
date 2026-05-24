import type { Attraction, UserCheckin } from '../types';
import { MOCK_ATTRACTIONS } from '../data/mockAttractions';

/**
 * 超长路线测试数据
 * 用于验证「2天6小时」等超长预计用时显示效果
 */

// 场景1：超长途全国游 - 预计2-3天
// 路线：黑龙江 → 内蒙古 → 新疆 → 青海 → 西藏 → 贵州 → 海南
export const getUltraLongRouteAttractions = (): Attraction[] => [
  MOCK_ATTRACTIONS[40],  // 太阳岛（黑龙江哈尔滨）- 纬度：45.78, 经度：126.55
  MOCK_ATTRACTIONS[42],  // 呼伦贝尔（内蒙古）- 纬度：49.21, 经度：119.74
  MOCK_ATTRACTIONS[38],  // 天山天池（新疆）- 纬度：43.89, 经度：88.13
  MOCK_ATTRACTIONS[43],  // 青海湖（青海）- 纬度：36.90, 经度：100.15
  MOCK_ATTRACTIONS[17],  // 布达拉宫（西藏）- 纬度：29.66, 经度：91.12
  MOCK_ATTRACTIONS[44],  // 黄果树瀑布（贵州）- 纬度：25.99, 经度：105.67
  MOCK_ATTRACTIONS[14],  // 三亚南山（海南）- 纬度：18.31, 经度：109.21
];

// 场景2：东北-西北-西南大环线 - 预计3-4天
// 路线：黑龙江 → 北京 → 陕西 → 甘肃 → 新疆 → 云南
export const getNorthToSouthRouteAttractions = (): Attraction[] => [
  MOCK_ATTRACTIONS[41],  // 五大连池（黑龙江）- 纬度：48.77, 经度：126.13
  MOCK_ATTRACTIONS[0],   // 故宫（北京）- 纬度：39.92, 经度：116.40
  MOCK_ATTRACTIONS[9],   // 兵马俑（陕西）- 纬度：34.38, 经度：109.28
  MOCK_ATTRACTIONS[18],  // 敦煌（甘肃）- 纬度：40.04, 经度：94.81
  MOCK_ATTRACTIONS[38],  // 天山天池（新疆）- 纬度：43.89, 经度：88.13
  MOCK_ATTRACTIONS[16],  // 丽江古城（云南）- 纬度：26.87, 经度：100.23
];

// 场景3：极端距离测试 - 预计4-5天（最极端情况）
// 路线：黑龙江 → 新疆 → 西藏 → 海南
export const getExtremeRouteAttractions = (): Attraction[] => [
  MOCK_ATTRACTIONS[40],  // 太阳岛（黑龙江）- 中国最北
  MOCK_ATTRACTIONS[39],  // 喀纳斯（新疆）- 中国最西北
  MOCK_ATTRACTIONS[17],  // 布达拉宫（西藏）- 中国西南高原
  MOCK_ATTRACTIONS[14],  // 三亚南山（海南）- 中国最南
];

// 场景4：中等距离 - 预计1-2天
// 路线：东南沿海线
export const getMediumRouteAttractions = (): Attraction[] => [
  MOCK_ATTRACTIONS[15],  // 鼓浪屿（福建）
  MOCK_ATTRACTIONS[5],   // 普陀山（浙江）
  MOCK_ATTRACTIONS[4],   // 西湖（浙江）
  MOCK_ATTRACTIONS[19],  // 苏州园林（江苏）
  MOCK_ATTRACTIONS[33],  // 中山陵（江苏）
];

// 场景5：短距离 - 预计几小时
// 路线：北京本地
export const getShortRouteAttractions = (): Attraction[] => [
  MOCK_ATTRACTIONS[0],   // 故宫
  MOCK_ATTRACTIONS[1],   // 天坛
  MOCK_ATTRACTIONS[2],   // 颐和园
  MOCK_ATTRACTIONS[3],   // 长城
];

/**
 * 生成超长路线的打卡数据
 * 用于直接测试路线规划页面
 */
export const generateUltraLongCheckins = (): UserCheckin[] => {
  const now = new Date().toISOString();
  const ultraLongAttractions = getUltraLongRouteAttractions();

  return ultraLongAttractions.map((attraction) => ({
    id: `checkin-ultra-${attraction.id}`,
    user_id: 'mock-user',
    attraction_id: attraction.id,
    status: 'want_to_visit' as const,
    visit_count: 0,
    visited_at: null,
    created_at: now,
    updated_at: now,
    attraction: attraction,
  }));
};

/**
 * 生成所有测试场景的打卡数据
 */
export const generateAllTestCheckins = (): UserCheckin[] => {
  const now = new Date().toISOString();
  
  // 合并所有测试场景的景区
  const allTestAttractions = [
    ...getUltraLongRouteAttractions(),
    ...getNorthToSouthRouteAttractions(),
    ...getExtremeRouteAttractions(),
    ...getMediumRouteAttractions(),
    ...getShortRouteAttractions(),
  ];
  
  // 去重
  const uniqueAttractions = Array.from(
    new Map(allTestAttractions.map(a => [a.id, a])).values()
  );

  return uniqueAttractions.map((attraction) => ({
    id: `checkin-test-${attraction.id}`,
    user_id: 'mock-user',
    attraction_id: attraction.id,
    status: 'want_to_visit' as const,
    visit_count: 0,
    visited_at: null,
    created_at: now,
    updated_at: now,
    attraction: attraction,
  }));
};

/**
 * 计算两点之间的距离（公里）
 * 用于预估路线总距离
 */
export const calculateDistance = (
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * 预估路线信息
 * 用于验证预计用时显示
 */
export const getRouteEstimateInfo = (attractions: Attraction[]) => {
  let totalDistance = 0;
  
  for (let i = 0; i < attractions.length - 1; i++) {
    totalDistance += calculateDistance(
      attractions[i].latitude,
      attractions[i].longitude,
      attractions[i + 1].latitude,
      attractions[i + 1].longitude
    );
  }
  
  // 假设平均速度：飞机800km/h，加上机场等待时间
  // 实际计算会更复杂，这里简化处理
  const flightSpeed = 800; // km/h
  const flightTime = (totalDistance / flightSpeed) * 60; // 分钟
  
  // 每个景点游览2小时
  const visitingTime = attractions.length * 120; // 分钟
  
  const totalDuration = flightTime + visitingTime;
  const days = Math.floor(totalDuration / 60 / 24);
  const hours = Math.floor((totalDuration % (60 * 24)) / 60);
  
  return {
    totalDistance: Math.round(totalDistance),
    totalDuration: Math.round(totalDuration),
    days,
    hours,
    displayText: days > 0 ? `${days}天${hours}小时` : `${hours}小时`,
  };
};

/**
 * 各测试场景的预估信息
 */
export const testScenariosEstimate = {
  ultraLong: getRouteEstimateInfo(getUltraLongRouteAttractions()),
  northToSouth: getRouteEstimateInfo(getNorthToSouthRouteAttractions()),
  extreme: getRouteEstimateInfo(getExtremeRouteAttractions()),
  medium: getRouteEstimateInfo(getMediumRouteAttractions()),
  short: getRouteEstimateInfo(getShortRouteAttractions()),
};

// 打印预估信息到控制台
console.log('=== 超长路线测试数据预估 ===');
console.log('超长途全国游（7个景点）:', testScenariosEstimate.ultraLong.displayText);
console.log('东北-西北-西南大环线（6个景点）:', testScenariosEstimate.northToSouth.displayText);
console.log('极端距离测试（4个景点）:', testScenariosEstimate.extreme.displayText);
console.log('中等距离（5个景点）:', testScenariosEstimate.medium.displayText);
console.log('短距离（4个景点）:', testScenariosEstimate.short.displayText);
