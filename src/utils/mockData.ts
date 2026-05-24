import type { Attraction, UserCheckin } from '../types';
import { MOCK_ATTRACTIONS } from '../data/mockAttractions';

const findAttractions = (count: number, filterFn: (a: Attraction) => boolean) => {
  return MOCK_ATTRACTIONS.filter(filterFn).slice(0, count);
};

export const generateMockCheckins = (wantCount: number = 30, visitedCount: number = 20): UserCheckin[] => {
  const now = new Date().toISOString();
  
  // 从 MOCK_ATTRACTIONS 中随机或按省份挑选
  // 为了保证每次刷新数据一致且分布合理，按省份挑选去过和想去

  let visitedAttractions = [];
  
  if (visitedCount > 0) {
    // 去过 - 主要集中在东部和一线城市
    visitedAttractions = [
      ...findAttractions(Math.min(4, visitedCount), a => a.province.includes('北京')),
      ...findAttractions(Math.min(2, visitedCount), a => a.province.includes('上海')),
      ...findAttractions(Math.min(4, visitedCount), a => a.province.includes('浙江')),
      ...findAttractions(Math.min(4, visitedCount), a => a.province.includes('江苏')),
      ...findAttractions(Math.min(3, visitedCount), a => a.province.includes('广东')),
      ...findAttractions(Math.min(3, visitedCount), a => a.province.includes('福建'))
    ];

    // 补齐到目标数量
    if (visitedAttractions.length < visitedCount) {
      const extras = MOCK_ATTRACTIONS.filter(a => !visitedAttractions.find(v => v.id === a.id)).slice(0, visitedCount - visitedAttractions.length);
      visitedAttractions = [...visitedAttractions, ...extras];
    } else if (visitedAttractions.length > visitedCount) {
      visitedAttractions = visitedAttractions.slice(0, visitedCount);
    }
  }

  // 想去 (默认30个，可传入更少) - 主要集中在中西部旅游大省，便于路线规划
  let wantToVisitAttractions = [
    ...findAttractions(Math.min(6, wantCount), a => a.province.includes('四川')),
    ...findAttractions(Math.min(6, wantCount), a => a.province.includes('云南')),
    ...findAttractions(Math.min(5, wantCount), a => a.province.includes('陕西')),
    ...findAttractions(Math.min(4, wantCount), a => a.province.includes('湖南')),
    ...findAttractions(Math.min(4, wantCount), a => a.province.includes('新疆')),
    ...findAttractions(Math.min(3, wantCount), a => a.province.includes('西藏')),
    ...findAttractions(Math.min(2, wantCount), a => a.province.includes('青海'))
  ].filter(a => !visitedAttractions.find(v => v.id === a.id));

  // 控制想去的数量
  if (wantToVisitAttractions.length < wantCount) {
    const extras = MOCK_ATTRACTIONS.filter(
      a => !visitedAttractions.find(v => v.id === a.id) && !wantToVisitAttractions.find(w => w.id === a.id)
    ).slice(0, wantCount - wantToVisitAttractions.length);
    wantToVisitAttractions = [...wantToVisitAttractions, ...extras];
  } else if (wantToVisitAttractions.length > wantCount) {
    wantToVisitAttractions = wantToVisitAttractions.slice(0, wantCount);
  }

  const checkins: UserCheckin[] = [];
  
  visitedAttractions.forEach(a => {
    checkins.push({
      id: `checkin-visited-${a.id}`,
      user_id: 'mock-user',
      attraction_id: a.id,
      status: 'visited',
      visit_count: 1,
      visited_at: now,
      created_at: now,
      updated_at: now,
      attraction: a,
    });
  });

  wantToVisitAttractions.forEach(a => {
    checkins.push({
      id: `checkin-want-${a.id}`,
      user_id: 'mock-user',
      attraction_id: a.id,
      status: 'want_to_visit',
      visit_count: 0,
      visited_at: null,
      created_at: now,
      updated_at: now,
      attraction: a,
    });
  });

  return checkins;
};

export const generateWantToVisitData = (): UserCheckin[] => {
  return generateMockCheckins().filter(c => c.status === 'want_to_visit');
};

export const getUltraLongRouteWantToVisit = (): UserCheckin[] => {
  const now = new Date().toISOString();
  
  const ultraLongAttractions = [
    ...findAttractions(1, a => a.province.includes('黑龙江')),
    ...findAttractions(1, a => a.province.includes('内蒙古')),
    ...findAttractions(1, a => a.province.includes('新疆')),
    ...findAttractions(1, a => a.province.includes('青海')),
    ...findAttractions(1, a => a.province.includes('西藏')),
    ...findAttractions(1, a => a.province.includes('贵州')),
    ...findAttractions(1, a => a.province.includes('海南')),
  ];

  return ultraLongAttractions.map((a) => ({
    id: `checkin-ultra-${a.id}`,
    user_id: 'mock-user',
    attraction_id: a.id,
    status: 'want_to_visit',
    visit_count: 0,
    visited_at: null,
    created_at: now,
    updated_at: now,
    attraction: a,
  }));
};

export const getWantToVisitByProvince = () => {
  const wantToVisit = generateWantToVisitData();
  
  const grouped: Record<string, UserCheckin[]> = {};
  
  wantToVisit.forEach((checkin) => {
    const province = checkin.attraction?.province || '其他';
    if (!grouped[province]) {
      grouped[province] = [];
    }
    grouped[province].push(checkin);
  });
  
  return Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .reduce((acc, [province, checkins]) => {
      acc[province] = checkins;
      return acc;
    }, {} as Record<string, UserCheckin[]>);
};

export const clearMockData = () => {
  localStorage.removeItem('app-storage');
};
