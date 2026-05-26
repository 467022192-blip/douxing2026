import argparse
import io
import json
import os
import random
import re
import subprocess
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from PIL import Image


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
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k:
                out[k] = v
    return out


def _get_env(key: str, default: str = "") -> str:
    if key in os.environ and os.environ[key].strip():
        return os.environ[key].strip()
    merged: Dict[str, str] = {}
    merged.update(_load_env_file(".env.local"))
    merged.update(_load_env_file(".env"))
    return merged.get(key, default).strip()


def _with_retry(fn, retries: int, backoff: float, max_sleep: float, jitter: float):
    last_err = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt >= retries:
                break
            s = min(max_sleep, backoff * (2**attempt))
            if jitter > 0:
                s += random.random() * jitter
            time.sleep(s)
    raise last_err  # type: ignore[misc]


def _run_json(cmd: List[str]) -> Any:
    out = subprocess.check_output(cmd)
    return json.loads(out.decode("utf-8"))


def _read_sheet_values(sheet_url: str, range_a1: str) -> List[List[Any]]:
    data = _run_json(["lark-cli", "sheets", "+read", "--url", sheet_url, "--range", range_a1])
    values = data.get("data", {}).get("valueRange", {}).get("values")
    if not isinstance(values, list):
        raise RuntimeError("Unexpected sheet values")
    return values


def _http_bytes(url: str, headers: Dict[str, str], timeout: int = 40) -> bytes:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _http_text(url: str, headers: Dict[str, str], timeout: int = 40) -> str:
    return _http_bytes(url, headers=headers, timeout=timeout).decode("utf-8", errors="ignore")


def _download_headers_for(url: str) -> Dict[str, str]:
    base = {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    }
    u = url.lower()
    if "images.unsplash.com" in u:
        return {**base, "Referer": "https://unsplash.com/", "Accept": "image/jpeg,image/webp,image/*,*/*;q=0.8"}
    if "i0.wp.com" in u:
        return {**base, "Referer": "https://i0.wp.com/"}
    if "upload.wikimedia.org" in u:
        return base
    if "bkimg.cdn.bcebos.com" in u or "baidu.com" in u or "bdstatic.com" in u:
        return {**base, "Referer": "https://www.baidu.com/"}
    if "douyinpic.com" in u or "douyin.com" in u:
        return {**base, "Referer": "https://www.douyin.com/"}
    if "itc.cn" in u:
        return {**base, "Referer": "https://www.sohu.com/"}
    return base


def _patch_json(url: str, headers: Dict[str, str], payload: Any, timeout: int = 30) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, headers={**headers, "Content-Type": "application/json"}, data=data, method="PATCH")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        resp.read()


def _put_bytes(url: str, headers: Dict[str, str], payload: bytes, timeout: int = 60) -> None:
    req = urllib.request.Request(url, headers=headers, data=payload, method="PUT")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        resp.read()


def _extract_cell_url(cell: Any) -> str:
    if cell is None:
        return ""
    if isinstance(cell, str):
        return cell.strip()
    if isinstance(cell, dict):
        return (cell.get("link") or cell.get("text") or "").strip()
    if isinstance(cell, list):
        for seg in cell:
            if isinstance(seg, dict):
                u = (seg.get("link") or seg.get("text") or "").strip()
                if u:
                    return u
            elif isinstance(seg, str) and seg.strip().startswith("http"):
                return seg.strip()
        return ""
    return str(cell).strip()


def _decode_baidu_image_detail(url: str) -> str:
    try:
        qs = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        obj = qs.get("objurl", [""])[0]
        if obj:
            return urllib.parse.unquote(obj)
    except Exception:
        pass
    return url


def _decode_baike_pic(url: str) -> Optional[str]:
    if "bkimg.cdn.bcebos.com" in url:
        return url
    if not url.startswith("https://baike.baidu.com/pic/"):
        return None
    frag = urllib.parse.urlsplit(url).fragment
    qs = urllib.parse.parse_qs(frag)
    pic = qs.get("pic", [""])[0]
    if pic:
        return f"https://bkimg.cdn.bcebos.com/pic/{pic}"
    return None


def _resolve_download_url(url: str) -> str:
    u = url.strip()
    if not u:
        return ""
    if "image.baidu.com/search/detail" in u and "objurl=" in u:
        return _decode_baidu_image_detail(u)
    if u.startswith("https://baike.baidu.com/pic/"):
        r = _decode_baike_pic(u)
        return r or u
    try:
        p = urllib.parse.urlsplit(u)
        if p.netloc.lower() == "images.unsplash.com":
            qs = urllib.parse.parse_qs(p.query)
            qs["fm"] = ["jpg"]
            if "auto" in qs:
                qs.pop("auto", None)
            q2 = urllib.parse.urlencode(qs, doseq=True)
            return urllib.parse.urlunsplit((p.scheme, p.netloc, p.path, q2, p.fragment))
    except Exception:
        pass
    return u


def _decode_image(data: bytes) -> Optional[Image.Image]:
    try:
        if data[:32].lstrip().startswith(b"<"):
            return None
        img = Image.open(io.BytesIO(data))
        img.load()
        return img
    except Exception:
        return None


def _resize_to_max_edge(img: Image.Image, max_edge: int) -> Image.Image:
    w, h = img.size
    edge = max(w, h)
    if edge <= max_edge:
        return img
    scale = max_edge / edge
    nw = max(1, int(w * scale))
    nh = max(1, int(h * scale))
    return img.resize((nw, nh), Image.LANCZOS)


def _encode_webp(img: Image.Image, quality: int) -> bytes:
    out = io.BytesIO()
    img.convert("RGB").save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue()


def _supabase_headers(key: str) -> Dict[str, str]:
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _storage_public_url(supabase_url: str, bucket: str, path0: str) -> str:
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{urllib.parse.quote(path0)}"


def _upload_webp_to_storage(supabase_url: str, key: str, bucket: str, path0: str, content: bytes) -> str:
    put_url = f"{supabase_url}/storage/v1/object/{bucket}/{urllib.parse.quote(path0)}"
    _put_bytes(
        put_url,
        headers={
            **_supabase_headers(key),
            "Content-Type": "image/webp",
            "x-upsert": "true",
        },
        payload=content,
        timeout=90,
    )
    return _storage_public_url(supabase_url, bucket, path0)


def _clean_name(name: str) -> str:
    s = name
    for t in [
        "风景名胜区",
        "风景区",
        "旅游区",
        "景区",
        "国家森林公园",
        "森林公园",
        "地质公园",
        "国家地质公园",
        "旅游度假区",
        "度假区",
        "主题公园",
        "名胜区",
        "自然保护区",
    ]:
        s = s.replace(t, "")
    return s.strip() or name


def _location_split_variants(name: str) -> List[str]:
    seps = [
        "特别行政区",
        "自治区",
        "自治州",
        "自治县",
        "自治旗",
        "地区",
        "盟",
        "省",
        "州",
        "市",
        "县",
        "区",
        "旗",
    ]
    out: List[str] = []
    s = name.strip()
    if s:
        out.append(s)
    cur = s
    for _ in range(6):
        rest = None
        for sep in seps:
            if sep in cur:
                i = cur.find(sep)
                if i >= 0 and i + len(sep) < len(cur):
                    rest = cur[i + len(sep) :].strip()
                    break
        if not rest:
            break
        if rest not in out:
            out.append(rest)
        cur = rest
    return out


def _normalize_admin_units(s: str) -> str:
    t = s
    for u in ["省", "市", "州", "地区", "盟", "县", "区", "旗"]:
        t = t.replace(u, "")
    return t.strip()


def _title_variants(name: str) -> List[str]:
    base = [name, _clean_name(name)]
    out: List[str] = []
    for b in base:
        for v in _location_split_variants(b):
            v = v.strip()
            if not v:
                continue
            if v not in out:
                out.append(v)
            vn = _normalize_admin_units(v)
            if vn and vn not in out:
                out.append(vn)
    return out[:16]


def _wiki_page_images(title: str, lang: str, min_edge: int) -> List[str]:
    api = f"https://{lang}.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages",
        "piprop": "thumbnail|name|original",
        "pithumbsize": "2500",
        "redirects": "1",
        "titles": title,
    }
    url = api + "?" + urllib.parse.urlencode(params)
    data = json.loads(_http_text(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20))
    pages = data.get("query", {}).get("pages", {})
    out: List[str] = []
    for _, page in pages.items():
        orig = page.get("original")
        if orig and orig.get("source") and orig.get("width") and orig.get("height"):
            w = int(orig.get("width"))
            h = int(orig.get("height"))
            if max(w, h) >= min_edge:
                out.append(orig.get("source"))
        thumb = page.get("thumbnail")
        if thumb and thumb.get("source") and thumb.get("width") and thumb.get("height"):
            w = int(thumb.get("width"))
            h = int(thumb.get("height"))
            if max(w, h) >= min_edge:
                out.append(thumb.get("source"))
    return out


def _commons_search_images(query: str, min_edge: int, limit: int = 6) -> List[str]:
    api = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrnamespace": "6",
        "gsrsearch": query,
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|size|mime",
    }
    url = api + "?" + urllib.parse.urlencode(params)
    data = json.loads(_http_text(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=25))
    pages = data.get("query", {}).get("pages", {})
    out: List[str] = []
    for _, page in pages.items():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        mime = (info.get("mime") or "").lower()
        if not mime.startswith("image/"):
            continue
        u = info.get("url")
        w = int(info.get("width") or 0)
        h = int(info.get("height") or 0)
        if u and max(w, h) >= min_edge:
            out.append(u)
    return out


def _baike_og_image(title: str) -> Optional[str]:
    url = "https://baike.baidu.com/item/" + urllib.parse.quote(title)
    html = _http_text(
        url,
        headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-CN,zh;q=0.9", "Referer": "https://www.baidu.com/"},
        timeout=25,
    )
    m = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html)
    if m:
        return m.group(1)
    m2 = re.search(r'"lemmaPicture":\{"url":"(.*?)"', html)
    if m2:
        return m2.group(1).replace("\\/", "/")
    return None


def _fallback_search_images(name: str, min_edge: int) -> List[str]:
    out: List[str] = []
    titles = _title_variants(name)
    for lang in ["zh", "en"]:
        for t in titles:
            try:
                out.extend(_wiki_page_images(t, lang=lang, min_edge=min_edge))
            except Exception:
                pass
    for t in titles:
        try:
            out.extend(_commons_search_images(t, min_edge=min_edge, limit=6))
        except Exception:
            pass
    for t in titles:
        try:
            u = _baike_og_image(t)
            if u and "bkssl.bdimg.com/cms/static/baike.png" not in u:
                out.append(u)
                break
        except Exception:
            pass
    seen = set()
    deduped: List[str] = []
    for u in out:
        if not u or u in seen:
            continue
        if _decode_baike_pic(u):
            u = _decode_baike_pic(u) or u
        seen.add(u)
        deduped.append(u)
    return deduped[:12]


def _pick_column(header: List[Any], cands: List[str]) -> int:
    norm = []
    for c in header:
        s = str(c or "").strip().lower().replace(" ", "")
        norm.append(s)
    for cand in cands:
        c0 = cand.strip().lower().replace(" ", "")
        if c0 in norm:
            return norm.index(c0)
    return -1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet-url", required=True)
    parser.add_argument("--sheet-id", required=True)
    parser.add_argument("--range", default=None)
    parser.add_argument("--supabase-url", default=_get_env("VITE_SUPABASE_URL", ""))
    parser.add_argument("--anon-key", default=_get_env("VITE_SUPABASE_ANON_KEY", ""))
    parser.add_argument("--service-role-key", default=_get_env("SUPABASE_SERVICE_ROLE_KEY", ""))
    parser.add_argument("--bucket", default=_get_env("SUPABASE_IMAGE_BUCKET", "attraction-images"))
    parser.add_argument("--max-edge", type=int, default=1400)
    parser.add_argument("--webp-quality", type=int, default=78)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-backoff", type=float, default=0.9)
    parser.add_argument("--retry-max-sleep", type=float, default=5.0)
    parser.add_argument("--retry-jitter", type=float, default=0.25)
    parser.add_argument("--sleep", type=float, default=0.08)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--progress-interval-sec", type=int, default=60)
    parser.add_argument("--progress-path", default=os.path.join("exports", "sheet_loc_img_apply_progress.json"))
    parser.add_argument("--only", choices=["all", "address", "image"], default="all")
    parser.add_argument("--ids", default="")
    args = parser.parse_args()

    supabase_url = args.supabase_url.strip().rstrip("/")
    anon_key = args.anon_key.strip()
    service_key = args.service_role_key.strip()
    if not supabase_url or not anon_key:
        raise SystemExit("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY")

    update_key = service_key or anon_key
    sheet_range = args.range or f"{args.sheet_id}!A1:Z500"
    values = _read_sheet_values(args.sheet_url, sheet_range)
    if not values:
        raise SystemExit("Empty sheet")

    header = values[0]
    idx_id = _pick_column(header, ["id", "编号", "景区id", "ID"]) 
    idx_name = _pick_column(header, ["name", "名称", "景区名称"]) 
    idx_address = _pick_column(header, ["address", "地址", "定位", "地址定位"]) 
    idx_image = _pick_column(header, ["image_url", "imageurl", "urlnew", "图片url", "图片链接", "图片地址", "图片"]) 

    if idx_id < 0:
        raise SystemExit("Missing ID column")
    if idx_name < 0:
        idx_name = min(idx_id + 1, len(header) - 1)
    if idx_address < 0:
        idx_address = min(idx_id + 2, len(header) - 1)
    if idx_image < 0:
        idx_image = len(header) - 1

    rows = values[1:]
    if args.limit and args.limit > 0:
        rows = rows[: args.limit]

    ids_set = {s.strip() for s in args.ids.split(",") if s.strip()} if args.ids else set()
    report: List[Dict[str, Any]] = []

    started_at = time.time()
    last_progress_at = started_at
    total = len(rows)
    os.makedirs("exports", exist_ok=True)
    progress_path = os.path.join(os.getcwd(), args.progress_path)

    def write_progress() -> None:
        done = len(report)
        now = time.time()
        elapsed = max(1e-6, now - started_at)
        rate = done / elapsed
        eta = int((total - done) / rate) if rate > 0 else 0
        ok_addr = sum(1 for r in report if r.get("address_updated") is True)
        ok_img = sum(1 for r in report if r.get("image_updated") is True)
        attempted_img = sum(1 for r in report if r.get("image_attempted") is True)
        fail_img = sum(1 for r in report if r.get("image_attempted") is True and (r.get("uploaded") is False or r.get("image_updated") is False))
        payload = {
            "total": total,
            "done": done,
            "ok_address": ok_addr,
            "ok_image": ok_img,
            "attempted_image": attempted_img,
            "fail_image": fail_img,
            "elapsed_sec": int(elapsed),
            "eta_sec": eta,
            "rate_per_sec": round(rate, 4),
            "last": report[-1] if report else None,
        }
        try:
            tmp = progress_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"progress": payload, "recent": report[-20:]}, f, ensure_ascii=False, indent=2)
            os.replace(tmp, progress_path)
        except Exception:
            pass
        print(json.dumps({"progress": payload}, ensure_ascii=False))

    for row_idx, row in enumerate(rows, start=2):
        r = list(row)
        need_len = max(idx_id, idx_name, idx_address, idx_image) + 1
        while len(r) < need_len:
            r.append(None)

        rid = "" if r[idx_id] is None else str(r[idx_id]).strip()
        name = str(r[idx_name] or "").strip()
        address = str(r[idx_address] or "").strip()
        raw_url = _extract_cell_url(r[idx_image])

        item: Dict[str, Any] = {"row": row_idx, "id": rid, "name": name, "address": address, "urlnew": raw_url}
        is_valid_id = bool(rid) and rid.isdigit()
        if ids_set and (not is_valid_id or rid not in ids_set):
            continue

        if is_valid_id and args.only in ["all", "address"]:
            item["address_attempted"] = True
            try:
                _with_retry(
                    lambda: _patch_json(
                        f"{supabase_url}/rest/v1/attractions?id=eq.{urllib.parse.quote(rid)}",
                        headers={**_supabase_headers(update_key), "Prefer": "return=minimal"},
                        payload={"address": address if address else None},
                        timeout=30,
                    ),
                    retries=args.retries,
                    backoff=args.retry_backoff,
                    max_sleep=args.retry_max_sleep,
                    jitter=args.retry_jitter,
                )
                item["address_updated"] = True
            except Exception as e:
                item["address_updated"] = False
                item["address_error"] = str(e)
        else:
            item["address_attempted"] = False
            item["address_updated"] = None

        final_image_url = ""
        if is_valid_id and args.only in ["all", "image"]:
            u0 = raw_url.strip()
            if u0.startswith("http"):
                item["image_attempted"] = True
                download_url = _resolve_download_url(u0)
                data = None
                try:
                    data = _with_retry(
                        lambda: _http_bytes(download_url, headers=_download_headers_for(download_url), timeout=45),
                        retries=args.retries,
                        backoff=args.retry_backoff,
                        max_sleep=args.retry_max_sleep,
                        jitter=args.retry_jitter,
                    )
                except Exception as e:
                    item["download_error"] = str(e)
                    candidates = _fallback_search_images(name, min_edge=800)
                    for cand in candidates:
                        try:
                            data = _with_retry(
                                lambda: _http_bytes(cand, headers=_download_headers_for(cand), timeout=45),
                                retries=1,
                                backoff=0.7,
                                max_sleep=2.0,
                                jitter=0.2,
                            )
                            download_url = cand
                            break
                        except Exception:
                            continue

                if data:
                    img = _decode_image(data)
                    if img:
                        resized = _resize_to_max_edge(img, args.max_edge)
                        webp = _encode_webp(resized, quality=args.webp_quality)
                        obj_path = f"attractions/{rid}/cover.webp"
                        try:
                            final_image_url = _with_retry(
                                lambda: _upload_webp_to_storage(supabase_url, update_key, args.bucket, obj_path, webp),
                                retries=args.retries,
                                backoff=args.retry_backoff,
                                max_sleep=args.retry_max_sleep,
                                jitter=args.retry_jitter,
                            )
                            item["uploaded"] = True
                            item["download_url"] = download_url
                        except Exception as e:
                            item["uploaded"] = False
                            item["upload_error"] = str(e)
                    else:
                        item["uploaded"] = False
                        item["upload_error"] = "decode_image_failed"
                else:
                    item["uploaded"] = False
                    item["upload_error"] = "download_failed"
            else:
                item["image_attempted"] = False
                item["uploaded"] = None
                item["image_updated"] = None
        else:
            item["image_attempted"] = False
            item["uploaded"] = None
            item["image_updated"] = None

        if is_valid_id and final_image_url:
            try:
                _with_retry(
                    lambda: _patch_json(
                        f"{supabase_url}/rest/v1/attractions?id=eq.{urllib.parse.quote(rid)}",
                        headers={**_supabase_headers(update_key), "Prefer": "return=minimal"},
                        payload={"image_url": final_image_url},
                        timeout=30,
                    ),
                    retries=args.retries,
                    backoff=args.retry_backoff,
                    max_sleep=args.retry_max_sleep,
                    jitter=args.retry_jitter,
                )
                item["image_updated"] = True
                item["image_url"] = final_image_url
            except Exception as e:
                item["image_updated"] = False
                item["image_error"] = str(e)

        report.append(item)

        now = time.time()
        if args.progress_interval_sec > 0 and (now - last_progress_at) >= args.progress_interval_sec:
            write_progress()
            last_progress_at = now
        if args.sleep > 0:
            time.sleep(args.sleep)

    out_path = os.path.join("exports", f"sheet_loc_img_apply_report_{int(time.time())}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    write_progress()
    print(json.dumps({"processed": len(report), "report": out_path}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
