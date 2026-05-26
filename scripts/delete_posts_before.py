import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List


def _load_env_file(p: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not os.path.exists(p):
        return out
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            if "=" not in s:
                continue
            k, v = s.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _get_env(key: str, default: str = "") -> str:
    if key in os.environ and os.environ[key].strip():
        return os.environ[key].strip()
    merged: Dict[str, str] = {}
    merged.update(_load_env_file(".env.local"))
    merged.update(_load_env_file(".env"))
    return merged.get(key, default).strip()


def _http_json(url: str, headers: Dict[str, str], timeout: int = 30) -> Any:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _delete(url: str, headers: Dict[str, str], timeout: int = 30) -> None:
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        resp.read()


def _supabase_headers(key: str) -> Dict[str, str]:
    return {"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "return=minimal"}


def _chunks(xs: List[str], n: int) -> List[List[str]]:
    return [xs[i : i + n] for i in range(0, len(xs), n)]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cutoff", required=True, help="ISO timestamp, e.g. 2026-05-24T16:00:00Z")
    parser.add_argument("--supabase-url", default=_get_env("VITE_SUPABASE_URL", ""))
    parser.add_argument("--service-role-key", default=_get_env("SUPABASE_SERVICE_ROLE_KEY", ""))
    parser.add_argument("--anon-key", default=_get_env("VITE_SUPABASE_ANON_KEY", ""))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch", type=int, default=50)
    args = parser.parse_args()

    supabase_url = args.supabase_url.strip().rstrip("/")
    key = (args.service_role_key or args.anon_key).strip()
    if not supabase_url or not key:
        raise SystemExit("Missing supabase env")

    cutoff = args.cutoff.strip()

    list_url = (
        f"{supabase_url}/rest/v1/posts"
        f"?select={urllib.parse.quote('id,created_at')}"
        f"&created_at=lt.{urllib.parse.quote(cutoff)}"
        f"&limit=10000"
    )
    posts = _http_json(list_url, headers=_supabase_headers(key), timeout=40)
    if not isinstance(posts, list):
        raise SystemExit("Unexpected posts response")
    post_ids = [str(p.get("id")) for p in posts if p.get("id") is not None]

    print(json.dumps({"cutoff": cutoff, "posts_to_delete": len(post_ids)}, ensure_ascii=False))
    if args.dry_run or not post_ids:
        return 0

    for batch_ids in _chunks(post_ids, args.batch):
        in_clause = "(" + ",".join(batch_ids) + ")"
        q = urllib.parse.quote(in_clause)

        _delete(
            f"{supabase_url}/rest/v1/comments?post_id=in.{q}",
            headers=_supabase_headers(key),
            timeout=40,
        )
        _delete(
            f"{supabase_url}/rest/v1/likes?post_id=in.{q}",
            headers=_supabase_headers(key),
            timeout=40,
        )
        _delete(
            f"{supabase_url}/rest/v1/posts?id=in.{q}",
            headers=_supabase_headers(key),
            timeout=40,
        )

        time.sleep(0.15)

    verify = _http_json(list_url, headers=_supabase_headers(key), timeout=40)
    left = len(verify) if isinstance(verify, list) else -1
    print(json.dumps({"remaining_before_cutoff": left}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

