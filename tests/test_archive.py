from datetime import datetime, timedelta, timezone
from pathlib import Path

from opinion_pipeline.archive import dedupe_items, filter_items, item_to_public
from opinion_pipeline import cli
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


def test_trends_related_news_is_restricted_to_requested_publishers():
    items = [{"title": "熱門", "news": [
        {"title": "保留", "url": "https://news.tvbs.com.tw/politics/1"},
        {"title": "移除", "url": "https://example.com/news/2"},
    ]}]

    filtered = cli.filter_trends_news(items, [{"domains": ["news.tvbs.com.tw"]}])

    assert [entry["title"] for entry in filtered[0]["news"]] == ["保留"]


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


def test_rss_source_accepts_the_shared_registry_rss_url(monkeypatch):
    raw = """<?xml version="1.0"?><rss><channel><item>
      <guid>story-1</guid><title>台積電新聞</title>
      <link>https://example.com/story-1</link>
      <pubDate>Wed, 22 Jul 2026 08:00:00 GMT</pubDate>
    </item></channel></rss>""".encode("utf-8")
    monkeypatch.setattr(rss, "_fetch_bytes", lambda *_args, **_kwargs: raw)

    result = rss.fetch_source(
        {"id": "cna", "name": "中央社", "rss_url": "https://example.com/rss"},
        timeout=1,
        max_items=20,
    )

    assert result.enabled is True
    assert result.ok is True
    assert result.items[0].title == "台積電新聞"


def test_restore_items_returns_empty_list_when_snapshot_is_unavailable(monkeypatch):
    monkeypatch.setattr(cli.requests, "get", lambda *_args, **_kwargs: (_ for _ in ()).throw(cli.requests.ConnectionError()))

    assert cli.restore_items("https://pages.example") == []


def test_restored_items_are_restricted_to_current_source_allowlist():
    allowed = item("tvbs", "1", "保留", 1)
    removed = item("mirror", "2", "移除", 1)

    assert cli.keep_allowed_sources([allowed, removed], {"tvbs"}) == [allowed]
