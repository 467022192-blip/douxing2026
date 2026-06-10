type LlmAttraction = {
  name?: string;
  summary?: string;
  city?: string;
  province?: string;
};

type LlmDay = {
  day?: number;
  title?: string;
  summary?: string;
  attractions?: LlmAttraction[];
};

type LlmOption = {
  title?: string;
  reason?: string;
  destination?: string;
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
    ? isVeryLongTrip
      ? 3200
      : isLongTrip
        ? 2400
        : Math.min(2200, Math.max(1600, 1200 + requestedDays * 120))
    : 1800;
  const temperature = isVeryLongTrip ? 0.2 : isLongTrip ? 0.35 : 0.7;
  const retryMaxTokens = isVeryLongTrip ? 3600 : Math.min(3200, maxTokens + 400);

  return {
    requestedDays,
    isLongTrip,
    isVeryLongTrip,
    maxTokens,
    retryMaxTokens,
    temperature,
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
11. ${config.isLongTrip ? '长行程时请保持紧凑：每天只放 1 个核心景点，summary 控制在 8-14 个字。' : '每一天可以安排 1-2 个核心景点。'}
12. ${config.isVeryLongTrip ? '当天数 >= 10 时，必须优先保证 10 天都完整返回；title、reason、day.title 都尽量短，不要写城市介绍。' : '不要省略任何一天。'}
13. ${config.isVeryLongTrip ? 'city、province 仅在确有必要时填写，不要每个景点都重复填写。' : 'city、province 可按需填写。'}

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
6. 每个方案都必须包含 title、reason、days。
7. 每个 day 都必须包含 day、title、attractions；attractions 内每项都必须是对象，至少包含 name，可选 summary、city、province。
8. 如果用户明确提到了天数，3 个方案里的 days 数量都必须与天数一致。
9. ${config.isLongTrip ? '这是长行程，请每天只保留 1 个最核心景点，summary 极简，不要写长句。' : '每天请保留 1-2 个核心景点。'}
10. 不要让任何一个方案出现空 days，也不要让任何一天出现空 attractions，不要把 attractions 写成字符串数组。

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

const normalizeAttractionItem = (item: unknown, daySummary?: string): LlmAttraction | null => {
  if (typeof item === 'string') {
    const name = item.trim();
    return name ? { name, summary: daySummary?.trim() || '' } : null;
  }

  if (!item || typeof item !== 'object') return null;

  const candidate = item as Record<string, unknown>;
  const name =
    (typeof candidate.name === 'string' && candidate.name.trim()) ||
    (typeof candidate.attraction === 'string' && candidate.attraction.trim()) ||
    (typeof candidate.spot === 'string' && candidate.spot.trim()) ||
    '';

  if (!name) return null;

  return {
    name,
    summary: typeof candidate.summary === 'string' ? candidate.summary : daySummary,
    city: typeof candidate.city === 'string' ? candidate.city : '',
    province: typeof candidate.province === 'string' ? candidate.province : '',
  };
};

const buildMappedOptions = (parsed: { options: LlmOption[] }) =>
  parsed.options.map((option, optionIndex) => ({
    id: `plan-${optionIndex + 1}`,
    title: option.title?.trim() || option.destination?.trim() || `推荐方案 ${optionIndex + 1}`,
    reason: option.reason?.trim() || '结合你的需求做了节奏、景观和人群偏好的平衡。',
    days: Array.isArray(option.days)
      ? option.days
          .filter((day) => Array.isArray(day.attractions) && day.attractions.length > 0)
          .map((day, dayIndex) => ({
            day: Number.isFinite(day.day) ? Number(day.day) : dayIndex + 1,
            title: day.title?.trim() || `第 ${dayIndex + 1} 天`,
            attractions: (day.attractions || [])
              .map((item) => normalizeAttractionItem(item, day.summary))
              .filter((item): item is LlmAttraction => Boolean(item))
              .map((item) => ({
                name: item.name!.trim(),
                summary: item.summary?.trim() || '',
                city: item.city?.trim() || '',
                province: item.province?.trim() || ''
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

  if (!openAiBaseUrl || !openAiApiKey || !modelName) {
    return json(res, 503, { error: 'AI 服务暂未配置，请补充 OPENAI_BASE_URL、OPENAI_API_KEY、MODEL_NAME。' });
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
      generationConfig.temperature,
      generationConfig.maxTokens
    );
    modelMs += firstCompletion.durationMs;
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
        generationConfig.retryMaxTokens
      );
      modelMs += retryCompletion.durationMs;
      parsed = parseContent(retryCompletion.content);
    }

    let options = buildMappedOptions(parsed);

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
        generationConfig.retryMaxTokens
      );
      modelMs += structureRetry.durationMs;
      parsed = parseContent(structureRetry.content);
      options = buildMappedOptions(parsed);

      if (
        hasIncompleteStructure(options) ||
        hasRequestedDayCountMismatch(options, generationConfig.requestedDays)
      ) {
        return json(res, 502, { error: 'AI 返回的行程结构不完整，请重试一次。' });
      }
    }

    const matchMs = 0;
    const totalMs = Date.now() - totalStart;

    console.info('[guide-ai-trip-plans]', {
      totalMs,
      modelMs,
      matchMs
    });

    return json(res, 200, {
      options,
      provider: 'volcengine-ark',
      generatedAt: new Date().toISOString(),
      meta: {
        totalMs,
        modelMs,
        matchMs,
        cacheHit: false,
        retried
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 行程规划失败';
    return json(res, 500, { error: message });
  }
}
