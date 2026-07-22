"""新聞快照的去重、篩選與公開 JSON 序列化。"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .models import NormalizedItem


RANGE_HOURS = {"1h": 1, "6h": 6, "24h": 24, "7d": 24 * 7}
_TRACKING_KEYS = {"fbclid", "gclid", "ref", "source"}


def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in _TRACKING_KEYS
    ]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, urlencode(query), ""))


def dedupe_items(items: list[NormalizedItem]) -> list[NormalizedItem]:
    """依 canonical URL 去重；相同 URL 保留較新的項目。"""
    chosen: dict[str, NormalizedItem] = {}
    for entry in sorted(items, key=lambda value: value.published_at, reverse=True):
        chosen.setdefault(canonical_url(entry.url), entry)
    return sorted(chosen.values(), key=lambda value: value.published_at, reverse=True)


def filter_items(
    items: list[NormalizedItem], query: str, range_name: str, now: datetime | None = None
) -> list[NormalizedItem]:
    now = now or datetime.now(timezone.utc)
    if range_name not in RANGE_HOURS:
        raise ValueError("INVALID_RANGE")
    needle = query.strip().casefold()
    if len(needle) < 2 or len(needle) > 50:
        raise ValueError("INVALID_QUERY")
    cutoff = now - timedelta(hours=RANGE_HOURS[range_name])
    return [
        entry
        for entry in items
        if entry.published_at >= cutoff and needle in entry.search_text.casefold()
    ]


def item_to_public(entry: NormalizedItem) -> dict:
    digest = hashlib.sha256(f"{entry.source}:{entry.source_item_id}".encode("utf-8")).hexdigest()[:20]
    published = entry.published_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "id": digest,
        "source": entry.source,
        "title": entry.title,
        "excerpt": entry.excerpt[:140] + ("…" if len(entry.excerpt) > 140 else ""),
        "publishedAt": published,
        "url": entry.url,
        "sentiment": None,
    }


def public_to_item(value: dict, now: datetime | None = None) -> NormalizedItem | None:
    try:
        current = now or datetime.now(timezone.utc)
        published = datetime.fromisoformat(str(value["publishedAt"]).replace("Z", "+00:00"))
        if published > current + timedelta(minutes=5):
            corrected = published - timedelta(hours=8)
            if corrected <= current + timedelta(minutes=5):
                published = corrected
        if published > current + timedelta(minutes=5):
            return None
        return NormalizedItem(
            source=str(value["source"]),
            source_item_id=str(value.get("id") or value["url"]),
            title=str(value["title"]),
            excerpt=str(value.get("excerpt") or "")[:140],
            url=str(value["url"]),
            published_at=published,
        )
    except (KeyError, TypeError, ValueError):
        return None
