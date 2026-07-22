import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

test('health endpoint returns schema v2 and localhost CORS', async () => {
  const request = new Request('https://worker.example/api/health', {
    headers: { Origin: 'http://localhost:5173' },
  });
  const response = await worker.fetch(request, {});
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
  assert.equal(body.schemaVersion, '2.0.0');
  assert.equal(body.data.status, 'ok');
});

test('search endpoint rejects an invalid query before upstream requests', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/search?q=台&range=24h'), {});
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'INVALID_QUERY' });
});

test('non-read methods are rejected', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/health', { method: 'POST' }), {});
  assert.equal(response.status, 405);
});

test('24h search merges Google News results with the low-frequency Pages snapshot', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('news.google.com/rss/search')) {
      return new Response(`<rss><channel><item><guid>g1</guid><title>台積電三立快訊</title>
        <link>https://news.google.com/rss/articles/g1</link>
        <pubDate>Wed, 22 Jul 2026 12:00:00 GMT</pubDate>
        <source url="https://www.setn.com">三立新聞網</source></item></channel></rss>`);
    }
    if (url.endsWith('/data/news-archive.json')) {
      return Response.json({ data: { items: [{
        id: 'archive-ebc-1', source: 'ebc', title: '台積電東森追蹤', excerpt: '',
        publishedAt: '2026-07-22T11:00:00.000Z', url: 'https://news.ebc.net.tw/news/1', sentiment: null,
      }] } });
    }
    return new Response('<rss><channel></channel></rss>');
  };

  try {
    const response = await worker.fetch(
      new Request('https://worker.example/api/search?q=台積電&range=24h'),
      { ARCHIVE_BASE_URL: 'https://pages.example' },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.sources.length, 22);
    assert.deepEqual(new Set(body.data.items.map((item) => item.source)), new Set(['setn', 'ebc']));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('trends endpoint preserves related news from publishers outside the 22-source registry', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`<rss xmlns:ht="https://trends.google.com/trending/rss"><channel><item>
    <title>short selling</title><ht:approx_traffic>200+</ht:approx_traffic>
    <pubDate>Wed, 22 Jul 2026 12:00:00 GMT</pubDate>
    <ht:news_item><ht:news_item_title>Daily market report</ht:news_item_title>
    <ht:news_item_url>https://external.example/story/1</ht:news_item_url>
    <ht:news_item_source>External Finance</ht:news_item_source></ht:news_item>
  </item></channel></rss>`);
  try {
    const response = await worker.fetch(new Request('https://worker.example/api/trends'), {});
    const body = await response.json();
    assert.equal(body.data.items[0].news.length, 1);
    assert.equal(body.data.items[0].news[0].source, 'External Finance');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
