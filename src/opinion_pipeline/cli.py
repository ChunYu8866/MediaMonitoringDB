"""GitHub Actions 使用的免費 RSS 快照產生器。"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
import yaml

from .archive import dedupe_items, item_to_public, public_to_item
from .connectors.html_listing import crawl_due, fetch_listing_source
from .connectors.rss import _fetch_bytes, fetch_source
from .connectors.trends import parse_trends_feed
from .models import SourceResult
from .sources import load_sources


TRENDS_URL = "https://trends.google.com/trending/rss?geo=TW&hl=zh-TW"


def envelope(data: dict, generated_at: str) -> dict:
    return {"schemaVersion": "2.0.0", "generatedAt": generated_at, "data": data}


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def keep_allowed_sources(items: list, source_ids: set[str]) -> list:
    """Avoid restoring publishers that are no longer in the configured allowlist."""
    return [item for item in items if item.source in source_ids]


def filter_trends_news(items: list[dict], sources: list[dict]) -> list[dict]:
    """Keep only requested publishers inside Google Trends related-news metadata."""
    domains = {domain.lower() for source in sources for domain in source.get("domains", [])}
    for item in items:
        item["news"] = [
            news
            for news in item.get("news", [])
            if (hostname := urlparse(news.get("url", "")).hostname)
            and any(hostname.lower() == domain or hostname.lower().endswith(f".{domain}") for domain in domains)
        ]
    return items


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
        trends_items = filter_trends_news(parse_trends_feed(_fetch_bytes(TRENDS_URL, timeout))[:20], sources)
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
                "lastDeepAt": None,
                "lastSeoAt": None,
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
