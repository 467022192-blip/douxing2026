type CacheEnvelope<T> = {
  v: number;
  ts: number;
  ttlMs: number;
  data: T;
};

const VERSION = 1;

export const getLocalCache = <T>(key: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== VERSION) return null;
    if (typeof parsed.ts !== 'number' || typeof parsed.ttlMs !== 'number') return null;
    if (Date.now() - parsed.ts > parsed.ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

export const setLocalCache = <T>(key: string, data: T, ttlMs: number) => {
  try {
    const value: CacheEnvelope<T> = { v: VERSION, ts: Date.now(), ttlMs, data };
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

