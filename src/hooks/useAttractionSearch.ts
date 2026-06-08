import { useState, useEffect, useRef, useCallback } from 'react';
import { searchAttractions } from '../services/supabaseService';
import type { Attraction } from '../types';
import { MOCK_ATTRACTIONS } from '../data/mockAttractions';
import { getLocalCache, setLocalCache } from '../utils/localCache';

const RECOMMENDED_CACHE_KEY = 'attractions:recommended:v2';
const RECOMMENDED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 10000;

const getFallbackAttractions = (keyword: string, filterIds?: string[], province?: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const normalizedProvince = province && province !== '全部' ? province : '';

  return MOCK_ATTRACTIONS.filter((attraction) => {
    if (filterIds && !filterIds.includes(attraction.id)) return false;
    if (normalizedProvince && !attraction.province.startsWith(normalizedProvince)) return false;
    if (!normalizedKeyword) return true;

    return [attraction.name, attraction.city, attraction.province, attraction.address]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedKeyword));
  });
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('景区数据请求超时，请检查 Supabase 网络、项目域名或 RLS 配置'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export function useAttractionSearch(keyword: string, filterIds?: string[], province?: string) {
  const [data, setData] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const requestSeqRef = useRef(0);

  const filterIdsStr = filterIds ? filterIds.join(',') : null;

  const isRecommendedMode = !keyword.trim() && !filterIds && (!province || province === '全部');

  useEffect(() => {
    if (!isRecommendedMode) {
      setFromCache(false);
      return;
    }

    const cached = getLocalCache<Attraction[]>(RECOMMENDED_CACHE_KEY);
    if (cached && cached.length > 0) {
      setFromCache(true);
      setData(cached);
    }
  }, [isRecommendedMode]);

  const runSearch = useCallback(async () => {
    if (filterIds && filterIds.length === 0) {
      requestSeqRef.current += 1;
      setLoading(false);
      setError(null);
      setFromCache(false);
      setData([]);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await withTimeout(searchAttractions(keyword, filterIds, province), SEARCH_TIMEOUT_MS);
      if (seq === requestSeqRef.current) {
        setData(result);
        if (isRecommendedMode) {
          setFromCache(false);
          setLocalCache(RECOMMENDED_CACHE_KEY, result, RECOMMENDED_CACHE_TTL_MS);
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (seq === requestSeqRef.current) {
        setError(err);
        const fallback = getFallbackAttractions(keyword, filterIds, province);
        setData(fallback);
        if (isRecommendedMode && fallback.length > 0) {
          setFromCache(true);
        }
      }
      console.error(err);
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [filterIds, isRecommendedMode, keyword, province]);

  useEffect(() => {
    const handler = setTimeout(() => {
      void runSearch();
    }, 300);

    return () => clearTimeout(handler);
  }, [keyword, filterIdsStr, province, runSearch]);

  return { data, loading, error, fromCache, refetch: runSearch };
}
