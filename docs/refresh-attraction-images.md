# 批量更新景区图片（候选池 + 质检 + 去重 + Supabase Storage）

脚本：`scripts/refresh_attraction_images.py`

## 目标

- 为每个景区选择“更高清、真实、非地图、非泛黄”的背景图
- 真实图片去重（避免多个景区用同一张图）
- 优先上传到 Supabase Storage（稳定），失败回退外链

## 准备

1) 安装依赖：

```bash
python3 -m pip install -r scripts/requirements-refresh-images.txt
```

2) 配置环境变量（`.env.local` 或 `.env`）：

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

SUPABASE_SERVICE_ROLE_KEY=sb_secret_...   # 推荐，用于创建 bucket、上传与回写更稳定
SUPABASE_IMAGE_BUCKET=attraction-images  # 可选
```

`SUPABASE_SERVICE_ROLE_KEY` 建议仅在本地运行，避免泄露。

## Dry Run（不写库）

```bash
python3 scripts/refresh_attraction_images.py --dry-run --limit 10
```

会在 `exports/` 下输出报告 JSON（已被 `.gitignore` 忽略）。

## 正式执行（写库）

```bash
python3 scripts/refresh_attraction_images.py --max-edge 1600 --min-edge 800
```

常用参数：

- `--min-edge 800`：最低分辨率门槛（默认 800）
- `--max-edge 1600`：上传前最大边缩放（默认 1600，越大越清晰但体积越大）
- `--webp-quality 82`：WebP 压缩质量（默认 82）
- `--limit N`：只处理前 N 条
- `--start N`：从第 N 条开始
- `--sleep 0.35`：每条景区处理后睡眠（节流），弱网建议 0.25~0.5
- `--retries 3`：网络/上传/回写失败重试次数
- `--retry-backoff 0.8`：指数退避基础秒数
- `--retry-max-sleep 4.0`：单次退避上限秒数
- `--retry-jitter 0.2`：退避抖动（避免同一时刻集中重试）

## 输出

脚本会输出：

- 每条景区的最终选择来源（wiki/commons/baike/baidu/generated）
- 最终写入的 `attractions.image_url`
- 失败原因（如 Storage bucket 不存在 / 数据库更新权限不足）
