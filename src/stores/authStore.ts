import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';
import type { Database } from '../types/supabase';
import { env, getAppPublicUrl } from '../config/env';

const AUTH_RECOVERY_TIMEOUT_MS = 2500;
const AUTH_STORAGE_KEY = env.supabaseUrl
  ? `sb-${new URL(env.supabaseUrl).hostname.split('.')[0]}-auth-token`
  : null;

const withAuthTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const getAuthStorageValue = () => {
  if (typeof window === 'undefined' || !AUTH_STORAGE_KEY) return null;
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
};

const clearAuthStorage = () => {
  if (typeof window === 'undefined' || !AUTH_STORAGE_KEY) return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

const isRecoverableAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return [
    'refresh token',
    'refresh_token',
    'invalid jwt',
    'jwt malformed',
    'auth session missing',
    'session from storage is not valid',
    'auth recovery timeout',
  ].some((keyword) => message.includes(keyword));
};

const recoverBrokenAuthState = async (reason: string, error: unknown) => {
  clearAuthStorage();
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  if (signOutError) {
    console.warn(`Local sign-out during ${reason} recovery failed:`, signOutError, error);
  }
};

const reportAuthDebug = (hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) => {
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'auth-guide-regression',
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
};

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

const fetchProfileWithRetry = async (userId: string) => {
  let profile: unknown = null;
  for (let i = 0; i < 3; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      profile = data;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return profile as UserProfile | null;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      // 初始化认证状态
      initAuth: async () => {
        try {
          // #region debug-point AGR:init-start
          reportAuthDebug('AGR', 'authStore:initAuth:start', '[DEBUG] initAuth start', {
            hasAuthStorage: Boolean(getAuthStorageValue()),
          });
          // #endregion
          const { data: { session }, error } = await withAuthTimeout(
            supabase.auth.getSession(),
            AUTH_RECOVERY_TIMEOUT_MS,
            'Auth recovery timeout: getSession stalled'
          );
          if (error) throw error;
          // #region debug-point AGR:init-after-session
          reportAuthDebug('AGR', 'authStore:initAuth:afterSession', '[DEBUG] initAuth after session', {
            hasSession: Boolean(session),
            userId: session?.user?.id ?? null,
          });
          // #endregion
          
          if (session?.user) {
            const profile = await fetchProfileWithRetry(session.user.id);
            // #region debug-point AGR:init-after-profile
            reportAuthDebug('AGR', 'authStore:initAuth:afterProfile', '[DEBUG] initAuth after profile', {
              userId: session.user.id,
              hasProfile: Boolean(profile),
            });
            // #endregion
              
            set({ 
              user: profile as UserProfile,
              isAuthenticated: true,
              isLoading: false 
            });
          } else {
            set({ isLoading: false });
          }
          
          // 监听认证状态变化
          supabase.auth.onAuthStateChange(async (_event, session) => {
            // #region debug-point AGR:on-auth-change-start
            reportAuthDebug('AGR', 'authStore:onAuthStateChange:start', '[DEBUG] auth state change start', {
              event: _event,
              hasSession: Boolean(session),
              userId: session?.user?.id ?? null,
            });
            // #endregion
            if (session?.user) {
              const profile = await fetchProfileWithRetry(session.user.id);
              // #region debug-point AGR:on-auth-change-after-profile
              reportAuthDebug('AGR', 'authStore:onAuthStateChange:afterProfile', '[DEBUG] auth state change after profile', {
                event: _event,
                userId: session.user.id,
                hasProfile: Boolean(profile),
              });
              // #endregion
                
              if (profile) {
                set({ 
                  user: profile as UserProfile,
                  isAuthenticated: true
                });
              }
            } else {
              set({ user: null, isAuthenticated: false });
            }
            // #region debug-point AGR:on-auth-change-done
            reportAuthDebug('AGR', 'authStore:onAuthStateChange:done', '[DEBUG] auth state change done', {
              event: _event,
              hasSession: Boolean(session),
            });
            // #endregion
          });
        } catch (error) {
          // #region debug-point AGR:init-catch
          reportAuthDebug('AGR', 'authStore:initAuth:catch', '[DEBUG] initAuth catch', {
            errorMessage: error instanceof Error ? error.message : String(error),
            hasAuthStorage: Boolean(getAuthStorageValue()),
          });
          // #endregion
          if (isRecoverableAuthError(error)) {
            await recoverBrokenAuthState('initAuth', error);
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
          }
          console.error('Auth init error:', error);
          set({ isLoading: false });
        }
      },

      // 邮箱登录
      loginWithEmail: async (email: string, password: string) => {
        try {
          // #region debug-point AGR:login-start
          reportAuthDebug('AGR', 'authStore:login:start', '[DEBUG] login start', {
            email,
          });
          // #endregion
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          // #region debug-point AGR:login-after-signin
          reportAuthDebug('AGR', 'authStore:login:afterSignIn', '[DEBUG] login after signIn', {
            email,
          });
          // #endregion

          const { data: { session } } = await supabase.auth.getSession();
          // #region debug-point AGR:login-after-session
          reportAuthDebug('AGR', 'authStore:login:afterSession', '[DEBUG] login after session', {
            email,
            hasSession: Boolean(session),
            userId: session?.user?.id ?? null,
          });
          // #endregion
          if (session?.user) {
            const profile = await fetchProfileWithRetry(session.user.id);
            // #region debug-point AGR:login-after-profile
            reportAuthDebug('AGR', 'authStore:login:afterProfile', '[DEBUG] login after profile', {
              email,
              userId: session.user.id,
              hasProfile: Boolean(profile),
            });
            // #endregion
            set({ user: profile, isAuthenticated: true });
          }
          return { error: null };
        } catch (error) {
          // #region debug-point AGR:login-catch
          reportAuthDebug('AGR', 'authStore:login:catch', '[DEBUG] login catch', {
            email,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          // #endregion
          if (isRecoverableAuthError(error)) {
            await recoverBrokenAuthState('loginWithEmail', error);
          }
          return { error: error as Error };
        }
      },

      // 注册
      registerWithEmail: async (email: string, password: string, nickname: string) => {
        try {
          // #region debug-point AGR:register-start
          reportAuthDebug('AGR', 'authStore:register:start', '[DEBUG] register start', {
            email,
            nickname,
          });
          // #endregion
          // 1. 注册账号
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: getAppPublicUrl(),
            }
          });
          if (error) throw error;
          // #region debug-point AGR:register-after-signup
          reportAuthDebug('AGR', 'authStore:register:afterSignUp', '[DEBUG] register after signUp', {
            email,
            hasUser: Boolean(data.user),
            hasSession: Boolean(data.session),
            userId: data.user?.id ?? null,
          });
          // #endregion
          
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
              .upsert(profileData);
            // #region debug-point AGR:register-after-profile-upsert
            reportAuthDebug('AGR', 'authStore:register:afterProfileUpsert', '[DEBUG] register after profile upsert', {
              email,
              userId: data.user.id,
              profileError: profileError?.message ?? null,
            });
            // #endregion
              
            if (profileError) {
              console.error('Profile creation error:', profileError);
              // 但用户已经注册成功，我们依然返回 null
            }
          }

          if (data.session?.user) {
            const profile = await fetchProfileWithRetry(data.session.user.id);
            // #region debug-point AGR:register-after-profile-fetch
            reportAuthDebug('AGR', 'authStore:register:afterProfileFetch', '[DEBUG] register after profile fetch', {
              email,
              userId: data.session.user.id,
              hasProfile: Boolean(profile),
            });
            // #endregion
            set({ user: profile, isAuthenticated: true });
          }
          
          return { error: null, needsEmailConfirmation };
        } catch (error) {
          // #region debug-point AGR:register-catch
          reportAuthDebug('AGR', 'authStore:register:catch', '[DEBUG] register catch', {
            email,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          // #endregion
          if (isRecoverableAuthError(error)) {
            await recoverBrokenAuthState('registerWithEmail', error);
          }
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
      partialize: () => ({}),
    }
  )
);
