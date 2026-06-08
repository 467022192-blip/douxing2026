import argparse
import json
import os
import ssl
import urllib.parse
import urllib.request


def _load_env_file(p: str) -> dict[str, str]:
    out: dict[str, str] = {}
    if not os.path.exists(p):
        return out
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            k, v = s.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _env(name: str, default: str = "") -> str:
    v = os.environ.get(name, "").strip()
    if v:
        return v
    merged: dict[str, str] = {}
    merged.update(_load_env_file(".env"))
    merged.update(_load_env_file(".env.local"))
    return merged.get(name, default).strip()


def _download(url: str, insecure: bool) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl._create_unverified_context() if insecure else None
    with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
        data = resp.read()
        ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        return data, ctype


def _detect_ext(content_type: str, data: bytes) -> tuple[str, str]:
    if content_type in ("image/jpeg", "image/jpg") or data[:3] == b"\xff\xd8\xff":
        return ".jpg", "image/jpeg"
    if content_type == "image/png" or data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png", "image/png"
    if content_type == "image/webp" or data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp", "image/webp"
    return ".jpg", "image/jpeg"


def _storage_upload(supabase_url: str, key: str, bucket: str, object_path: str, data: bytes, content_type: str) -> None:
    url = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"
    req = urllib.request.Request(
        url,
        data=data,
        method="PUT",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        resp.read()


def _rest_patch(supabase_url: str, key: str, table: str, eq_id: str, payload: dict) -> dict:
    url = f"{supabase_url}/rest/v1/{table}?id=eq.{urllib.parse.quote(eq_id)}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="PATCH",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _rest_get_one(supabase_url: str, key: str, table: str, eq_id: str, select: str) -> dict:
    url = f"{supabase_url}/rest/v1/{table}?select={urllib.parse.quote(select)}&id=eq.{urllib.parse.quote(eq_id)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}", "apikey": key})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data[0] if isinstance(data, list) and data else {}


def _extract_objurl(url: str) -> str:
    try:
        u = urllib.parse.urlparse(url)
        q = urllib.parse.parse_qs(u.query)
        if "objurl" in q and q["objurl"]:
            return urllib.parse.unquote(q["objurl"][0])
    except Exception:
        pass
    return url


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--insecure", action="store_true")
    parser.add_argument("--bucket", default=_env("SUPABASE_IMAGE_BUCKET", "attraction-images"))
    parser.add_argument("--supabase-url", default=_env("VITE_SUPABASE_URL"))
    parser.add_argument("--key", default=_env("SUPABASE_SERVICE_ROLE_KEY") or _env("VITE_SUPABASE_ANON_KEY"))
    args = parser.parse_args()

    supabase_url = (args.supabase_url or "").rstrip("/")
    key = (args.key or "").strip()
    if not supabase_url or not key:
        raise SystemExit("Missing Supabase config")

    before = _rest_get_one(supabase_url, key, "attractions", args.id, "id,name,image_url")

    direct_url = _extract_objurl(args.source_url)
    data, ctype = _download(direct_url, args.insecure)
    ext, final_ctype = _detect_ext(ctype, data)

    object_path = f"attractions/{args.id}/cover{ext}"
    _storage_upload(supabase_url, key, args.bucket, object_path, data, final_ctype)

    public_url = f"{supabase_url}/storage/v1/object/public/{args.bucket}/{object_path}"
    updated = _rest_patch(supabase_url, key, "attractions", args.id, {"image_url": public_url})

    after = _rest_get_one(supabase_url, key, "attractions", args.id, "id,name,image_url")
    print(json.dumps({"before": before, "after": after, "updated": updated[:1] if isinstance(updated, list) else updated}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
