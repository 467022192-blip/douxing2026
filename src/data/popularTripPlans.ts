import type { PublicPopularAiTripPlanDetail } from '../types';

export const POPULAR_TRIP_PLANS: PublicPopularAiTripPlanDetail[] = [
  {
    id: 'popular-xinjiang-loop',
    input_query: '20天乌鲁木齐出发新疆秋季大环线，自驾为主，想看湖泊、草原和雪山，路线尽量顺',
    cover_prompt:
      'Xinjiang autumn self-driving route, alpine lake and snowy mountains, aerial winding road, crisp golden grassland, documentary landscape photography',
    author_nickname: '北疆旅人',
    created_at: '2026-06-10T09:20:00.000Z',
    result_json: {
      generatedAt: '2026-06-10T09:20:00.000Z',
      provider: 'popular-guide-seed',
      options: [
        {
          id: 'popular-xinjiang-1',
          title: '北疆秋色经典环线',
          reason: '优先覆盖喀纳斯、禾木、赛里木湖等高热目的地，适合第一次走新疆秋季长线。',
          days: [
            {
              day: 1,
              title: '乌鲁木齐热身与城市适应',
              attractions: [
                { name: '新疆国际大巴扎', summary: '适合第一天慢节奏进入旅行状态。', city: '乌鲁木齐', province: '新疆' }
              ]
            },
            {
              day: 2,
              title: '前往可可托海',
              attractions: [
                { name: '可可托海景区', summary: '峡谷和河谷地貌很适合秋季拍照。', city: '阿勒泰', province: '新疆' }
              ]
            }
          ]
        },
        {
          id: 'popular-xinjiang-2',
          title: '雪山湖泊摄影线',
          reason: '把湖泊与高山景观优先级拉高，更适合偏摄影和出片导向的长线行程。',
          days: [
            {
              day: 1,
              title: '赛里木湖慢看日落',
              attractions: [
                { name: '赛里木湖', summary: '湖光和远山层次感强，适合傍晚拍摄。', city: '博尔塔拉', province: '新疆' }
              ]
            },
            {
              day: 2,
              title: '果子沟与伊宁',
              attractions: [
                { name: '果子沟大桥', summary: '公路视角极强，是沿线高热打卡点。', city: '伊犁', province: '新疆' }
              ]
            }
          ]
        },
        {
          id: 'popular-xinjiang-3',
          title: '草原牧场松弛线',
          reason: '整体节奏更舒缓，把停留时间留给草原、村落和自然步行体验。',
          days: [
            {
              day: 1,
              title: '那拉提草原轻徒步',
              attractions: [
                { name: '那拉提旅游风景区', summary: '更适合慢下来感受草原起伏和牧场风光。', city: '伊犁', province: '新疆' }
              ]
            },
            {
              day: 2,
              title: '唐布拉河谷公路',
              attractions: [
                { name: '唐布拉草原', summary: '适合自驾观景和轻松停留。', city: '伊犁', province: '新疆' }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: 'popular-yantai-relax',
    input_query: '烟台两日游，少走路、想拍照出片，行程轻松一点，适合周末从徐州出发',
    cover_prompt:
      'Yantai coastline city weekend, blue sea curve, relaxed urban seascape, bright afternoon light, premium editorial travel photo',
    author_nickname: '海边周末控',
    created_at: '2026-06-10T10:40:00.000Z',
    result_json: {
      generatedAt: '2026-06-10T10:40:00.000Z',
      provider: 'popular-guide-seed',
      options: [
        {
          id: 'popular-yantai-1',
          title: '海岸线轻松松弛线',
          reason: '以海边步道和城市景观为主，整体步行量可控，适合周末放空。',
          days: [
            {
              day: 1,
              title: '滨海广场到渔人码头',
              attractions: [
                { name: '烟台山景区', summary: '城市海岸视角好，适合轻松看海和拍照。', city: '烟台', province: '山东' }
              ]
            },
            {
              day: 2,
              title: '养马岛半日松弛游',
              attractions: [
                { name: '养马岛', summary: '更适合看海、吹风和低强度慢游。', city: '烟台', province: '山东' }
              ]
            }
          ]
        },
        {
          id: 'popular-yantai-2',
          title: '日落出片海边线',
          reason: '把拍照和海边日落体验放在最前面，节奏更适合周末短途。',
          days: [
            {
              day: 1,
              title: '金沙滩看海',
              attractions: [
                { name: '金沙滩海滨公园', summary: '空间开阔，适合傍晚拍人像和海景。', city: '烟台', province: '山东' }
              ]
            },
            {
              day: 2,
              title: '东炮台海滨散步',
              attractions: [
                { name: '东炮台海滨风景区', summary: '适合轻松散步，看礁石和海岸线。', city: '烟台', province: '山东' }
              ]
            }
          ]
        },
        {
          id: 'popular-yantai-3',
          title: '老城与海边混合线',
          reason: '把城市氛围和海边景观做了平衡，适合第一次去烟台的周末行程。',
          days: [
            {
              day: 1,
              title: '朝阳街城市漫游',
              attractions: [
                { name: '朝阳街', summary: '更适合吃吃逛逛、拍一些城市街景。', city: '烟台', province: '山东' }
              ]
            },
            {
              day: 2,
              title: '烟台山慢逛收尾',
              attractions: [
                { name: '烟台山景区', summary: '步行强度适中，适合短途最后半天。', city: '烟台', province: '山东' }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: 'popular-parenting-seaside',
    input_query: '5天4夜亲子海边度假，一家三口带6岁小孩，从北京出发，希望轻松不赶路',
    cover_prompt:
      'family seaside vacation in Xiamen, warm beach moment, child-friendly ocean view, soft natural light, realistic lifestyle travel cover',
    author_nickname: '亲子慢游家',
    created_at: '2026-06-10T11:15:00.000Z',
    result_json: {
      generatedAt: '2026-06-10T11:15:00.000Z',
      provider: 'popular-guide-seed',
      options: [
        {
          id: 'popular-parent-1',
          title: '亲子海边度假线',
          reason: '优先保证小孩能接受的节奏，把海边活动和休息时间都留够。',
          days: [
            {
              day: 1,
              title: '抵达后看海放松',
              attractions: [
                { name: '鼓浪屿', summary: '步行压力相对友好，适合一家人轻松逛。', city: '厦门', province: '福建' }
              ]
            },
            {
              day: 2,
              title: '海滩亲子时光',
              attractions: [
                { name: '曾厝垵海边', summary: '适合轻松看海、吃点东西、慢节奏活动。', city: '厦门', province: '福建' }
              ]
            }
          ]
        },
        {
          id: 'popular-parent-2',
          title: '低强度看海玩乐线',
          reason: '减少来回折返，把更多时间留给适合小朋友的松弛体验。',
          days: [
            {
              day: 1,
              title: '环岛路海边轻骑行',
              attractions: [
                { name: '环岛路', summary: '适合亲子轻松看海，节奏可快可慢。', city: '厦门', province: '福建' }
              ]
            },
            {
              day: 2,
              title: '植物园半日轻游',
              attractions: [
                { name: '厦门园林植物园', summary: '让海边行程里加入一点轻松自然体验。', city: '厦门', province: '福建' }
              ]
            }
          ]
        },
        {
          id: 'popular-parent-3',
          title: '海边加城市体验线',
          reason: '适合第一次带娃去海边，兼顾轻松城市体验和海边活动。',
          days: [
            {
              day: 1,
              title: '沙坡尾慢逛',
              attractions: [
                { name: '沙坡尾', summary: '适合一家三口慢慢逛，氛围轻松。', city: '厦门', province: '福建' }
              ]
            },
            {
              day: 2,
              title: '白城沙滩轻松玩',
              attractions: [
                { name: '白城沙滩', summary: '适合小朋友海边玩耍，强度较低。', city: '厦门', province: '福建' }
              ]
            }
          ]
        }
      ]
    }
  }
];

export const getPopularTripPlanById = (id: string) =>
  POPULAR_TRIP_PLANS.find((item) => item.id === id) || null;
