import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


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


def _supabase_headers(key: str) -> Dict[str, str]:
    return {"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "return=minimal"}


def _http_json(url: str, headers: Dict[str, str], timeout: int = 40) -> Any:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _patch_json(url: str, headers: Dict[str, str], payload: Any, timeout: int = 40) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, headers={**headers, "Content-Type": "application/json"}, data=data, method="PATCH")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        resp.read()


def _parse_address(address: str) -> Optional[Tuple[str, str, str]]:
    parts = [p.strip() for p in address.split("·")]
    parts = [p for p in parts if p]
    if len(parts) < 2:
        return None
    prov = parts[0]
    city = parts[1]
    district = parts[2] if len(parts) >= 3 else ""
    return prov, city, district


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--supabase-url", default=_get_env("VITE_SUPABASE_URL", ""))
    parser.add_argument("--service-role-key", default=_get_env("SUPABASE_SERVICE_ROLE_KEY", ""))
    parser.add_argument("--anon-key", default=_get_env("VITE_SUPABASE_ANON_KEY", ""))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--ids", default="")
    args = parser.parse_args()

    supabase_url = args.supabase_url.strip().rstrip("/")
    key = (args.service_role_key or args.anon_key).strip()
    if not supabase_url or not key:
        raise SystemExit("Missing supabase env")

    ids_set = {s.strip() for s in args.ids.split(",") if s.strip()} if args.ids else set()

    select = urllib.parse.quote("id,name,province,city,address")
    url = f"{supabase_url}/rest/v1/attractions?select={select}&order=id.asc&limit=3000"
    rows = _http_json(url, headers=_supabase_headers(key), timeout=60)
    if not isinstance(rows, list):
        raise SystemExit("Unexpected response")

    changes: List[Dict[str, Any]] = []
    for r in rows:
        rid = str(r.get("id") or "").strip()
        if not rid.isdigit():
            continue
        if ids_set and rid not in ids_set:
            continue
        address = str(r.get("address") or "").strip()
        parsed = _parse_address(address)
        if not parsed:
            continue
        prov_new, city_new, _ = parsed
        prov_old = str(r.get("province") or "").strip()
        city_old = str(r.get("city") or "").strip()

        update: Dict[str, Any] = {}
        if (not city_old) or (prov_old and city_old == prov_old):
            if city_new and city_new != city_old:
                update["city"] = city_new
        if (not prov_old) and prov_new:
            update["province"] = prov_new

        if update:
            changes.append(
                {
                    "id": rid,
                    "name": r.get("name") or "",
                    "province_old": prov_old,
                    "city_old": city_old,
                    "address": address,
                    "update": update,
                }
            )
        if args.limit and len(changes) >= args.limit:
            break

    print(json.dumps({"candidates": len(changes), "dry_run": bool(args.dry_run)}, ensure_ascii=False))
    if changes:
        print(json.dumps({"sample": changes[:10]}, ensure_ascii=False))

    if args.dry_run or not changes:
        return 0

    for item in changes:
        rid = item["id"]
        update = item["update"]
        _patch_json(
            f"{supabase_url}/rest/v1/attractions?id=eq.{urllib.parse.quote(rid)}",
            headers=_supabase_headers(key),
            payload=update,
            timeout=40,
        )
        time.sleep(0.05)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

