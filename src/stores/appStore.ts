import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { UserCheckin } from '../types';
import type { Database } from '../types/supabase';
import { generateMockCheckins } from '../utils/mockData';
import { useAuthStore } from './authStore';

interface AppState {
  // 打卡数据
  checkins: UserCheckin[];
  // 当前选中的省份
  selectedProvince: string;
  // 是否正在加载
  isLoading: boolean;
  
  // 设置选中的省份
  setSelectedProvince: (province: string) => void;
  
  // 加载打卡数据
  loadCheckins: (userId: string) => Promise<void>;
  
  // 添加打卡
  addCheckin: (checkin: Omit<UserCheckin, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  
  // 更新打卡
  updateCheckin: (id: string, updates: Partial<UserCheckin>) => Promise<void>;
  
  // 删除打卡
  removeCheckin: (id: string) => Promise<void>;
  
  // 获取景区的打卡状态
  getCheckinByAttraction: (attractionId: string) => UserCheckin | undefined;
  
  // 获取统计数据
  getStats: () => { visited: number; wantToVisit: number };
  
  // 清除本地数据（登出时调用）
  clearData: () => void;

  // 加载模拟数据（本地测试用）
  loadMockData: (wantCount?: number, visitedCount?: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      checkins: [],
      selectedProvince: '全部',
      isLoading: false,

      setSelectedProvince: (province) => set({ selectedProvince: province }),

      // 从云端加载打卡数据
      loadCheckins: async (userId: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase
            .from('user_checkins')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

          if (error) throw error;

          if (data && data.length > 0) {
            set({ checkins: data as UserCheckin[] });
          } else {
            // 新用户如果没有数据，为了体验可以加载一份Mock数据并同步到云端
            get().loadMockData();
          }
        } catch (error) {
          console.error('Load checkins error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      // 添加打卡
      addCheckin: async (checkin) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        try {
          const insertData: Database['public']['Tables']['user_checkins']['Insert'] = {
            ...checkin,
            user_id: userId
          };

          const { data, error } = await supabase
            .from('user_checkins')
            // @ts-ignore
            .insert([insertData])
            .select()
            .single();

          if (error) throw error;

          set((state) => ({
            checkins: [data as UserCheckin, ...state.checkins],
          }));
        } catch (error) {
          console.error('Add checkin error:', error);
        }
      },

      // 更新打卡
      updateCheckin: async (id, updates) => {
        try {
          const { data, error } = await supabase
            .from('user_checkins')
            // @ts-ignore
            .update(updates)
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;

          set((state) => ({
            checkins: state.checkins.map((c) => (c.id === id ? (data as UserCheckin) : c)),
          }));
        } catch (error) {
          console.error('Update checkin error:', error);
        }
      },

      // 删除打卡
      removeCheckin: async (id) => {
        try {
          const { error } = await supabase
            .from('user_checkins')
            .delete()
            .eq('id', id);

          if (error) throw error;

          set((state) => ({
            checkins: state.checkins.filter((c) => c.id !== id),
          }));
        } catch (error) {
          console.error('Remove checkin error:', error);
        }
      },

      // 获取景区的打卡状态
      getCheckinByAttraction: (attractionId) => {
        return get().checkins.find((c) => c.attraction_id === attractionId);
      },

      // 获取统计数据
      getStats: () => {
        const checkins = get().checkins;
        return {
          visited: checkins.filter((c) => c.status === 'visited').length,
          wantToVisit: checkins.filter((c) => c.status === 'want_to_visit').length,
        };
      },

      // 清除本地数据
      clearData: () => {
        set({
          checkins: [],
          selectedProvince: '全部',
        });
      },

      // 加载模拟数据（本地测试用）
      loadMockData: (wantCount?: number, visitedCount?: number) => {
        const mockCheckins = generateMockCheckins(wantCount, visitedCount);
        set({ checkins: mockCheckins });
        console.log(`模拟数据已加载: 共${mockCheckins.length}条打卡记录`);
      },
    }),
    {
      name: 'app-storage-local', // 使用新的 key 隔离之前的存储
      partialize: (state) => ({
        selectedProvince: state.selectedProvince,
        checkins: state.checkins, // 现改为本地持久化全部打卡数据
      }),
    }
  )
);
