"""GitHub Actions 使用的免費 RSS 快照產生器。"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
import yaml

from .archive import dedupe_items, item_to_public, public_to_item
from .connectors.html_listing import crawl_due, fetch_listing_source
from .connectors.rss import _fetch_bytes, fetch_source
from .connectors.trends import parse_trends_feed
from .models import SourceResult
from .sources import load_sources


TRENDS_URL = "https://trends.google.com/trending/rss?geo=TW&hl=zh-TW"

TOPIC_DEFINITIONS = (
    ("finance", "財經與產業", ("台積電", "半導體", "股市", "經濟", "產業")),
    ("weather", "天氣與防災", ("颱風", "豪雨", "氣象", "地震", "防災")),
    ("politics", "政治與公共政策", ("立法院", "立委", "行政院", "總統", "預算", "政黨")),
    ("society", "社會與生活", ("社會", "交通", "醫療", "健康", "教育", "食安")),
    ("world", "國際與兩岸", ("美國", "中國", "國際", "兩岸", "日本", "歐洲")),
)


def envelope(data: dict, generated_at: str) -> dict:
    return {"schemaVersion": "2.0.0", "generatedAt": generated_at, "data": data}


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def keep_allowed_sources(items: list, source_ids: set[str]) -> list:
    """Avoid restoring publishers that are no longer in the configured allowlist."""
    return [item for item in items if item.source in source_ids]


def prepare_trends_items(items: list[dict]) -> list[dict]:
    """Keep Google Trends related-news metadata separate from the 22-source analysis."""
    return items


def build_topics(items: list) -> list[dict]:
    """Build transparent keyword groups from real archive metadata only."""
    topics = []
    for topic_id, label, terms in TOPIC_DEFINITIONS:
        matched = [item for item in items if any(term.casefold() in item.search_text.casefold() for term in terms)]
        if not matched:
            continue
        summaries = []
        for item in matched:
            text = item.excerpt.strip() or item.title.strip()
            if text:
                summaries.append({"text": text, "source": item.source, "url": item.url})
            if len(summaries) == 2:
                break
        topics.append(
            {
                "id": topic_id,
                "label": label,
                "terms": list(terms),
                "size": len(matched),
                "sentiment": {"positive": 0.0, "neutral": 1.0, "negative": 0.0},
                "summarySentences": summaries,
                "articles": [
                    {
                        "title": item.title,
                        "source": item.source,
                        "url": item.url,
                        "publishedAt": item.published_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                    }
                    for item in matched[:5]
                ],
            }
        )
    return topics


def restore_items(base_url: str) -> list:
    if not base_url:
        return []
    try:
        response = requests.get(f"{base_url.rstrip('/')}/data/news-archive.json", timeout=10)
        response.raise_for_status()
        values = response.json().get("data", {}).get("items", [])
        return [entry for value in values if (entry := public_to_item(value)) is not None]
    except (requests.RequestException, ValueError, TypeError):
        return []


def restore_source_states(base_url: str) -> dict[str, dict]:
    if not base_url:
        return {}
    try:
        response = requests.get(f"{base_url.rstrip('/')}/data/sources.json", timeout=10)
        response.raise_for_status()
        values = response.json().get("data", {}).get("sources", [])
        return {value["id"]: value for value in values if isinstance(value, dict) and value.get("id")}
    except (requests.RequestException, ValueError, TypeError):
        return {}


def _previous_result(source: dict, state: dict | None) -> SourceResult:
    if not state:
        return SourceResult(id=source["id"], name=source["name"], enabled=True, ok=True)
    ok = state.get("status") in {"ok", "stale", "degraded"}
    return SourceResult(
        id=source["id"],
        name=source["name"],
        enabled=True,
        ok=ok,
        error_code=None if ok else state.get("errorCode"),
    )


def run(config_path: Path, output_dir: Path, restore_base_url: str = "") -> int:
    now = datetime.now(timezone.utc)
    generated_at = now.isoformat().replace("+00:00", "Z")
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    sources = load_sources(config_path)
    sources_by_id = {source["id"]: source for source in sources}
    fetch_cfg = config.get("fetch", {})
    timeout = int(fetch_cfg.get("timeout_seconds", 10))
    max_items = int(fetch_cfg.get("max_items_per_source", 20))

    restored_states = restore_source_states(restore_base_url)
    results: list[SourceResult] = []
    crawl_attempted: set[str] = set()
    for source in sources:
        state = restored_states.get(source["id"])
        rss_result = fetch_source(source, timeout, max_items) if source.get("rss_url") else None
        result = rss_result
        crawl = source.get("crawl") or {}
        last_crawl_at = state.get("lastCrawlAt") if state else None
        should_try_crawl = bool(crawl.get("enabled")) and (rss_result is None or not rss_result.ok)
        if should_try_crawl and crawl_due(last_crawl_at, now):
            crawl_attempted.add(source["id"])
            listing_result = fetch_listing_source(source, timeout, max_items)
            if listing_result.ok or result is None:
                result = listing_result
        elif result is None:
            result = _previous_result(source, state)
        results.append(result or _previous_result(source, state))
    current_items = [entry for result in results for entry in result.items]
    restored_items = keep_allowed_sources(restore_items(restore_base_url), set(sources_by_id))
    cutoff = now - timedelta(days=7)
    items = [entry for entry in dedupe_items(current_items + restored_items) if entry.published_at >= cutoff]
    enabled_results = [result for result in results if result.enabled]
    ok_count = sum(1 for result in enabled_results if result.ok)
    archive_status = "ok" if ok_count == len(enabled_results) else ("partial" if ok_count else "stale")
    stale = not current_items and bool(restored_items)

    write_json(
        output_dir / "news-archive.json",
        envelope({"status": archive_status, "stale": stale, "items": [item_to_public(entry) for entry in items]}, generated_at),
    )
    write_json(
        output_dir / "recent.json",
        envelope({"items": [item_to_public(entry) for entry in items[:100]]}, generated_at),
    )
    topics = build_topics(items)
    write_json(
        output_dir / "topics.json",
        envelope({"stale": stale, "experimental": True, "topics": topics}, generated_at),
    )
    write_json(
        output_dir / "sources.json",
        envelope(
            {
                "sources": [
                    {
                        "id": result.id,
                        "displayName": result.name,
                        "status": (
                            "ok"
                            if result.ok
                            else "disabled"
                            if not result.enabled
                            else "degraded"
                            if not sources_by_id[result.id].get("rss_url")
                            else "error"
                        ),
                        "lastAttemptAt": generated_at if result.enabled else None,
                        "lastSuccessAt": generated_at if result.ok else restored_states.get(result.id, {}).get("lastSuccessAt"),
                        "lastCrawlAt": generated_at if result.id in crawl_attempted else restored_states.get(result.id, {}).get("lastCrawlAt"),
                        "errorCode": result.error_code,
                        "stale": not result.ok,
                        "itemCount": sum(1 for item in items if item.source == result.id),
                        "accessMode": (
                            "site-listing"
                            if result.id in crawl_attempted and result.ok
                            else "official-rss"
                            if sources_by_id[result.id].get("rss_url")
                            else restored_states.get(result.id, {}).get("accessMode", "google-news")
                        ),
                        "usageNote": "僅顯示標題、短摘要、時間與原文連結；不抓取全文或圖片。",
                    }
                    for result in results
                ]
            },
            generated_at,
        ),
    )

    trends_stale = False
    try:
        trends_items = prepare_trends_items(parse_trends_feed(_fetch_bytes(TRENDS_URL, timeout))[:20])
    except Exception:  # noqa: BLE001 - 趨勢失敗不阻擋新聞部署
        trends_items = []
        previous = output_dir / "trends.json"
        if previous.exists():
            try:
                trends_items = json.loads(previous.read_text(encoding="utf-8"))["data"]["items"]
            except (KeyError, TypeError, ValueError):
                trends_items = []
        trends_stale = True
    write_json(
        output_dir / "trends.json",
        envelope(
            {
                "geo": "TW",
                "status": "stale" if trends_stale else "ok",
                "stale": trends_stale,
                "source": "google-trends-rss",
                "sourceUrl": TRENDS_URL,
                "items": trends_items,
            },
            generated_at,
        ),
    )
    write_json(
        output_dir / "meta.json",
        envelope(
            {
                "status": archive_status,
                "lastFastAt": generated_at if current_items else None,
                "lastDeepAt": generated_at if topics else None,
                "methodVersion": "news-heat-v2-22-sources",
                "scheduleDaysUntilPause": None,
                "coverage": {"fastBucketHours": 24, "hourlyDays": 7, "dailyDays": 7},
                "stateRestoreFailed": not bool(restored_items) and bool(restore_base_url),
            },
            generated_at,
        ),
    )
    return 0 if current_items else 2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/sources.yml")
    parser.add_argument("--output", default="web/public/data")
    parser.add_argument("--restore-base-url", default="")
    args = parser.parse_args()
    return run(Path(args.config), Path(args.output), args.restore_base_url)


if __name__ == "__main__":
    raise SystemExit(main())
