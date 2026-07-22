from datetime import datetime, timedelta, timezone
from pathlib import Path

from opinion_pipeline.archive import dedupe_items, filter_items, item_to_public
from opinion_pipeline.connectors.trends import parse_trends_feed
from opinion_pipeline.connectors import rss
from opinion_pipeline.models import NormalizedItem


NOW = datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc)


def item(source: str, item_id: str, title: str, age_hours: int, url: str | None = None) -> NormalizedItem:
    return NormalizedItem(
        source=source,
        source_item_id=item_id,
        title=title,
        excerpt="短摘要",
        url=url or f"https://example.com/{item_id}",
        published_at=NOW - timedelta(hours=age_hours),
    )


def test_dedupe_prefers_newer_item_with_same_canonical_url():
    old = item("cna", "old", "舊標題", 5, "https://example.com/story?utm_source=rss")
    new = item("ltn", "new", "新標題", 1, "https://example.com/story")

    result = dedupe_items([old, new])

    assert len(result) == 1
    assert result[0].title == "新標題"


def test_filter_items_matches_title_or_excerpt_and_enforces_range():
    recent = item("cna", "1", "台積電法說會", 2)
    old = item("ltn", "2", "台積電歷史回顧", 30)
    unrelated = item("tvbs", "3", "氣象快訊", 1)

    result = filter_items([recent, old, unrelated], "台積電", "24h", NOW)

    assert [entry.source_item_id for entry in result] == ["1"]


def test_public_item_never_contains_full_content_field():
    public = item_to_public(item("cna", "1", "測試新聞", 1))

    assert set(public) == {"id", "source", "title", "excerpt", "publishedAt", "url", "sentiment"}
    assert len(public["excerpt"]) <= 141


def test_parse_google_trends_tw_rss():
    raw = Path("tests/fixtures/google_trends_tw.xml").read_bytes()

    items = parse_trends_feed(raw)

    assert items[0]["title"] == "台灣颱風"
    assert items[0]["approximateTraffic"] == "20,000+"
    assert items[0]["news"][0]["source"] == "中央社"
    assert items[0]["news"][0]["url"] == "https://example.com/news/1"


def test_one_rss_failure_is_returned_as_source_error(monkeypatch):
    def fail(*_args, **_kwargs):
        raise rss.requests.Timeout("timeout")

    monkeypatch.setattr(rss, "_fetch_bytes", fail)
    result = rss.fetch_source(
        {"id": "cna", "name": "中央通訊社", "enabled": True, "url": "https://example.com/rss"},
        timeout=1,
        max_items=20,
    )

    assert result.ok is False
    assert result.error_code == "TIMEOUT"
    assert result.items == []
