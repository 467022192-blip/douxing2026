import { useState, useEffect } from 'react';
import { searchAttractions } from '../services/supabaseService';
import type { Attraction } from '../types';

export function useAttractionSearch(keyword: string, filterIds?: string[], province?: string) {
  const [data, setData] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(false);

  const filterIdsStr = filterIds ? filterIds.join(',') : null;

  useEffect(() => {
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchAttractions(keyword, filterIds, province);
        setData(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [keyword, filterIdsStr, province]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading };
}
