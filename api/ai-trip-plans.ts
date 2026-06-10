import { createClient } from '@supabase/supabase-js';

type AttractionRow = {
  id: string;
  name: string;
  province: string;
  city: string;
  address: string | null;
};

type LlmAttraction = {
  name?: string;
  summary?: string;
  city?: string;
  province?: string;
};

type LlmDay = {
  day?: number;
  title?: string;
  attractions?: LlmAttraction[];
};

type LlmOption = {
  title?: string;
  reason?: string;
  days?: LlmDay[];
};

type OpenAiResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
};

type AttractionCache = {
  data: AttractionRow[];
  expiresAt: number;
};

const ATTRACTION_CACHE_TTL_MS = 10 * 60 * 1000;
let attractionCache: AttractionCache | null = null;

const normalizeName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[·•\s（）()\-_,，。]/g, '')
    .replace(/(风景名胜区|风景区|旅游区|度假区|景区|景点|公园|古城|博物馆|遗址|海滩|沙滩)$/g, '');

const normalizeResponseText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
};

const extractJsonCandidate = (text: string) => {
  const normalized = normalizeResponseText(text).replace(/^\uFEFF/, '').trim();
  const firstBraceIndex = normalized.indexOf('{');
  const lastBraceIndex = normalized.lastIndexOf('}');
  if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
    return normalized.slice(firstBraceIndex, lastBraceIndex + 1);
  }
  return normalized;
};

const escapeJsonString = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');

const sanitizeLooseJson = (text: string) =>
  text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(\s*:)/g, (_match, prefix, key, suffix) => {
      const normalizedKey = String(key).replace(/\\'/g, "'");
      return `${prefix}"${escapeJsonString(normalizedKey)}"${suffix}`;
    })
    .replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value) => {
      const normalizedValue = String(value).replace(/\\'/g, "'");
      return `: "${escapeJsonString(normalizedValue)}"`;
    })
    .replace(/,\s*([}\]])/g, '$1')
    .trim();

const extractRequestedDays = (query: string) => {
  const match = query.match(/(\d{1,2})\s*(?:天|日)(?:\s*\d{0,2}\s*夜)?/);
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
};

const getGenerationConfig = (query: string) => {
  const requestedDays = extractRequestedDays(query);
  const isLongTrip = (requestedDays ?? 0) >= 7;
  const isVeryLongTrip = (requestedDays ?? 0) >= 10;
  const maxTokens = requestedDays
    ? Math.min(4200, Math.max(1800, 1400 + requestedDays * 190))
    : 1800;

  return {
    requestedDays,
    isLongTrip,
    isVeryLongTrip,
    maxTokens,
  };
};

const buildPrompt = (query: string, config: ReturnType<typeof getGenerationConfig>) => `
你是一个中文旅行规划助手。请根据用户需求输出 3 个不同风格的景点行程方案。

要求：
1. 只输出 JSON，不要输出任何额外说明。
2. 必须返回 3 个方案，字段名固定为 options。
3. 每个方案必须包含 title、reason、days。
4. days 必须是数组；每一项包含 day、title、attractions。
5. attractions 必须是数组；每项包含 name、summary，可选 city、province。
6. 只推荐景点，不要输出酒店、餐厅、购物、注意事项。
7. 风格要有差异，例如“轻松亲子”“经典海边”“自然风景”。
8. 用户没有明确城市时可以合理假设，但不要编造过度细节。
9. title 保持简洁，reason 控制在一两句话内。
10. 如果用户明确提到了天数，days 的数量必须与天数一致。
11. ${config.isLongTrip ? '长行程时请保持紧凑：每天只放 1-2 个核心景点，summary 一句话即可。' : '每一天可以安排 1-2 个核心景点。'}
12. ${config.isVeryLongTrip ? '当天数 >= 10 时，优先保证每天都有内容，不要省略后半程。' : '不要省略任何一天。'}

JSON 示例：
{
  "options": [
    {
      "title": "轻松亲子海边线",
      "reason": "节奏更慢，海边活动更多，适合带 6 岁小孩。",
      "days": [
        {
          "day": 1,
          "title": "抵达与轻松看海",
          "attractions": [
            {
              "name": "鼓浪屿",
              "summary": "步行体验友好，适合家庭轻松逛岛。",
              "city": "厦门",
              "province": "福建"
            }
          ]
        }
      ]
    }
  ]
}

用户需求：${query}
`;

const buildRetryPrompt = (query: string, config: ReturnType<typeof getGenerationConfig>) => `
你上一次返回的内容不是严格合法 JSON。请重新输出，并且严格遵守以下规则：
1. 只输出一个合法 JSON 对象，不要输出任何解释、标题、注释或 Markdown 代码块。
2. 所有字段名必须使用双引号。
3. 所有字符串必须使用双引号。
4. 不能出现尾逗号。
5. 顶层结构必须是 {"options":[...]}，并且 options 恰好返回 3 个方案。
6. 如果用户明确提到了天数，3 个方案里的 days 数量都必须与天数一致。
7. ${config.isLongTrip ? '这是长行程，请每天只保留 1 个最核心景点或 1-2 个高度相关景点，summary 极简。' : '每天请保留 1-2 个核心景点。'}
8. 不要让任何一个方案出现空 days，也不要让任何一天出现空 attractions。

用户需求：${query}
`;

const validateParsedOptions = (parsed: { options?: LlmOption[] }) => {
  if (!Array.isArray(parsed.options) || parsed.options.length < 3) {
    throw new Error('模型返回的方案数量不足 3 个');
  }
  return { options: parsed.options.slice(0, 3) };
};

const parseContent = (content: string): { options: LlmOption[] } => {
  const candidate = extractJsonCandidate(content);
  const attempts = [candidate, sanitizeLooseJson(candidate)].filter(Boolean);
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as { options?: LlmOption[] };
      return validateParsedOptions(parsed);
    } catch (error) {
      lastError = error;
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : '未知解析错误';
  throw new Error(`AI 返回的 JSON 格式不合法：${errorMessage}`);
};

const isRetryableJsonParseError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('json') ||
    message.includes('unexpected token') ||
    message.includes('double-quoted property name') ||
    message.includes('unterminated string') ||
    message.includes('bad control character')
  );
};

const buildMappedOptions = (parsed: { options: LlmOption[] }, attractions: AttractionRow[]) =>
  parsed.options.map((option, optionIndex) => ({
    id: `plan-${optionIndex + 1}`,
    title: option.title?.trim() || `推荐方案 ${optionIndex + 1}`,
    reason: option.reason?.trim() || '结合你的需求做了节奏、景观和人群偏好的平衡。',
    days: Array.isArray(option.days)
      ? option.days
          .filter((day) => Array.isArray(day.attractions) && day.attractions.length > 0)
          .map((day, dayIndex) => ({
            day: Number.isFinite(day.day) ? Number(day.day) : dayIndex + 1,
            title: day.title?.trim() || `第 ${dayIndex + 1} 天`,
            attractions: (day.attractions || [])
              .filter((item) => item?.name && item.name.trim())
              .map((item) => ({
                name: item.name!.trim(),
                summary: item.summary?.trim() || '',
                city: item.city?.trim() || '',
                province: item.province?.trim() || '',
                ...matchAttraction(item, attractions)
              }))
          }))
          .filter((day) => day.attractions.length > 0)
      : []
  }));

const hasIncompleteStructure = (options: Array<{ days: Array<{ attractions: Array<unknown> }> }>) =>
  options.some((option) => option.days.length === 0 || option.days.some((day) => day.attractions.length === 0));

const hasRequestedDayCountMismatch = (
  options: Array<{ days: Array<unknown> }>,
  requestedDays: number | null
) => {
  if (!requestedDays) return false;
  return options.some((option) => option.days.length !== requestedDays);
};

const getAttractionsForMatching = async (supabaseUrl: string, supabaseAnonKey: string) => {
  const now = Date.now();
  if (attractionCache && attractionCache.expiresAt > now) {
    return {
      data: attractionCache.data,
      cacheHit: true
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from('attractions')
    .select('id,name,province,city,address')
    .limit(3000);

  if (error) {
    throw new Error(`景区数据读取失败：${error.message}`);
  }

  attractionCache = {
    data: (data || []) as AttractionRow[],
    expiresAt: now + ATTRACTION_CACHE_TTL_MS
  };

  return {
    data: attractionCache.data,
    cacheHit: false
  };
};

const scoreAttractionMatch = (item: LlmAttraction, attraction: AttractionRow) => {
  const itemName = normalizeName(item.name || '');
  const attractionName = normalizeName(attraction.name);
  if (!itemName || !attractionName) return 0;

  let score = 0;
  if (itemName === attractionName) score += 90;
  else if (attractionName.includes(itemName) || itemName.includes(attractionName)) score += 70;

  const itemCity = normalizeName(item.city || '');
  const itemProvince = normalizeName(item.province || '');
  if (itemCity && normalizeName(attraction.city) === itemCity) score += 15;
  if (itemProvince && normalizeName(attraction.province) === itemProvince) score += 10;

  return score;
};

const matchAttraction = (item: LlmAttraction, attractions: AttractionRow[]) => {
  let bestMatch: AttractionRow | null = null;
  let bestScore = 0;

  for (const attraction of attractions) {
    const score = scoreAttractionMatch(item, attraction);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = attraction;
    }
  }

  if (!bestMatch || bestScore < 70) return null;
  return {
    matchedAttractionId: bestMatch.id,
    matchedAttractionName: bestMatch.name,
    matchedScore: bestScore
  };
};

const json = (res: any, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const requestCompletion = async (
  openAiBaseUrl: string,
  openAiApiKey: string,
  modelName: string,
  prompt: string,
  temperature: number,
  maxTokens: number
) => {
  const startedAt = Date.now();
  const llmResponse = await fetch(`${openAiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      temperature,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: '你是一个擅长中文家庭旅行和景点行程规划的助手。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!llmResponse.ok) {
    const errorText = await llmResponse.text();
    throw new Error(`AI 服务调用失败：${errorText || llmResponse.statusText}`);
  }

  const completion = (await llmResponse.json()) as OpenAiResponse;
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI 服务未返回有效内容。');
  }

  return {
    content,
    durationMs: Date.now() - startedAt,
    finishReason: completion.choices?.[0]?.finish_reason ?? null,
  };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  const openAiBaseUrl = (process.env.OPENAI_BASE_URL || '').trim().replace(/\/+$/, '');
  const openAiApiKey = (process.env.OPENAI_API_KEY || '').trim();
  const modelName = (process.env.MODEL_NAME || '').trim();
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '');
  const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!openAiBaseUrl || !openAiApiKey || !modelName) {
    return json(res, 503, { error: 'AI 服务暂未配置，请补充 OPENAI_BASE_URL、OPENAI_API_KEY、MODEL_NAME。' });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return json(res, 503, { error: 'Supabase 服务暂未配置，无法完成景点匹配。' });
  }

  let body: { query?: string } = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return json(res, 400, { error: '请求体不是合法 JSON。' });
  }

  const query = (body.query || '').trim();
  if (!query) {
    return json(res, 400, { error: '请先输入你的出行需求。' });
  }

  if (query.length < 8) {
    return json(res, 400, { error: '描述可以再具体一点，例如补充天数、出发地或同行人群。' });
  }

  try {
    const totalStart = Date.now();
    const generationConfig = getGenerationConfig(query);
    let modelMs = 0;
    let retried = false;
    const firstCompletion = await requestCompletion(
      openAiBaseUrl,
      openAiApiKey,
      modelName,
      buildPrompt(query, generationConfig),
      0.7,
      generationConfig.maxTokens
    );
    modelMs += firstCompletion.durationMs;

    const matchStart = Date.now();
    const attractionData = await getAttractionsForMatching(supabaseUrl, supabaseAnonKey);
    let parsed: { options: LlmOption[] };

    try {
      parsed = parseContent(firstCompletion.content);
    } catch (error) {
      if (!isRetryableJsonParseError(error)) {
        throw error;
      }

      retried = true;

      const retryCompletion = await requestCompletion(
        openAiBaseUrl,
        openAiApiKey,
        modelName,
        buildRetryPrompt(query, generationConfig),
        0.2,
        Math.min(4200, generationConfig.maxTokens + 500)
      );
      modelMs += retryCompletion.durationMs;
      parsed = parseContent(retryCompletion.content);
    }

    let options = buildMappedOptions(parsed, attractionData.data);

    if (
      hasIncompleteStructure(options) ||
      hasRequestedDayCountMismatch(options, generationConfig.requestedDays) ||
      firstCompletion.finishReason === 'length'
    ) {
      retried = true;
      const structureRetry = await requestCompletion(
        openAiBaseUrl,
        openAiApiKey,
        modelName,
        buildRetryPrompt(query, generationConfig),
        0.2,
        Math.min(4200, generationConfig.maxTokens + 500)
      );
      modelMs += structureRetry.durationMs;
      parsed = parseContent(structureRetry.content);
      options = buildMappedOptions(parsed, attractionData.data);

      if (
        hasIncompleteStructure(options) ||
        hasRequestedDayCountMismatch(options, generationConfig.requestedDays)
      ) {
        return json(res, 502, { error: 'AI 返回的行程结构不完整，请重试一次。' });
      }
    }

    const matchMs = Date.now() - matchStart;
    const totalMs = Date.now() - totalStart;

    console.info('[guide-ai-trip-plans]', {
      totalMs,
      modelMs,
      matchMs,
      cacheHit: attractionData.cacheHit
    });

    return json(res, 200, {
      options,
      provider: 'volcengine-ark',
      generatedAt: new Date().toISOString(),
      meta: {
        totalMs,
        modelMs,
        matchMs,
        cacheHit: attractionData.cacheHit,
        retried
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 行程规划失败';
    return json(res, 500, { error: message });
  }
}
