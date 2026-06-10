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


def http_request(url: str, headers: dict[str, str], method: str = "GET", data: bytes | None = None) -> bytes:
    request = urllib.request.Request(url, headers=headers, method=method, data=data)
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def rest_request(
    supabase_url: str,
    key: str,
    path: str,
    method: str = "GET",
    query: dict[str, str] | None = None,
    payload: object | None = None,
    extra_headers: dict[str, str] | None = None,
) -> object:
    url = f"{supabase_url.rstrip('/')}/rest/v1/{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"

    body = http_request(url, headers=headers, method=method, data=data)
    if not body:
        return {}
    return json.loads(body.decode("utf-8"))


def fetch_posts(supabase_url: str, key: str, start: int, limit: int | None) -> list[dict]:
    query = {
        "select": "id,user_id,images",
        "images": "not.is.null",
        "order": "id.asc",
        "offset": str(start),
    }
    if limit is not None:
        query["limit"] = str(limit)

    data = rest_request(supabase_url, key, "posts", query=query)
    return data if isinstance(data, list) else []


def normalize_post_images(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            normalized.append({"original": item.strip()})
            continue

        if not isinstance(item, dict):
            continue

        original = ""
        raw_original = item.get("original")
        raw_url = item.get("url")
        raw_min = item.get("min")

        if isinstance(raw_original, str) and raw_original.strip():
            original = raw_original.strip()
        elif isinstance(raw_url, str) and raw_url.strip():
            original = raw_url.strip()

        if not original:
            continue

        asset = {"original": original}
        if isinstance(raw_min, str) and raw_min.strip():
            asset["min"] = raw_min.strip()
        normalized.append(asset)

    return normalized


def download_image(url: str) -> bytes:
    return http_request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
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


def split_storage_public_url(supabase_url: str, bucket: str, url: str) -> tuple[str, str] | None:
    prefix = f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/"
    if not url.startswith(prefix):
        return None
    object_path = urllib.parse.unquote(url[len(prefix) :])
    return bucket, object_path


def derive_min_object_path(user_id: str, post_id: str, index: int, original_url: str, supabase_url: str, bucket: str) -> str:
    existing = split_storage_public_url(supabase_url, bucket, original_url)
    if existing:
        _, object_path = existing
        if "." in object_path.rsplit("/", 1)[-1]:
            base, _ = object_path.rsplit(".", 1)
        else:
            base = object_path
        return f"{base}.min.webp"
    return f"posts/{user_id}/{post_id}-{index}.min.webp"


def upload_min_image(supabase_url: str, key: str, bucket: str, object_path: str, content: bytes) -> str:
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
    return f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{encoded_path}"


def update_post_images(supabase_url: str, key: str, post_id: str, images: list[dict[str, str]]) -> None:
    rest_request(
        supabase_url,
        key,
        "posts",
        method="PATCH",
        query={"id": f"eq.{post_id}"},
        payload={"images": images, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
        extra_headers={"Prefer": "return=minimal"},
    )


def process_post(
    item: dict,
    *,
    supabase_url: str,
    key: str,
    bucket: str,
    max_edge: int,
    quality: int,
    dry_run: bool,
) -> tuple[bool, int]:
    post_id = str(item.get("id") or "").strip()
    user_id = str(item.get("user_id") or "").strip()
    assets = normalize_post_images(item.get("images"))
    if not post_id or not user_id or not assets:
        return False, 0

    changed = False
    generated_count = 0

    for index, asset in enumerate(assets):
        if asset.get("min"):
            continue

        original_url = asset.get("original", "").strip()
        if not original_url:
            continue

        original = download_image(original_url)
        min_content = make_min_image(original, max_edge, quality)
        object_path = derive_min_object_path(user_id, post_id, index, original_url, supabase_url, bucket)
        min_url = (
            f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{urllib.parse.quote(object_path)}"
            if dry_run
            else upload_min_image(supabase_url, key, bucket, object_path, min_content)
        )
        asset["min"] = min_url
        changed = True
        generated_count += 1

    if changed and not dry_run:
        update_post_images(supabase_url, key, post_id, assets)

    return changed, generated_count


def main() -> int:
    load_env_files()

    parser = argparse.ArgumentParser(description="Backfill min images for historical posts.")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--max-edge", type=int, default=720)
    parser.add_argument("--quality", type=int, default=76)
    parser.add_argument("--sleep", type=float, default=0.15)
    parser.add_argument("--bucket", default=os.getenv("SUPABASE_POSTS_BUCKET", "posts"))
    parser.add_argument("--supabase-url", default=os.getenv("VITE_SUPABASE_URL", ""))
    parser.add_argument("--key", default=os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", ""))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.supabase_url or not args.key:
        print("Missing Supabase config", file=sys.stderr)
        return 1

    posts = fetch_posts(args.supabase_url, args.key, args.start, args.limit)
    if not posts:
        print("No posts found.")
        return 0

    scanned = 0
    updated = 0
    generated = 0
    failures = 0

    for idx, item in enumerate(posts, start=1):
        post_id = str(item.get("id") or "").strip()
        scanned += 1
        try:
            changed, generated_count = process_post(
                item,
                supabase_url=args.supabase_url,
                key=args.key,
                bucket=args.bucket,
                max_edge=args.max_edge,
                quality=args.quality,
                dry_run=args.dry_run,
            )
            generated += generated_count
            if changed:
                updated += 1
                action = "DRY-RUN" if args.dry_run else "UPDATED"
                print(f"[{idx}/{len(posts)}] {action} post={post_id} generated={generated_count}")
            else:
                print(f"[{idx}/{len(posts)}] SKIP post={post_id}")
        except (urllib.error.URLError, OSError, ValueError) as exc:
            failures += 1
            print(f"[{idx}/{len(posts)}] FAIL post={post_id}: {exc}", file=sys.stderr)

        if args.sleep > 0:
            time.sleep(args.sleep)

    print(
        json.dumps(
            {
                "scanned": scanned,
                "updated": updated,
                "generated": generated,
                "failures": failures,
                "dry_run": args.dry_run,
            },
            ensure_ascii=False,
        )
    )
    return 0 if failures == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
