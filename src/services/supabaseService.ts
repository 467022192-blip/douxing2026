import { supabase as supabaseClient } from '../lib/supabase';
import type { UserProfile, UserCheckin, Post, Comment, Attraction } from '../types';
import type { Database } from '../types/supabase';

const supabase = supabaseClient;

// ==================== 用户相关 ====================

/**
 * 获取当前登录用户
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

/**
 * 获取用户资料
 */
export const getProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('获取用户资料失败:', error);
    return null;
  }

  return data as UserProfile;
};

/**
 * 更新用户资料
 */
export const updateProfile = async (userId: string, updates: Partial<UserProfile>) => {
  const updateData: Database['public']['Tables']['profiles']['Update'] = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
};

/**
 * 创建用户资料（注册时调用）
 */
export const createProfile = async (userId: string, profile: Partial<UserProfile>) => {
  const insertData: Database['public']['Tables']['profiles']['Insert'] = {
    id: userId,
    ...profile,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
};

// ==================== 景区相关 ====================

const ATTRACTIONS_LIST_SELECT =
  'id,name,province,city,latitude,longitude,image_url,ticket_price,open_time,tips' as const;

/**
 * 获取所有景区
 */
export const getAttractions = async (): Promise<Attraction[]> => {
  const { data, error } = await supabase
    .from('attractions')
    .select(ATTRACTIONS_LIST_SELECT)
    .order('name');

  if (error) throw error;
  return data as Attraction[];
};

/**
 * 按省份筛选景区
 */
export const getAttractionsByProvince = async (province: string): Promise<Attraction[]> => {
  const { data, error } = await supabase
    .from('attractions')
    .select(ATTRACTIONS_LIST_SELECT)
    .eq('province', province)
    .order('name');

  if (error) throw error;
  return data as Attraction[];
};

/**
 * 获取景区详情
 */
export const getAttractionsById = async (id: string): Promise<Attraction> => {
  const { data, error } = await supabase
    .from('attractions')
    .select('id,name,province,city,address,latitude,longitude,image_url,ticket_price,open_time,tips')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Attraction;
};

/**
 * 后端模糊检索景区
 */
export const searchAttractions = async (keyword?: string, filterIds?: string[], province?: string): Promise<Attraction[]> => {
  let query = supabase.from('attractions').select(ATTRACTIONS_LIST_SELECT);

  if (keyword) {
    // 模糊匹配名称、城市、省份
    query = query.or(`name.ilike.%${keyword}%,city.ilike.%${keyword}%,province.ilike.%${keyword}%`);
  }

  if (province && province !== '全部') {
    // 模糊匹配省份名称（处理可能缺少"省"、"市"等后缀的情况）
    query = query.ilike('province', `${province}%`);
  }

  if (filterIds && filterIds.length > 0) {
    query = query.in('id', filterIds);
  } else if (filterIds && filterIds.length === 0) {
    // 如果明确要求筛选特定的 ID 列表但列表为空，直接返回空数组
    return [];
  }

  // 获取全部数据，不再限制 100 条，以支持首页全量排序和足迹全量地图点位
  const { data, error } = await query.limit(3000);

  if (error) {
    console.error('搜索景区失败:', error);
    throw error;
  }
  
  return data as Attraction[];
};

/**
 * 获取景区总数
 */
export const getTotalAttractionsCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('attractions')
    .select('id', { count: 'exact', head: true });
    
  if (error) {
    console.error('获取景区总数失败:', error);
    return 0;
  }
  return count || 0;
};


// ==================== 打卡相关 ====================

/**
 * 获取用户的所有打卡记录
 */
export const getUserCheckins = async (userId: string): Promise<UserCheckin[]> => {
  const { data, error } = await supabase
    .from('user_checkins')
    .select(`
      *,
      attraction:attractions(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取打卡记录失败:', error);
    return [];
  }

  return data as unknown as UserCheckin[];
};

/**
 * 添加打卡记录
 */
export const addCheckin = async (checkin: Omit<UserCheckin, 'id' | 'created_at' | 'updated_at'>) => {
  const insertData: Database['public']['Tables']['user_checkins']['Insert'] = {
    ...checkin,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('user_checkins')
    .insert(insertData)
    .select(`
      *,
      attraction:attractions(*)
    `)
    .single();

  if (error) throw error;
  return data as unknown as UserCheckin;
};

/**
 * 更新打卡记录
 */
export const updateCheckin = async (id: string, updates: Partial<UserCheckin>) => {
  const updateData: Database['public']['Tables']['user_checkins']['Update'] = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('user_checkins')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      attraction:attractions(*)
    `)
    .single();

  if (error) throw error;
  return data as unknown as UserCheckin;
};

/**
 * 删除打卡记录
 */
export const deleteCheckin = async (id: string) => {
  const { error } = await supabase
    .from('user_checkins')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// ==================== 动态相关 ====================

/**
 * 获取所有动态（公开的）
 */
export const getPosts = async (page = 1, pageSize = 10): Promise<Post[]> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:profiles(id, nickname, avatar_url, is_private),
      likes:likes(count),
      comments:comments(count)
    `)
    .eq('is_private', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('获取动态失败:', error);
    return [];
  }

  const getCount = (value: unknown): number => {
    if (Array.isArray(value)) {
      const first = value[0] as unknown;
      if (first && typeof first === 'object' && 'count' in (first as Record<string, unknown>)) {
        const count = (first as Record<string, unknown>).count;
        return typeof count === 'number' ? count : 0;
      }
      return 0;
    }
    if (value && typeof value === 'object' && 'count' in (value as Record<string, unknown>)) {
      const count = (value as Record<string, unknown>).count;
      return typeof count === 'number' ? count : 0;
    }
    return 0;
  };

  // Fetch attraction details separately since we removed the foreign key
  const attractionIds = [...new Set(data.map(post => post.attraction_id))];
  let attractionsMap: Record<string, Attraction> = {};
  
  if (attractionIds.length > 0) {
    const { data: attractionsData } = await supabase
      .from('attractions')
      .select('*')
      .in('id', attractionIds);
      
    if (attractionsData) {
      attractionsMap = attractionsData.reduce<Record<string, Attraction>>((acc, attr) => {
        acc[(attr as Attraction).id] = attr as Attraction;
        return acc;
      }, {});
    }
  }

  // Format the counts and attach attractions
  const formattedData = data.map((post) => {
    const postRecord = post as unknown as Record<string, unknown>;

    return {
      ...post,
      attraction: attractionsMap[post.attraction_id] || null,
      likes_count: getCount(postRecord.likes),
      comments_count: getCount(postRecord.comments),
    };
  });

  return formattedData as unknown as Post[];
};

/**
 * 获取用户的动态
 */
export const getUserPosts = async (userId: string): Promise<Post[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:profiles(id, nickname, avatar_url, is_private)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取用户动态失败:', error);
    return [];
  }

  const attractionIds = [...new Set(data.map(post => post.attraction_id))];
  let attractionsMap: Record<string, Attraction> = {};
  
  if (attractionIds.length > 0) {
    const { data: attractionsData } = await supabase
      .from('attractions')
      .select('*')
      .in('id', attractionIds);
      
    if (attractionsData) {
      attractionsMap = attractionsData.reduce<Record<string, Attraction>>((acc, attr) => {
        acc[(attr as Attraction).id] = attr as Attraction;
        return acc;
      }, {});
    }
  }

  const formattedData = data.map((post) => ({
    ...post,
    attraction: attractionsMap[post.attraction_id] || null,
  }));

  return formattedData as unknown as Post[];
};

/**
 * 创建动态
 */
export const createPost = async (post: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'likes_count' | 'comments_count' | 'is_liked'>) => {
  const insertData: Database['public']['Tables']['posts']['Insert'] = {
    ...post,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('posts')
    .insert(insertData)
    .select(`
      *,
      user:profiles(id, nickname, avatar_url, is_private)
    `)
    .single();

  if (error) throw error;
  
  // Attach attraction detail for the newly created post
  let attraction = null;
  if (data.attraction_id) {
    const { data: attrData, error: attrError } = await supabase
      .from('attractions')
      .select('*')
      .eq('id', data.attraction_id)
      .maybeSingle();
      
    if (attrData && !attrError) {
      attraction = attrData;
    }
  }
  
  return { ...data, attraction } as unknown as Post;
};

/**
 * 删除动态
 */
export const deletePost = async (postId: string) => {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
};

// ==================== 评论相关 ====================

/**
 * 获取动态的评论
 */
export const getComments = async (postId: string): Promise<Comment[]> => {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      user:profiles(id, nickname, avatar_url, is_private)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取评论失败:', error);
    return [];
  }

  return data as unknown as Comment[];
};

/**
 * 添加评论
 */
export const addComment = async (comment: Omit<Comment, 'id' | 'created_at' | 'updated_at'>) => {
  const insertData: Database['public']['Tables']['comments']['Insert'] = {
    ...comment,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('comments')
    .insert(insertData)
    .select(`
      *,
      user:profiles(id, nickname, avatar_url, is_private)
    `)
    .single();

  if (error) throw error;
  return data as unknown as Comment;
};

// ==================== 点赞相关 ====================

/**
 * 检查用户是否点赞
 */
export const checkLike = async (postId: string, userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = 未找到记录
    console.error('检查点赞状态失败:', error);
  }

  return !!data;
};

/**
 * 添加点赞
 */
export const addLike = async (postId: string, userId: string) => {
  const insertData: Database['public']['Tables']['likes']['Insert'] = {
    post_id: postId,
    user_id: userId,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('likes')
    .insert(insertData);

  if (error) throw error;
};

/**
 * 取消点赞
 */
export const removeLike = async (postId: string, userId: string) => {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) throw error;
};

/**
 * 获取动态的点赞数
 */
export const getLikesCount = async (postId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) {
    console.error('获取点赞数失败:', error);
    return 0;
  }

  return count || 0;
};

// ==================== 文件上传 ====================

/**
 * 上传图片到 Supabase Storage
 */
export const uploadImage = async (file: File, userId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  const filePath = `posts/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('posts')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('posts')
    .getPublicUrl(filePath);

  return publicUrl;
};
