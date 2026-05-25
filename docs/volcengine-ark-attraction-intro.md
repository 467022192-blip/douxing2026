# 火山方舟（OpenAI 兼容）生成景区简介

本仓库已提供脚本 [fetch_and_summarize_baike.mjs](file:///Users/bytedance/Documents/trae_projects/%E8%B6%B3%E8%BF%B9/scripts/fetch_and_summarize_baike.mjs)，用于：

- 抓取百度百科/维基百科的原始简介
- 调用 OpenAI 兼容的 Chat Completions 接口做 200 字左右精简
- 回写 Supabase `attractions.tips` 字段，供详情页「景区简介」展示

## 运行方式

1. 新建 `.env.local`（不要提交到 git），配置：

```bash
VITE_SUPABASE_URL=https://<your>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx

# 火山方舟（OpenAI 兼容）配置
OPENAI_API_KEY=<your-ark-api-key>
OPENAI_BASE_URL=<your-ark-openai-compatible-base-url>
MODEL_NAME=<your-model-name>
```

2. 安装依赖并运行：

```bash
npm i
node scripts/fetch_and_summarize_baike.mjs
```

## 生成规则

- 目标长度：约 200 字
- 内容重点：核心特色/历史文化/自然风光
- 过滤：过多地理位置描述、无意义评级说明等

## 注意事项

- 如果未配置 `OPENAI_API_KEY`，脚本会自动使用内置的规则精简兜底（效果较弱）。
- 脚本为避免限流默认串行（并发=1），并带 500ms delay；全量跑完会较慢。
- 若线上详情页仍显示“暂无详细简介”，通常表示该景区 `tips/description` 在数据库里为空，或回写未成功。

