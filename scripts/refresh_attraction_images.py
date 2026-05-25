import argparse
import hashlib
import io
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from PIL import Image


def _with_retry(fn, retries: int, backoff: float, max_sleep: float, jitter: float, retry_name: str):
    last_err = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt >= retries:
                break
            sleep_s = min(max_sleep, backoff * (2**attempt))
            if jitter > 0:
                sleep_s += random.random() * jitter
            time.sleep(sleep_s)
    raise last_err  # type: ignore[misc]


def _http_json(url: str, headers: Dict[str, str], timeout: int = 15) -> Any:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


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
    merged = {}
    merged.update(_load_env_file(".env.local"))
    merged.update(_load_env_file(".env"))
    return merged.get(key, default).strip()


def _http_bytes(url: str, headers: Dict[str, str], timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _http_text(url: str, headers: Dict[str, str], timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _post_json(url: str, headers: Dict[str, str], payload: Any, timeout: int = 20) -> Any:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, headers={**headers, "Content-Type": "application/json"}, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}


def _patch_json(url: str, headers: Dict[str, str], payload: Any, timeout: int = 20) -> Any:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, headers={**headers, "Content-Type": "application/json"}, data=data, method="PATCH")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}


def _put_bytes(url: str, headers: Dict[str, str], payload: bytes, timeout: int = 30) -> None:
    req = urllib.request.Request(url, headers=headers, data=payload, method="PUT")
    with urllib.request.urlopen(req, timeout=timeout) as _:
        return


def _hamming(a: int, b: int) -> int:
    x = a ^ b
    c = 0
    while x:
        x &= x - 1
        c += 1
    return c


def _dhash(img: Image.Image) -> int:
    gray = img.convert("L").resize((9, 8), Image.BILINEAR)
    px = list(gray.getdata())
    bits = 0
    for y in range(8):
        row = px[y * 9 : (y + 1) * 9]
        for x in range(8):
            bits <<= 1
            bits |= 1 if row[x] > row[x + 1] else 0
    return bits


def _color_metrics(img: Image.Image) -> Tuple[float, float, float]:
    small = img.convert("RGB").resize((64, 64), Image.BILINEAR)
    data = list(small.getdata())

    total = len(data)
    if total == 0:
        return 0.0, 0.0, 0.0

    sat_sum = 0.0
    yellow = 0
    near_white_low_sat = 0

    for r, g, b in data:
        rf = r / 255.0
        gf = g / 255.0
        bf = b / 255.0
        mx = max(rf, gf, bf)
        mn = min(rf, gf, bf)
        diff = mx - mn
        sat = 0.0 if mx == 0 else diff / mx
        sat_sum += sat

        if mx > 0.86 and sat < 0.10:
            near_white_low_sat += 1

        if diff == 0:
            continue

        if mx == rf:
            hue = ((gf - bf) / diff) % 6
        elif mx == gf:
            hue = ((bf - rf) / diff) + 2
        else:
            hue = ((rf - gf) / diff) + 4
        hue_deg = hue * 60.0
        if 35.0 <= hue_deg <= 65.0 and sat > 0.22 and mx > 0.35:
            yellow += 1

    mean_sat = sat_sum / total
    yellow_ratio = yellow / total
    map_like = near_white_low_sat / total
    return mean_sat, yellow_ratio, map_like


def _looks_like_map(url: str, map_like: float) -> bool:
    lower = url.lower()
    if any(k in lower for k in ["map", "%e5%9c%b0%e5%9b%be", "行政区", "guizhou_map", "_map.", "map.png", "map.jpg"]):
        return True
    return map_like > 0.62


def _is_bad_extension(url: str) -> bool:
    lower = url.lower()
    for ext in [".djvu", ".pdf", ".svg", ".webm", ".ogg", ".ogv", ".mp4"]:
        if ext in lower or urllib.parse.quote(ext) in lower:
            return True
    return False


def _safe_filename(s: str) -> str:
    s = re.sub(r"\s+", "_", s.strip())
    s = re.sub(r"[^0-9A-Za-z_\-\u4e00-\u9fff]", "", s)
    return s[:80] or "item"


def _rand_color(name: str) -> Tuple[int, int, int]:
    h = hashlib.sha256(name.encode("utf-8")).digest()
    r = 80 + (h[0] % 140)
    g = 80 + (h[1] % 140)
    b = 80 + (h[2] % 140)
    return r, g, b


def _generate_placeholder(name: str, kind: str) -> Image.Image:
    w, h = 1600, 1066
    base = Image.new("RGB", (w, h), _rand_color(name + kind))
    rnd = random.Random(int(hashlib.sha256((name + kind).encode("utf-8")).hexdigest(), 16) % (2**32))
    pixels = base.load()
    for _ in range(12):
        x0 = rnd.randint(0, w - 1)
        y0 = rnd.randint(0, h - 1)
        x1 = rnd.randint(x0, min(w - 1, x0 + rnd.randint(200, 900)))
        y1 = rnd.randint(y0, min(h - 1, y0 + rnd.randint(200, 700)))
        rr, gg, bb = _rand_color(name + kind + str(_))
        for y in range(y0, y1, 3):
            for x in range(x0, x1, 3):
                pixels[x, y] = (rr, gg, bb)
    return base


@dataclass
class Candidate:
    source: str
    url: str
    width: int
    height: int
    score: float
    reason: str
    dhash: int
    mean_sat: float
    yellow_ratio: float
    map_like: float


def _score_candidate(url: str, img: Image.Image) -> Tuple[float, str, int, float, float, float]:
    w, h = img.size
    d = _dhash(img)
    mean_sat, yellow_ratio, map_like = _color_metrics(img)
    bad = []
    if _looks_like_map(url, map_like):
        bad.append("map")
    if yellow_ratio > 0.22 and mean_sat < 0.28:
        bad.append("yellow")

    base = max(w, h)
    score = (base / 50.0) + (mean_sat * 40.0) - (yellow_ratio * 120.0) - (map_like * 220.0)
    reason = ",".join(bad) if bad else "ok"
    return score, reason, d, mean_sat, yellow_ratio, map_like


def _decode_image(data: bytes) -> Optional[Image.Image]:
    try:
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


def _wiki_page_image(title: str, lang: str, min_edge: int) -> List[Tuple[str, int, int]]:
    api = f"https://{lang}.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages",
        "piprop": "thumbnail|name|original",
        "pithumbsize": "2000",
        "redirects": "1",
        "titles": title,
    }
    url = api + "?" + urllib.parse.urlencode(params)
    data = _http_json(url, {"User-Agent": "TraeBot/1.0", "Accept-Language": "zh-CN,zh;q=0.9"}, timeout=12)
    pages = data.get("query", {}).get("pages", {})
    out: List[Tuple[str, int, int]] = []
    for _, page in pages.items():
        thumb = page.get("thumbnail")
        orig = page.get("original")
        if orig and orig.get("source") and orig.get("width") and orig.get("height"):
            w = int(orig.get("width"))
            h = int(orig.get("height"))
            if max(w, h) >= min_edge:
                out.append((orig.get("source"), w, h))
        if thumb and thumb.get("source") and thumb.get("width") and thumb.get("height"):
            w = int(thumb.get("width"))
            h = int(thumb.get("height"))
            if max(w, h) >= min_edge:
                out.append((thumb.get("source"), w, h))
    return out


def _commons_search_images(query: str, min_edge: int, limit: int = 8) -> List[Tuple[str, int, int]]:
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
    data = _http_json(url, {"User-Agent": "TraeBot/1.0"}, timeout=15)
    pages = data.get("query", {}).get("pages", {})
    out: List[Tuple[str, int, int]] = []
    for _, page in pages.items():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        mime = (info.get("mime") or "").lower()
        if not mime.startswith("image/"):
            continue
        url0 = info.get("url")
        w = int(info.get("width") or 0)
        h = int(info.get("height") or 0)
        if url0 and max(w, h) >= min_edge:
            out.append((url0, w, h))
    return out


def _baike_og_image(title: str) -> Optional[str]:
    url = "https://baike.baidu.com/item/" + urllib.parse.quote(title)
    headers = {"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-CN,zh;q=0.9"}
    try:
        html = _http_text(url, headers=headers, timeout=18)
    except Exception:
        return None
    m = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html)
    if m:
        return m.group(1)
    m2 = re.search(r'"lemmaPicture":\{"url":"(.*?)"', html)
    if m2:
        return m2.group(1).replace("\\/", "/")
    return None


def _baidu_image_search(query: str, limit: int = 10) -> List[str]:
    url = "https://image.baidu.com/search/index?" + urllib.parse.urlencode(
        {
            "tn": "baiduimage",
            "word": query,
            "fm": "result",
            "ie": "utf-8",
        }
    )
    headers = {"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-CN,zh;q=0.9"}
    try:
        html = _http_text(url, headers=headers, timeout=18)
    except Exception:
        return []
    urls = []
    for m in re.finditer(r'"objURL"\s*:\s*"(.*?)"', html):
        u = m.group(1).replace("\\/", "/")
        if u.startswith("http"):
            urls.append(u)
        if len(urls) >= limit:
            break
    return urls


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


def _kind_from_name(name: str) -> str:
    if any(k in name for k in ["山", "峰", "岭", "崖", "峡", "谷"]):
        return "mountain"
    if any(k in name for k in ["湖", "海", "江", "河", "瀑", "湾", "泉"]):
        return "water"
    if any(k in name for k in ["寺", "庙", "塔", "宫", "观"]):
        return "temple"
    if any(k in name for k in ["古城", "古镇", "古村", "老街", "古街"]):
        return "oldtown"
    if any(k in name for k in ["博物", "纪念", "遗址", "故居"]):
        return "museum"
    if any(k in name for k in ["公园", "园", "林"]):
        return "park"
    return "default"


def _supabase_headers(key: str) -> Dict[str, str]:
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _supabase_fetch_attractions(supabase_url: str, key: str) -> List[Dict[str, Any]]:
    select = "id,name,province,city,image_url,description,features,tips"
    url = f"{supabase_url}/rest/v1/attractions?select={urllib.parse.quote(select)}&order=id.asc&limit=5000"
    return _http_json(url, headers=_supabase_headers(key), timeout=25)


def _supabase_update_image_url(supabase_url: str, key: str, attraction_id: str, image_url: str) -> None:
    url = f"{supabase_url}/rest/v1/attractions?id=eq.{urllib.parse.quote(attraction_id)}"
    _patch_json(url, headers={**_supabase_headers(key), "Prefer": "return=minimal"}, payload={"image_url": image_url}, timeout=25)


def _supabase_bucket_exists(supabase_url: str, key: str, bucket: str) -> bool:
    url = f"{supabase_url}/storage/v1/bucket"
    data = _http_json(url, headers=_supabase_headers(key), timeout=20)
    if isinstance(data, list):
        return any((b.get("id") == bucket or b.get("name") == bucket) for b in data if isinstance(b, dict))
    return False


def _supabase_create_public_bucket(supabase_url: str, key: str, bucket: str) -> None:
    url = f"{supabase_url}/storage/v1/bucket"
    _post_json(url, headers=_supabase_headers(key), payload={"id": bucket, "name": bucket, "public": True}, timeout=25)


def _supabase_upload_public_webp(
    supabase_url: str,
    key: str,
    bucket: str,
    object_path: str,
    content: bytes,
) -> str:
    url = f"{supabase_url}/storage/v1/object/{bucket}/{urllib.parse.quote(object_path)}"
    _put_bytes(
        url,
        headers={
            **_supabase_headers(key),
            "Content-Type": "image/webp",
            "x-upsert": "true",
        },
        payload=content,
        timeout=35,
    )
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{urllib.parse.quote(object_path)}"


def _candidate_pool(item: Dict[str, Any], min_edge: int) -> List[Tuple[str, str, int, int]]:
    name = str(item.get("name") or "").strip()
    clean = _clean_name(name)
    out: List[Tuple[str, str, int, int]] = []

    for lang in ["zh", "en"]:
        for title in [name, clean]:
            if not title:
                continue
            try:
                for u, w, h in _wiki_page_image(title, lang, min_edge=min_edge):
                    if u and not _is_bad_extension(u):
                        out.append(("wiki", u, w, h))
            except Exception:
                pass

    for term in [name, clean, clean[:6]]:
        if not term:
            continue
        try:
            for u, w, h in _commons_search_images(term, min_edge=min_edge, limit=8):
                if u and not _is_bad_extension(u):
                    out.append(("commons", u, w, h))
        except Exception:
            pass

    try:
        og = _baike_og_image(name)
        if og and not _is_bad_extension(og):
            out.append(("baike", og, 0, 0))
    except Exception:
        pass

    try:
        for u in _baidu_image_search(name, limit=8):
            if u and not _is_bad_extension(u):
                out.append(("baidu", u, 0, 0))
    except Exception:
        pass

    seen = set()
    deduped: List[Tuple[str, str, int, int]] = []
    for src, u, w, h in out:
        if u in seen:
            continue
        seen.add(u)
        deduped.append((src, u, w, h))
    return deduped[:28]


def _pick_best(
    candidates: List[Tuple[str, str, int, int]],
    min_edge: int,
    seen_hashes: List[int],
    download_headers: Dict[str, str],
    retries: int,
    backoff: float,
    max_sleep: float,
    jitter: float,
) -> Optional[Candidate]:
    best: Optional[Candidate] = None
    for src, url, w0, h0 in candidates:
        if not url.startswith("http"):
            continue
        if _is_bad_extension(url):
            continue
        try:
            data = _with_retry(
                lambda: _http_bytes(url, headers=download_headers, timeout=20),
                retries=retries,
                backoff=backoff,
                max_sleep=max_sleep,
                jitter=jitter,
                retry_name="download_candidate",
            )
        except Exception:
            continue
        img = _decode_image(data)
        if not img:
            continue
        w, h = img.size
        if max(w, h) < min_edge:
            continue
        score, reason, d, mean_sat, yellow_ratio, map_like = _score_candidate(url, img)
        if reason != "ok":
            continue
        if any(_hamming(d, s) <= 6 for s in seen_hashes):
            continue
        cand = Candidate(
            source=src,
            url=url,
            width=w,
            height=h,
            score=score,
            reason=reason,
            dhash=d,
            mean_sat=mean_sat,
            yellow_ratio=yellow_ratio,
            map_like=map_like,
        )
        if not best or cand.score > best.score:
            best = cand
    return best


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--supabase-url", default=_get_env("VITE_SUPABASE_URL", ""))
    parser.add_argument("--anon-key", default=_get_env("VITE_SUPABASE_ANON_KEY", ""))
    parser.add_argument("--service-role-key", default=_get_env("SUPABASE_SERVICE_ROLE_KEY", ""))
    parser.add_argument("--bucket", default=_get_env("SUPABASE_IMAGE_BUCKET", "attraction-images"))
    parser.add_argument("--min-edge", type=int, default=800)
    parser.add_argument("--max-edge", type=int, default=1600)
    parser.add_argument("--webp-quality", type=int, default=82)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.15)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-backoff", type=float, default=0.8)
    parser.add_argument("--retry-max-sleep", type=float, default=4.0)
    parser.add_argument("--retry-jitter", type=float, default=0.2)
    args = parser.parse_args()

    supabase_url = args.supabase_url.strip().rstrip("/")
    anon_key = args.anon_key.strip()
    service_key = args.service_role_key.strip()
    if not supabase_url or not anon_key:
        print("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY", file=sys.stderr)
        return 2

    update_key = service_key or anon_key
    headers_dl = {"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-CN,zh;q=0.9"}

    attractions = _with_retry(
        lambda: _supabase_fetch_attractions(supabase_url, anon_key),
        retries=args.retries,
        backoff=args.retry_backoff,
        max_sleep=args.retry_max_sleep,
        jitter=args.retry_jitter,
        retry_name="fetch_attractions",
    )
    if not isinstance(attractions, list):
        print("Unexpected attractions response", file=sys.stderr)
        return 2

    if args.start:
        attractions = attractions[args.start :]
    if args.limit and args.limit > 0:
        attractions = attractions[: args.limit]

    bucket_ready = False
    if not args.dry_run:
        try:
            exists = _supabase_bucket_exists(supabase_url, update_key, args.bucket)
            if not exists and service_key:
                _supabase_create_public_bucket(supabase_url, update_key, args.bucket)
                exists = _supabase_bucket_exists(supabase_url, update_key, args.bucket)
            bucket_ready = exists
        except Exception:
            bucket_ready = False

    seen_hashes: List[int] = []
    report: List[Dict[str, Any]] = []

    for idx, item in enumerate(attractions):
        aid = str(item.get("id") or "").strip()
        name = str(item.get("name") or "").strip()
        if not aid or not name:
            continue

        pool = _candidate_pool(item, min_edge=args.min_edge)
        best = _pick_best(pool, min_edge=args.min_edge, seen_hashes=seen_hashes, download_headers=headers_dl, retries=args.retries, backoff=args.retry_backoff, max_sleep=args.retry_max_sleep, jitter=args.retry_jitter)

        chosen_url = ""
        chosen_source = ""
        action = "skip"
        fail_reason = ""

        if best:
            chosen_url = best.url
            chosen_source = best.source
            seen_hashes.append(best.dhash)
            action = "selected" if args.dry_run else action
        else:
            kind = _kind_from_name(name)
            img = _generate_placeholder(name, kind)
            resized = _resize_to_max_edge(img, args.max_edge)
            payload = _encode_webp(resized, quality=args.webp_quality)
            obj_path = f"attractions/{_safe_filename(aid)}/cover.webp"

            if args.dry_run:
                chosen_url = f"generated://{obj_path}"
                chosen_source = "generated"
                action = "generated"
            elif bucket_ready:
                try:
                    public_url = _with_retry(
                        lambda: _supabase_upload_public_webp(supabase_url, update_key, args.bucket, obj_path, payload),
                        retries=args.retries,
                        backoff=args.retry_backoff,
                        max_sleep=args.retry_max_sleep,
                        jitter=args.retry_jitter,
                        retry_name="upload_generated",
                    )
                    chosen_url = public_url
                    chosen_source = "generated"
                    action = "generated_uploaded"
                except Exception as e:
                    chosen_url = ""
                    chosen_source = "generated"
                    action = "generated_failed"
                    fail_reason = str(e)

        if chosen_url and not args.dry_run:
            if chosen_source != "generated" and bucket_ready:
                try:
                    img_bytes = _with_retry(
                        lambda: _http_bytes(chosen_url, headers=headers_dl, timeout=22),
                        retries=args.retries,
                        backoff=args.retry_backoff,
                        max_sleep=args.retry_max_sleep,
                        jitter=args.retry_jitter,
                        retry_name="download_chosen",
                    )
                    img = _decode_image(img_bytes)
                    if img:
                        resized = _resize_to_max_edge(img, args.max_edge)
                        payload = _encode_webp(resized, quality=args.webp_quality)
                        obj_path = f"attractions/{_safe_filename(aid)}/cover.webp"
                        public_url = _with_retry(
                            lambda: _supabase_upload_public_webp(supabase_url, update_key, args.bucket, obj_path, payload),
                            retries=args.retries,
                            backoff=args.retry_backoff,
                            max_sleep=args.retry_max_sleep,
                            jitter=args.retry_jitter,
                            retry_name="upload_chosen",
                        )
                        chosen_url = public_url
                        action = "uploaded"
                    else:
                        action = "external"
                except Exception as e:
                    action = "external"
                    fail_reason = str(e)

            try:
                _with_retry(
                    lambda: _supabase_update_image_url(supabase_url, update_key, aid, chosen_url),
                    retries=args.retries,
                    backoff=args.retry_backoff,
                    max_sleep=args.retry_max_sleep,
                    jitter=args.retry_jitter,
                    retry_name="db_update",
                )
                action = action + "_db_updated"
            except Exception as e:
                action = action + "_db_update_failed"
                fail_reason = str(e)

        report.append(
            {
                "id": aid,
                "name": name,
                "chosen_source": chosen_source,
                "chosen_url": chosen_url,
                "action": action,
                "fail_reason": fail_reason,
                "candidate_count": len(pool),
                "index": idx,
            }
        )

        if args.sleep > 0:
            time.sleep(args.sleep)

    out_path = os.path.join(os.getcwd(), "exports", f"image_refresh_report_{int(time.time())}.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps({"processed": len(report), "report": out_path}, ensure_ascii=False))
    if not args.dry_run and not bucket_ready:
        print(
            json.dumps(
                {
                    "warning": "storage bucket not ready; used external urls where possible",
                    "bucket": args.bucket,
                    "hint": "Set SUPABASE_SERVICE_ROLE_KEY to allow bucket create, or create a public bucket manually."
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
