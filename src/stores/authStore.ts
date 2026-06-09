import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';
import type { Database } from '../types/supabase';
import { env, getAppPublicUrl } from '../config/env';

const reportAuthDebug = (hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) => {
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'prod-supabase-auth',
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
};

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
  // #region debug-point E:recover:start
  reportAuthDebug('E', 'authStore:recoverBrokenAuthState:start', '[DEBUG] auth recovery start', {
    reason,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorName: error instanceof Error ? error.name : null,
    hasStoredAuthToken: !!getAuthStorageValue(),
  });
  // #endregion
  clearAuthStorage();
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  // #region debug-point E:recover:done
  reportAuthDebug('E', 'authStore:recoverBrokenAuthState:done', '[DEBUG] auth recovery finished', {
    reason,
    signOutErrorMessage: signOutError?.message ?? null,
    signOutErrorName: signOutError?.name ?? null,
    hasStoredAuthToken: !!getAuthStorageValue(),
  });
  // #endregion
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
          // #region debug-point E:init-auth:start
          reportAuthDebug('E', 'authStore:initAuth:start', '[DEBUG] initAuth start', {
            hasStoredAuthToken: !!getAuthStorageValue(),
          });
          // #endregion
          const { data: { session }, error } = await withAuthTimeout(
            supabase.auth.getSession(),
            AUTH_RECOVERY_TIMEOUT_MS,
            'Auth recovery timeout: getSession stalled'
          );
          
          // #region debug-point E:init-auth:after-session
          reportAuthDebug('E', 'authStore:initAuth:after-session', '[DEBUG] initAuth after getSession', {
            hasSession: !!session,
            sessionUserId: session?.user?.id ?? null,
            errorMessage: error?.message ?? null,
            errorName: error?.name ?? null,
            errorStatus: (error as { status?: number } | null)?.status ?? null,
          });
          // #endregion
          if (error) throw error;
          
          if (session?.user) {
            const profile = await fetchProfileWithRetry(session.user.id);
              
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
            // #region debug-point E:init-auth:on-auth-change
            reportAuthDebug('E', 'authStore:initAuth:onAuthStateChange', '[DEBUG] auth state changed', {
              event: _event,
              hasSession: !!session,
              sessionUserId: session?.user?.id ?? null,
            });
            // #endregion
            if (session?.user) {
              const profile = await fetchProfileWithRetry(session.user.id);
                
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
          // #region debug-point E:init-auth:catch
          reportAuthDebug('E', 'authStore:initAuth:catch', '[DEBUG] initAuth failed', {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : null,
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
          // #region debug-point E:login:start
          reportAuthDebug('E', 'authStore:loginWithEmail:start', '[DEBUG] loginWithEmail start', {
            emailDomain: email.includes('@') ? email.split('@')[1] : null,
            passwordLength: password.length,
          });
          // #endregion
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          // #region debug-point E:login:after-signin
          reportAuthDebug('E', 'authStore:loginWithEmail:afterSignIn', '[DEBUG] loginWithEmail after signIn', {
            errorMessage: error?.message ?? null,
            errorName: error?.name ?? null,
            errorStatus: (error as { status?: number } | null)?.status ?? null,
          });
          // #endregion
          if (error) throw error;

          const { data: { session } } = await supabase.auth.getSession();
          // #region debug-point E:login:after-session
          reportAuthDebug('E', 'authStore:loginWithEmail:afterSession', '[DEBUG] loginWithEmail after getSession', {
            hasSession: !!session,
            sessionUserId: session?.user?.id ?? null,
          });
          // #endregion
          if (session?.user) {
            const profile = await fetchProfileWithRetry(session.user.id);
            set({ user: profile, isAuthenticated: true });
          }
          return { error: null };
        } catch (error) {
          // #region debug-point E:login:catch
          reportAuthDebug('E', 'authStore:loginWithEmail:catch', '[DEBUG] loginWithEmail failed', {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : null,
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
          // 1. 注册账号
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: getAppPublicUrl(),
            }
          });
          
          // #region debug-point C:register:after-signup
          reportAuthDebug('C', 'authStore:registerWithEmail:afterSignUp', '[DEBUG] registerWithEmail after signUp', {
            emailDomain: email.includes('@') ? email.split('@')[1] : null,
            hasSession: !!data.session,
            hasUser: !!data.user,
            errorMessage: error?.message ?? null,
            errorName: error?.name ?? null,
            redirectTo: getAppPublicUrl(),
          });
          // #endregion
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
              .upsert(profileData);
              
            if (profileError) {
              console.error('Profile creation error:', profileError);
              // 但用户已经注册成功，我们依然返回 null
            }
          }

          if (data.session?.user) {
            const profile = await fetchProfileWithRetry(data.session.user.id);
            set({ user: profile, isAuthenticated: true });
          }
          
          return { error: null, needsEmailConfirmation };
        } catch (error) {
          // #region debug-point C:register:catch
          reportAuthDebug('C', 'authStore:registerWithEmail:catch', '[DEBUG] registerWithEmail failed', {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : null,
            redirectTo: getAppPublicUrl(),
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
        // #region debug-point E:logout:start
        reportAuthDebug('E', 'authStore:logout:start', '[DEBUG] logout start', {
          isAuthenticated: get().isAuthenticated,
          userId: get().user?.id ?? null,
        });
        // #endregion
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
