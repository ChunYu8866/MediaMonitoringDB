from datetime import datetime, timezone

from opinion_pipeline import cli
from opinion_pipeline.models import NormalizedItem


NOW = datetime(2026, 7, 22, 14, 0, tzinfo=timezone.utc)


def article(source: str, title: str, excerpt: str, url: str) -> NormalizedItem:
    return NormalizedItem(
        source=source,
        source_item_id=url,
        title=title,
        excerpt=excerpt,
        url=url,
        published_at=NOW,
    )


def test_topics_use_real_archive_text_and_urls_for_traceable_sentences():
    source_excerpt = "立法院今日審查預算，朝野立委進行質詢。"
    source_url = "https://news.ltn.com.tw/news/politics/breakingnews/1234567"

    topics = cli.build_topics([
        article("ltn", "立法院審查年度預算", source_excerpt, source_url),
    ])

    assert len(topics) == 1
    assert topics[0]["summarySentences"] == [
        {"text": source_excerpt, "source": "ltn", "url": source_url}
    ]
    assert topics[0]["articles"][0]["url"] == source_url
    assert "sample" not in topics[0]["articles"][0]["url"]


def test_topics_fall_back_to_exact_source_title_when_excerpt_is_empty():
    title = "颱風海上警報最新動態"
    url = "https://www.ettoday.net/news/20260722/1234567.htm"

    topics = cli.build_topics([article("ettoday", title, "", url)])

    assert topics[0]["summarySentences"][0]["text"] == title
    assert topics[0]["summarySentences"][0]["url"] == url
