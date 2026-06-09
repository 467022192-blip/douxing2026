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
    message?: {
      content?: string;
    };
  }>;
};

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

const buildPrompt = (query: string) => `
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

const parseContent = (content: string): { options: LlmOption[] } => {
  const normalized = normalizeResponseText(content);
  const parsed = JSON.parse(normalized) as { options?: LlmOption[] };
  if (!Array.isArray(parsed.options) || parsed.options.length < 3) {
    throw new Error('模型返回的方案数量不足 3 个');
  }
  return { options: parsed.options.slice(0, 3) };
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
    const llmResponse = await fetch(`${openAiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.8,
        max_tokens: 2200,
        messages: [
          {
            role: 'system',
            content: '你是一个擅长中文家庭旅行和景点行程规划的助手。'
          },
          {
            role: 'user',
            content: buildPrompt(query)
          }
        ]
      })
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return json(res, 502, { error: `AI 服务调用失败：${errorText || llmResponse.statusText}` });
    }

    const completion = (await llmResponse.json()) as OpenAiResponse;
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return json(res, 502, { error: 'AI 服务未返回有效内容。' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: attractions, error: attractionsError } = await supabase
      .from('attractions')
      .select('id,name,province,city,address')
      .limit(3000);

    if (attractionsError) {
      return json(res, 502, { error: `景区数据读取失败：${attractionsError.message}` });
    }

    const parsed = parseContent(content);

    const options = parsed.options.map((option, optionIndex) => ({
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
                  ...matchAttraction(item, (attractions || []) as AttractionRow[])
                }))
            }))
        : []
    }));

    if (options.some((option) => option.days.length === 0)) {
      return json(res, 502, { error: 'AI 返回的行程结构不完整，请重试一次。' });
    }

    return json(res, 200, {
      options,
      provider: 'volcengine-ark',
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 行程规划失败';
    return json(res, 500, { error: message });
  }
}
