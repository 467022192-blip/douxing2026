import { useState, useEffect, useRef, useCallback } from 'react';
import { searchAttractions } from '../services/supabaseService';
import type { Attraction } from '../types';
import { getLocalCache, setLocalCache } from '../utils/localCache';

const RECOMMENDED_CACHE_KEY = 'attractions:recommended:v2';
const RECOMMENDED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
      const result = await searchAttractions(keyword, filterIds, province);
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
