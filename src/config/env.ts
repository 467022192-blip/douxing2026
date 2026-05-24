type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  baiduMapAk: string;
  sentryDsn: string;
  appPublicUrl: string;
  isDev: boolean;
  isProd: boolean;
};

const getString = (value: unknown) => (typeof value === 'string' ? value : '');

const normalizeSupabaseUrl = (raw: string) => {
  let url = raw.trim();
  if (!url) return '';
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1\/?$/, '');
  return url;
};

export const env: AppEnv = {
  supabaseUrl: normalizeSupabaseUrl(getString(import.meta.env.VITE_SUPABASE_URL)),
  supabaseAnonKey: getString(import.meta.env.VITE_SUPABASE_ANON_KEY),
  baiduMapAk: getString(import.meta.env.VITE_BAIDU_MAP_AK),
  sentryDsn: getString(import.meta.env.VITE_SENTRY_DSN),
  appPublicUrl: getString(import.meta.env.VITE_APP_PUBLIC_URL),
  isDev: Boolean(import.meta.env.DEV),
  isProd: Boolean(import.meta.env.PROD)
};

export const getAppPublicUrl = () => {
  if (env.appPublicUrl) return env.appPublicUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

export const getMissingCriticalEnv = () => {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!env.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!env.baiduMapAk) missing.push('VITE_BAIDU_MAP_AK');
  return missing;
};
