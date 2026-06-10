#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps


def load_env_files() -> None:
    root = Path(__file__).resolve().parents[1]
    for name in (".env.local", ".env"):
        env_path = root / name
        if not env_path.exists():
            continue
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def http_request(url: str, headers: dict[str, str], method: str = "GET", data: bytes | None = None, timeout: int = 60) -> bytes:
    request = urllib.request.Request(url, headers=headers, method=method, data=data)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def fetch_attractions(supabase_url: str, key: str, start: int, limit: int | None) -> list[dict]:
    params = {
        "select": "id,name,image_url",
        "image_url": "not.is.null",
        "order": "id.asc",
        "offset": str(start),
    }
    if limit is not None:
        params["limit"] = str(limit)

    query = urllib.parse.urlencode(params)
    url = f"{supabase_url.rstrip('/')}/rest/v1/attractions?{query}"
    payload = http_request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    data = json.loads(payload.decode("utf-8"))
    return data if isinstance(data, list) else []


def download_image(url: str) -> bytes:
    return http_request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        timeout=45,
    )


def make_min_image(content: bytes, max_edge: int, quality: int) -> bytes:
    with Image.open(io.BytesIO(content)) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        elif image.mode == "RGBA":
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.getchannel("A"))
            image = background

        image.thumbnail((max_edge, max_edge))
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=quality, method=6)
        return output.getvalue()


def build_min_public_url(supabase_url: str, bucket: str, attraction_id: str) -> str:
    encoded_path = urllib.parse.quote(f"attractions/{attraction_id}/cover.min.webp")
    return f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{encoded_path}"


def min_image_exists(url: str) -> tuple[bool, str]:
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return True, str(response.status)
    except urllib.error.HTTPError as exc:
        return False, str(exc.code)
    except Exception as exc:
        return False, str(exc)


def upload_min_image(supabase_url: str, key: str, bucket: str, attraction_id: str, content: bytes) -> str:
    object_path = f"attractions/{attraction_id}/cover.min.webp"
    encoded_path = urllib.parse.quote(object_path)
    url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{encoded_path}"
    http_request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "image/webp",
            "x-upsert": "true",
        },
        method="PUT",
        data=content,
    )
    return build_min_public_url(supabase_url, bucket, attraction_id)


def write_reports(report_path: Path, missing: list[dict]) -> tuple[Path, Path]:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    json_path = report_path.with_suffix(".json")
    md_path = report_path.with_suffix(".md")

    json_path.write_text(json.dumps(missing, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# 缺失景区 min 图清单",
        "",
        f"- 数量：{len(missing)}",
        "",
        "| ID | 景区 | 原图 | 当前状态 |",
        "| --- | --- | --- | --- |",
    ]
    for item in missing:
        lines.append(
            f"| {item['id']} | {item['name']} | {item['image_url']} | {item['status']} |"
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return json_path, md_path


def main() -> int:
    load_env_files()

    parser = argparse.ArgumentParser(description="Backfill only missing attraction min images.")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--max-edge", type=int, default=720)
    parser.add_argument("--quality", type=int, default=76)
    parser.add_argument("--sleep", type=float, default=0.15)
    parser.add_argument("--supabase-url", default=os.getenv("VITE_SUPABASE_URL", ""))
    parser.add_argument("--key", default=os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", ""))
    parser.add_argument("--bucket", default=os.getenv("SUPABASE_IMAGE_BUCKET", "attraction-images"))
    parser.add_argument("--report", default="docs/reports/2026-06-10-missing-attraction-min-images")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.supabase_url or not args.key:
        print("Missing Supabase config", file=sys.stderr)
        return 1

    attractions = fetch_attractions(args.supabase_url, args.key, args.start, args.limit)
    if not attractions:
        print("No attractions found.")
        return 0

    missing: list[dict] = []
    for item in attractions:
        attraction_id = str(item.get("id") or "").strip()
        image_url = str(item.get("image_url") or "").strip()
        name = str(item.get("name") or attraction_id)
        if not attraction_id or not image_url:
            continue

        min_url = build_min_public_url(args.supabase_url, args.bucket, attraction_id)
        exists, status = min_image_exists(min_url)
        if not exists:
            missing.append(
                {
                    "id": attraction_id,
                    "name": name,
                    "image_url": image_url,
                    "min_url": min_url,
                    "status": status,
                }
            )

    json_path, md_path = write_reports(Path(args.report), missing)
    print(json.dumps({"missing": len(missing), "json_report": str(json_path), "md_report": str(md_path)}, ensure_ascii=False))

    if args.dry_run or not missing:
        return 0

    success = 0
    failures = 0
    remaining: list[dict] = []

    for idx, item in enumerate(missing, start=1):
        attraction_id = item["id"]
        name = item["name"]
        image_url = item["image_url"]

        try:
            original = download_image(image_url)
            min_content = make_min_image(original, args.max_edge, args.quality)
            public_url = upload_min_image(args.supabase_url, args.key, args.bucket, attraction_id, min_content)
            success += 1
            print(f"[{idx}/{len(missing)}] OK {name} -> {public_url}")
        except (urllib.error.URLError, OSError, ValueError) as exc:
            failures += 1
            item["retry_error"] = str(exc)
            remaining.append(item)
            print(f"[{idx}/{len(missing)}] FAIL {name}: {exc}", file=sys.stderr)

        if args.sleep > 0:
            time.sleep(args.sleep)

    if remaining:
        write_reports(Path(args.report).with_name(Path(args.report).name + "-remaining"), remaining)

    print(json.dumps({"success": success, "failures": failures}, ensure_ascii=False))
    return 0 if failures == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
