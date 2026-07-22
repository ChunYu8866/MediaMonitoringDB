import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateMetrics,
  filterAndDedupe,
  normalizePublishedAt,
  matchesQuery,
  parseGoogleNewsRss,
  parseRss,
  parseTrendsRss,
  validateQuery,
} from '../src/core.js';
import { NEWS_SOURCES } from '../src/sources.js';

const EXPECTED_SOURCE_IDS = [
  'tvbs', 'ebc', 'setn', 'ftv', 'cti', 'era', 'nexttv', 'pts', 'ttv', 'cts', 'udn', 'ltn', 'cna',
  'moneyudn', 'ctee', 'anue', 'wealth', 'businessweekly', 'thenewslens', 'reporter',
  'newtalk', 'nownews', 'nextapple', 'ettoday',
];

test('news source registry contains exactly the requested 24 publishers', () => {
  assert.deepEqual(NEWS_SOURCES.map((source) => source.id), EXPECTED_SOURCE_IDS);
  assert.equal(new Set(NEWS_SOURCES.flatMap((source) => source.domains)).size >= 24, true);
});

test('parseGoogleNewsRss keeps only allowlisted publishers and normalizes source ids', () => {
  const xml = `<rss><channel>
    <item><guid>a</guid><title>台積電三立新聞</title>
      <link>https://news.google.com/rss/articles/a</link>
      <pubDate>Wed, 22 Jul 2026 08:00:00 GMT</pubDate>
      <description>三立短摘要</description><source url="https://www.setn.com">三立新聞網</source>
    </item>
    <item><guid>b</guid><title>不在白名單</title>
      <link>https://news.google.com/rss/articles/b</link>
      <pubDate>Wed, 22 Jul 2026 08:00:00 GMT</pubDate>
      <source url="https://example.com">未知媒體</source>
    </item>
  </channel></rss>`;

  const items = parseGoogleNewsRss(xml, NEWS_SOURCES);

  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'setn');
  assert.equal(items[0].title, '台積電三立新聞');
  assert.equal('content' in items[0], false);
});

test('validateQuery accepts 2 to 50 characters and known ranges', () => {
  assert.deepEqual(validateQuery(' 台積電 ', '24h'), { query: '台積電', range: '24h' });
  assert.throws(() => validateQuery('台', '24h'), /INVALID_QUERY/);
  assert.throws(() => validateQuery('台積電', '30d'), /INVALID_RANGE/);
});

test('matchesQuery supports AND, OR, NOT, minus exclusions, and quoted phrases', () => {
  assert.equal(matchesQuery('台積電法說會展望成長', '台積電 AND "法說會"'), true);
  assert.equal(matchesQuery('聯發科新品發表', '台積電 OR 聯發科'), true);
  assert.equal(matchesQuery('台積電股價下跌', '台積電 NOT 股價'), false);
  assert.equal(matchesQuery('台積電徵才消息', '台積電 -徵才'), false);
});

test('parseRss keeps only public metadata and canonicalizes URLs', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <guid>story-1</guid><title><![CDATA[台積電法說會]]></title>
    <description><![CDATA[<p>營運展望摘要</p>]]></description>
    <link>https://example.com/story?utm_source=rss</link>
    <pubDate>Wed, 22 Jul 2026 08:00:00 GMT</pubDate>
  </item></channel></rss>`;

  const items = parseRss(xml, 'cna');

  assert.equal(items[0].url, 'https://example.com/story');
  assert.equal(items[0].excerpt, '營運展望摘要');
  assert.equal('content' in items[0], false);
});

test('normalizes Taiwan local time mislabeled as GMT when it lands in the future', () => {
  const now = Date.parse('2026-07-22T15:00:00Z');
  assert.equal(normalizePublishedAt('Wed, 22 Jul 2026 21:43:00 GMT', now), '2026-07-22T13:43:00.000Z');
});

test('parseRss discards items without a valid publication time', () => {
  const xml = '<rss><channel><item><guid>x</guid><title>無時間新聞</title><link>https://example.com/x</link></item></channel></rss>';
  assert.deepEqual(parseRss(xml, 'cna'), []);
});

test('filterAndDedupe corrects a future timestamp restored from an old snapshot', () => {
  const now = Date.parse('2026-07-22T15:00:00Z');
  const items = [{ id: 'old', source: 'setn', title: '委內瑞拉雙震', excerpt: '', publishedAt: '2026-07-22T21:43:00Z', url: 'https://example.com/story' }];
  const result = filterAndDedupe(items, '委內瑞拉', '24h', now);
  assert.equal(result[0].publishedAt, '2026-07-22T13:43:00.000Z');
});

test('calculateMetrics uses 50/33/17 news-only heat weights', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  const items = [
    { source: 'cna', publishedAt: '2026-07-22T11:50:00Z' },
    { source: 'ltn', publishedAt: '2026-07-22T11:40:00Z' },
  ];

  const metrics = calculateMetrics(items, '1h', now, 4);

  assert.equal(metrics.mentions, 2);
  assert.equal(metrics.sourceCount, 2);
  assert.equal(metrics.heat, 67);
});

test('calculateMetrics returns zero heat for zero news volume', () => {
  assert.equal(calculateMetrics([], '24h', Date.now(), 5).heat, 0);
});

test('parseTrendsRss reads Taiwan Trending Now RSS and preserves all related news', () => {
  const xml = `<rss xmlns:ht="https://trends.google.com/trending/rss"><channel><item>
    <title>台灣 颱風</title><ht:approx_traffic>20,000+</ht:approx_traffic>
    <pubDate>Wed, 22 Jul 2026 08:00:00 GMT</pubDate>
    <ht:news_item><ht:news_item_title>颱風最新動態</ht:news_item_title>
    <ht:news_item_url>https://example.com/1</ht:news_item_url>
    <ht:news_item_source>中央社</ht:news_item_source></ht:news_item>
    <ht:news_item><ht:news_item_title>不在白名單</ht:news_item_title>
    <ht:news_item_url>https://unknown.example/2</ht:news_item_url>
    <ht:news_item_source>未知</ht:news_item_source></ht:news_item>
  </item></channel></rss>`;

  const result = parseTrendsRss(xml);

  assert.equal(result[0].title, '台灣颱風');
  assert.equal(result[0].approximateTraffic, '20,000+');
  assert.equal(result[0].news[0].source, '中央社');
  assert.equal(result[0].news.length, 2);
});
