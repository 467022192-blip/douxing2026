import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';
import type { Database } from '../types/supabase';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // 初始化认证状态
  initAuth: () => Promise<void>;
  
  // 邮箱登录
  loginWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  
  // 注册
  registerWithEmail: (email: string, password: string, nickname: string) => Promise<{ error: Error | null, needsEmailConfirmation?: boolean }>;
  
  // 游客一键免密登录
  loginAsGuest: () => Promise<{ error: Error | null }>;
  
  // 登出
  logout: () => Promise<void>;
  
  // 更新用户资料
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      // 初始化认证状态
      initAuth: async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) throw error;
          
          if (session?.user) {
            // 获取用户资料
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
              
            set({ 
              user: profile as UserProfile,
              isAuthenticated: true,
              isLoading: false 
            });
          } else {
            set({ isLoading: false });
          }
          
          // 监听认证状态变化
          supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
              // 简单重试机制，防止注册时 profile 还没写入
              let profile = null;
              for (let i = 0; i < 3; i++) {
                const { data } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                if (data) {
                  profile = data;
                  break;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
              }
                
              if (profile) {
                set({ 
                  user: profile as UserProfile,
                  isAuthenticated: true
                });
              }
            } else {
              set({ user: null, isAuthenticated: false });
            }
          });
        } catch (error) {
          console.error('Auth init error:', error);
          set({ isLoading: false });
        }
      },

      // 邮箱登录
      loginWithEmail: async (email: string, password: string) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (error) throw error;
          return { error: null };
        } catch (error) {
          return { error: error as Error };
        }
      },

      // 注册
      registerWithEmail: async (email: string, password: string, nickname: string) => {
        try {
          // 1. 注册账号
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin,
            }
          });
          
          if (error) throw error;
          
          const needsEmailConfirmation = !data.session;
          
          if (data.user) {
            // 2. 创建或更新用户资料 (由于我们配置了RLS或者没有配置自动触发器，这里手动插入)
            const profileData: Database['public']['Tables']['profiles']['Insert'] = {
              id: data.user.id,
              email: data.user.email,
              nickname: nickname || email.split('@')[0],
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
            };
            
            const { error: profileError } = await supabase
              .from('profiles')
              // @ts-ignore
              .upsert(profileData);
              
            if (profileError) {
              console.error('Profile creation error:', profileError);
              // 但用户已经注册成功，我们依然返回 null
            }
          }
          
          return { error: null, needsEmailConfirmation };
        } catch (error) {
          return { error: error as Error };
        }
      },

      // 游客一键登录 (暂时保留本地模拟，因为 Supabase 匿名登录配置较复杂，先以快速体验为主)
      // 如果后续配置了 Supabase 的匿名登录，可以替换这里
      loginAsGuest: async () => {
        // 由于是快速原型，我们生成一个随机的邮箱进行真实注册
        const guestId = Math.random().toString(36).substring(2, 10);
        const email = `guest_${guestId}@example.com`;
        const password = `guest_${guestId}_password123`;
        const nickname = `探索者_${guestId}`;
        
        return await get().registerWithEmail(email, password, nickname);
      },

      // 登出
      logout: async () => {
        await supabase.auth.signOut();
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      // 更新用户资料
      updateProfile: async (profile: Partial<UserProfile>) => {
        const { user } = get();
        if (!user) return;

        try {
          const updateData: Database['public']['Tables']['profiles']['Update'] = {
            ...profile,
            updated_at: new Date().toISOString(),
          };
          
          const { error } = await supabase
            .from('profiles')
            // @ts-ignore
            .update(updateData)
            .eq('id', user.id);
            
          if (error) throw error;
          
          // 更新本地状态
          set({
            user: {
              ...user,
              ...profile,
              updated_at: new Date().toISOString(),
            }
          });
        } catch (error) {
          console.error('Update profile error:', error);
        }
      },
    }),
    {
      name: 'auth-storage', // 去掉 -local，表示这是真实后端的存储
      partialize: (state) => ({ 
        // 不再持久化 user 和 isAuthenticated，让 initAuth 每次启动时通过 token 去后端验证，保证安全性
      }),
    }
  )
);
