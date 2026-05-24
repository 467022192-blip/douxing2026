import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4o-mini';

// 1. 抓取百度百科摘要
async function getBaiduBaike(title) {
  try {
    const url = `https://baike.baidu.com/item/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    let summary = '';
    
    // 尝试不同的百度百科摘要 class
    $('.lemma-summary').each((i, el) => { summary += $(el).text(); });
    if (!summary) {
        $('.summary-content').each((i, el) => { summary += $(el).text(); });
    }
    if (!summary) {
        $('.J-summary').each((i, el) => { summary += $(el).text(); });
    }
    if (!summary) {
      summary = $('meta[name="description"]').attr('content') || '';
    }
    
    // 清理空格和换行
    return summary.replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.error(`Error fetching Baike for ${title}:`, e.message);
    return null;
  }
}

async function getWikipediaExtract(title) {
  try {
    const encodedTitle = encodeURIComponent(title);
    // 使用 zh-cn variant 获取简体中文
    const url = `https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&exchars=800&explaintext=1&redirects=1&titles=${encodedTitle}&format=json&variant=zh-cn`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TraeBot/1.0', 'Accept-Language': 'zh-CN,zh;q=0.9' } });
    const data = await res.json();
    const pages = data.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId !== '-1' && pages[pageId].extract) {
        let extract = pages[pageId].extract;
        return extract.replace(/\s+/g, ' ').trim();
      }
    }
  } catch (err) {
    // console.error(`Failed to fetch Wikipedia for ${title}:`, err.message);
  }
  return null;
}

// 2. 调用大模型进行摘要生成
async function summarizeWithLLM(text, attractionName) {
  if (!OPENAI_API_KEY) {
    return ruleBasedSummarize(text, attractionName);
  }

  const prompt = `你是一个专业的旅游编辑。请将以下景区的简介精简至200字左右。
要求：
1. 重点介绍景区的核心特色、历史文化或自然风光。
2. 减少或去除关于省、市、县等过多的通用地理位置说明。
3. 去除无意义的评级说明（如AAAAA级）或冗长的行政审批信息。
4. 语言优美，保持语句通顺，直接输出精简后的内容，不要输出任何额外的解释或开头语。

景区名称：${attractionName}
原文简介：
${text}`;

  try {
    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 400
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`LLM API Error: ${res.status} ${errorText}`);
      return ruleBasedSummarize(text, attractionName); // Fallback
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch (e) {
    console.warn(`LLM API Request Failed: ${e.message}`);
    return ruleBasedSummarize(text, attractionName); // Fallback
  }
}

// 3. 基于规则的摘要算法 (兜底方案)
function ruleBasedSummarize(text, attractionName) {
  if (!text) return '';
  let cleaned = text;
  
  // 移除开头长串的地理位置说明 (例如: 位于xx省xx市xx县)
  cleaned = cleaned.replace(/(?:位于|地处|坐落于)[^，。]*?(?:省|市|自治区|自治州|县|区|镇|村)[^，。]*?[，。]/g, '');
  
  // 移除等级说明 (例如: 是国家AAAAA级旅游景区)
  cleaned = cleaned.replace(/(?:是|为)[^，。]*?(?:AAAAA|AAAA|AAA|AA|A)级[^，。]*?[，。]/g, '');
  cleaned = cleaned.replace(/(?:是|为)[^，。]*?重点文物保护单位[^，。]*?[，。]/g, '');
  
  // 提取前200字，并保证句子完整
  if (cleaned.length <= 220) return cleaned;
  
  const sentences = cleaned.match(/[^。！？]+[。！？]/g) || [cleaned];
  let result = '';
  for (const sentence of sentences) {
    if ((result.length + sentence.length) > 220) {
      break;
    }
    result += sentence;
  }
  
  return result || cleaned.substring(0, 200) + '...';
}

async function run() {
  console.log('Fetching attractions from Supabase...');
  const { data: attractions, error } = await supabase.from('attractions').select('id, name, tips').order('id', { ascending: true });
  
  if (error) {
    console.error('Error fetching attractions:', error);
    return;
  }

  console.log(`Found ${attractions.length} attractions. Starting Baidu Baike extraction and summarization...`);
  if (!OPENAI_API_KEY) {
    console.log('⚠️ 未检测到 OPENAI_API_KEY 环境变量，将使用基于规则的文本精简算法进行兜底。如需使用 AI 模型，请在 .env.local 中配置 OPENAI_API_KEY。');
  } else {
    console.log('✅ 检测到 OPENAI_API_KEY，将使用大模型算法进行文本精简。');
  }

  // 为了不触发 API 限流，限制并发度为 1
  const concurrency = 1;
  let activePromises = [];
  let completed = 0;
  let updatedCount = 0;

  for (const attraction of attractions) {
    try {
      let baikeText = await getBaiduBaike(attraction.name);
      
      // 如果全名查不到，尝试去掉“景区”等后缀再查
      let cleanName = attraction.name.replace(/(景区|旅游区|风景名胜区|旅游度假区|公园|遗址|风景区)/g, '');
      if (!baikeText || baikeText.length < 50) {
          if (cleanName !== attraction.name && cleanName.length >= 2) {
            baikeText = await getBaiduBaike(cleanName);
          }
      }

      // 如果百度百科依然查不到，回退到维基百科（简体中文）
      if (!baikeText || baikeText.length < 50) {
        baikeText = await getWikipediaExtract(attraction.name);
        if (!baikeText || baikeText.length < 50) {
          if (cleanName !== attraction.name && cleanName.length >= 2) {
            baikeText = await getWikipediaExtract(cleanName);
          }
        }
      }

      if (baikeText && baikeText.length > 50) {
        const summarizedText = await summarizeWithLLM(baikeText, attraction.name);
        
        if (summarizedText && summarizedText.length > 0) {
          await supabase.from('attractions').update({
            tips: summarizedText
          }).eq('id', attraction.id);
          updatedCount++;
        }
      }
    } catch (err) {
      console.error(`Failed to process ${attraction.name}:`, err.message);
    } finally {
      completed++;
      if (completed % 20 === 0) {
        console.log(`Processed ${completed}/${attractions.length} attractions`);
      }
    }
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n🎉 Process completed! Successfully updated ${updatedCount} attractions with Baike summaries.`);
}

run();