import { createClient } from '@supabase/supabase-js';

type AttractionCandidate = {
  id: string;
  name: string;
  province: string;
  city: string;
};

const normalizeName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[·•\s（）()\-_,，。]/g, '')
    .replace(/(风景名胜区|风景区|旅游区|度假区|景区|景点|公园|古城|博物馆|遗址|海滩|沙滩)$/g, '');

const json = (res: any, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const getQueryValue = (value: unknown) => {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
};

const scoreCandidate = (
  requested: { name: string; city?: string; province?: string },
  candidate: AttractionCandidate
) => {
  const requestedName = normalizeName(requested.name);
  const candidateName = normalizeName(candidate.name);
  if (!requestedName || !candidateName) return 0;

  let score = 0;
  if (requestedName === candidateName) score += 100;
  else if (candidateName.includes(requestedName) || requestedName.includes(candidateName)) score += 78;

  const requestedCity = normalizeName(requested.city || '');
  const requestedProvince = normalizeName(requested.province || '');
  if (requestedCity && normalizeName(candidate.city) === requestedCity) score += 12;
  if (requestedProvince && normalizeName(candidate.province) === requestedProvince) score += 8;

  return score;
};

const findBestCandidate = (
  requested: { name: string; city?: string; province?: string },
  candidates: AttractionCandidate[]
) => {
  let best: AttractionCandidate | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = scoreCandidate(requested, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best || bestScore < 78) return null;
  return { ...best, score: bestScore };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '');
  const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(res, 503, { error: 'Supabase 服务暂未配置，无法加载景区详情。' });
  }

  const name = getQueryValue(req.query?.name).trim();
  const city = getQueryValue(req.query?.city).trim();
  const province = getQueryValue(req.query?.province).trim();
  if (!name) {
    return json(res, 400, { error: '缺少景点名称。' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const exactResponse = await supabase
      .from('attractions')
      .select('id,name,province,city')
      .eq('name', name)
      .limit(8);

    let candidates = (exactResponse.data || []) as AttractionCandidate[];
    if (exactResponse.error) {
      throw new Error(`景区详情查询失败：${exactResponse.error.message}`);
    }

    if (candidates.length === 0) {
      const fuzzyResponse = await supabase
        .from('attractions')
        .select('id,name,province,city')
        .ilike('name', `%${name}%`)
        .limit(20);

      if (fuzzyResponse.error) {
        throw new Error(`景区详情查询失败：${fuzzyResponse.error.message}`);
      }

      candidates = (fuzzyResponse.data || []) as AttractionCandidate[];
    }

    const best = findBestCandidate({ name, city, province }, candidates);
    if (!best) {
      return json(res, 404, { error: '暂未匹配到景区详情。' });
    }

    return json(res, 200, {
      id: best.id,
      name: best.name,
      city: best.city,
      province: best.province,
      score: best.score,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '景区详情加载失败';
    return json(res, 500, { error: message });
  }
}
