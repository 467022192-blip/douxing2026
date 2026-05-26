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

const looksLikeBaiduAk = (v: string) => /^[A-Za-z0-9]{32}$/.test(v.trim());

const appPublicUrlRaw = getString(import.meta.env.VITE_APP_PUBLIC_URL).trim();
const baiduMapAkRaw = getString(import.meta.env.VITE_BAIDU_MAP_AK).trim();

export const env: AppEnv = {
  supabaseUrl: normalizeSupabaseUrl(getString(import.meta.env.VITE_SUPABASE_URL)),
  supabaseAnonKey: getString(import.meta.env.VITE_SUPABASE_ANON_KEY),
  baiduMapAk: baiduMapAkRaw || (looksLikeBaiduAk(appPublicUrlRaw) ? appPublicUrlRaw : ''),
  sentryDsn: getString(import.meta.env.VITE_SENTRY_DSN),
  appPublicUrl: looksLikeBaiduAk(appPublicUrlRaw) ? '' : appPublicUrlRaw,
  isDev: Boolean(import.meta.env.DEV),
  isProd: Boolean(import.meta.env.PROD)
};

export const getAppPublicUrl = () => {
  if (env.appPublicUrl) return env.appPublicUrl;
  if (typeof window !== 'undefined') {
    const baseUrl = getString(import.meta.env.BASE_URL) || '/';
    const url = new URL(baseUrl, window.location.origin).toString();
    return url.replace(/\/+$/, '');
  }
  return '';
};

export const getMissingCriticalEnv = () => {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!env.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!env.baiduMapAk) missing.push('VITE_BAIDU_MAP_AK');
  return missing;
};
