"""通用 RSS/Atom 連接器。負責擷取、驗證與正規化，單一來源失敗不影響其他來源。"""
from __future__ import annotations

import html
import re
import time
from datetime import datetime, timezone

import feedparser
import requests

from ..models import NormalizedItem, SourceResult

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _clean(text: str, limit: int = 140) -> str:
    """移除 HTML 標籤、還原字元實體、壓縮空白並截斷（避免重製全文）。"""
    if not text:
        return ""
    text = _TAG_RE.sub("", text)
    text = html.unescape(text)
    text = _WS_RE.sub(" ", text).strip()
    if len(text) > limit:
        text = text[:limit].rstrip() + "…"
    return text


def _parse_time(entry) -> datetime:
    for key in ("published_parsed", "updated_parsed"):
        tm = entry.get(key)
        if tm:
            return datetime(*tm[:6], tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def _fetch_bytes(url: str, timeout: int) -> bytes:
    """帶重試的 HTTP 擷取。可重試錯誤最多 3 次；429 遵守 Retry-After。"""
    waits = [2, 5, 12]
    last_exc: Exception | None = None
    for attempt in range(len(waits) + 1):
        try:
            resp = requests.get(
                url,
                timeout=timeout,
                headers={"User-Agent": _UA, "Accept": "application/rss+xml, application/xml, text/xml, */*"},
            )
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                wait = int(retry_after) if (retry_after or "").isdigit() else waits[min(attempt, len(waits) - 1)]
                if attempt < len(waits) and wait <= 30:
                    time.sleep(wait)
                    continue
                raise requests.HTTPError("HTTP_429")
            resp.raise_for_status()
            return resp.content
        except Exception as exc:  # noqa: BLE001 - 交由上層記錄來源錯誤
            last_exc = exc
            if attempt < len(waits):
                time.sleep(waits[attempt])
            else:
                raise
    raise last_exc  # pragma: no cover


def _error_code(exc: Exception) -> str:
    if isinstance(exc, requests.HTTPError):
        resp = getattr(exc, "response", None)
        if resp is not None:
            return f"HTTP_{resp.status_code}"
        return str(exc) or "HTTP_ERROR"
    if isinstance(exc, requests.Timeout):
        return "TIMEOUT"
    if isinstance(exc, requests.ConnectionError):
        return "CONN_ERROR"
    return type(exc).__name__


def fetch_source(source: dict, timeout: int, max_items: int) -> SourceResult:
    """擷取單一 RSS 來源並回傳正規化結果。任何例外都被隔離為該來源的錯誤。"""
    sid, name = source["id"], source["name"]
    if not source.get("enabled") or not source.get("url"):
        return SourceResult(id=sid, name=name, enabled=bool(source.get("enabled")), ok=False, error_code="DISABLED")

    try:
        raw = _fetch_bytes(source["url"], timeout)
    except Exception as exc:  # noqa: BLE001
        return SourceResult(id=sid, name=name, enabled=True, ok=False, error_code=_error_code(exc))

    parsed = feedparser.parse(raw)
    entries = parsed.get("entries") or []
    if not entries:
        return SourceResult(id=sid, name=name, enabled=True, ok=False, error_code="EMPTY_OR_BAD_FEED")

    items: list[NormalizedItem] = []
    for entry in entries[:max_items]:
        link = (entry.get("link") or "").strip()
        title = _clean(entry.get("title", ""), limit=200)
        if not link or not title:
            continue
        items.append(
            NormalizedItem(
                source=sid,
                source_item_id=(entry.get("id") or link).strip(),
                title=title,
                excerpt=_clean(entry.get("summary", ""), limit=140),
                url=link,
                published_at=_parse_time(entry),
            )
        )

    if not items:
        return SourceResult(id=sid, name=name, enabled=True, ok=False, error_code="NO_VALID_ITEMS")
    return SourceResult(id=sid, name=name, enabled=True, ok=True, items=items)
