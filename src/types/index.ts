// 景区类型
export interface Attraction {
  id: string;
  name: string;
  short_name?: string;
  province: string;
  city: string;
  address?: string;
  description?: string;
  features?: string;
  tips?: string;
  ticket_price?: number;
  price_desc?: string;
  open_time?: string;
  latitude: number;
  longitude: number;
  image_url?: string;
  created_at?: string;
}

// 用户打卡类型
export interface UserCheckin {
  id: string;
  user_id: string;
  attraction_id: string;
  status: 'visited' | 'want_to_visit';
  visit_count: number;
  visited_at?: string;
  created_at?: string;
  updated_at?: string;
  attraction?: Attraction;
}

// 空间动态类型
export interface Post {
  id: string;
  user_id: string;
  attraction_id: string;
  content?: string;
  images: string[];
  is_private: boolean;
  created_at?: string;
  updated_at?: string;
  user?: UserProfile;
  attraction?: Attraction;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

// 用户资料类型
export interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  nickname: string;
  avatar_url?: string;
  is_private: boolean;
  created_at?: string;
  updated_at?: string;
}

// 评论类型
export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at?: string;
  updated_at?: string;
  user?: UserProfile;
}

// 点赞类型
export interface Like {
  id: string;
  post_id: string;
  user_id: string;
  created_at?: string;
}

// 省份类型
export interface Province {
  name: string;
  code: string;
}

export interface TripPlannerRequest {
  query: string;
}

export interface TripPlanAttractionItem {
  name: string;
  summary?: string;
  city?: string;
  province?: string;
  matchedAttractionId?: string;
  matchedAttractionName?: string;
  matchedScore?: number;
}

export interface TripPlanDay {
  day: number;
  title: string;
  attractions: TripPlanAttractionItem[];
}

export interface TripPlanOption {
  id: string;
  title: string;
  reason: string;
  days: TripPlanDay[];
}

export interface TripPlanMeta {
  totalMs?: number;
  modelMs?: number;
  matchMs?: number;
  cacheHit?: boolean;
  retried?: boolean;
}

export interface TripPlanResult {
  options: TripPlanOption[];
  provider?: string;
  generatedAt?: string;
  meta?: TripPlanMeta;
}

export interface SavedAiTripPlan {
  id: string;
  user_id: string;
  input_query: string;
  result_json: TripPlanResult;
  created_at?: string;
  updated_at?: string;
}
