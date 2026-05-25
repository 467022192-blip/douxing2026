import { env } from '../config/env';

declare global {
  interface Window {
    __baiduMapLoadPromise?: Promise<void>;
  }
}

const SDK_ID = 'baidu-map-sdk';

export const loadBaiduMap = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.BMap) return Promise.resolve();
  if (window.__baiduMapLoadPromise) return window.__baiduMapLoadPromise;

  const ak = env.baiduMapAk;
  if (!ak) {
    window.__baiduMapLoadPromise = Promise.reject(new Error('Missing VITE_BAIDU_MAP_AK'));
    return window.__baiduMapLoadPromise;
  }

  window.__baiduMapLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Baidu Map script load failed')), { once: true });
      return;
    }

    const callbackName = `__initBMap_${Math.random().toString(16).slice(2)}`;
    const w = window as unknown as Record<string, unknown>;

    w[callbackName] = () => {
      try {
        resolve();
      } finally {
        try {
          delete w[callbackName];
        } catch {
          w[callbackName] = undefined;
        }
      }
    };

    const script = document.createElement('script');
    script.id = SDK_ID;
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(ak)}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      try {
        delete w[callbackName];
      } catch {
        w[callbackName] = undefined;
      }
      reject(new Error('Baidu Map script load failed'));
    };
    document.body.appendChild(script);
  });

  return window.__baiduMapLoadPromise;
};

export const preloadBaiduMapIdle = () => {
  if (typeof window === 'undefined') return;
  if (!env.baiduMapAk) return;
  if (window.BMap || window.__baiduMapLoadPromise) return;

  const run = () => {
    void loadBaiduMap().catch(() => {});
  };

  const ric =
    'requestIdleCallback' in window
      ? (window.requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => number))
      : undefined;

  if (ric) {
    ric(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 1200);
  }
};
