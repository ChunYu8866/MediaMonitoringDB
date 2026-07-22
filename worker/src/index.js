import {
  calculateMetrics,
  filterAndDedupe,
  normalizeCurrents,
  parseRss,
  parseTrendsRss,
  timelineFor,
  validateQuery,
} from './core.js';

const SOURCES = [
  ['cna', '中央通訊社', 'https://feeds.feedburner.com/cnaFirstNews'],
  ['ltn', '自由時報', 'https://news.ltn.com.tw/rss/all.xml'],
  ['ettoday', 'ETtoday 新聞雲', 'https://feeds.feedburner.com/ettoday/realtime'],
  ['mirror', '鏡傳媒', 'https://www.mirrormedia.mg/rss/rss.xml'],
  ['tvbs', 'TVBS 新聞網', 'https://cc.tvbs.com.tw/rss/text/realtime'],
];
const TRENDS_URL = 'https://trends.google.com/trending/rss?geo=TW&hl=zh-TW';

const envelope = (data) => ({ schemaVersion: '2.0.0', generatedAt: new Date().toISOString(), data });

const corsHeaders = (request, env) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGIN || 'https://chunyu8866.github.io';
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': origin === allowed || isLocal ? origin : allowed,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
};

const json = (request, env, body, status = 200, cacheSeconds = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
      ...corsHeaders(request, env),
    },
  });

async function fetchText(url, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function fetchCurrents(query, apiKey) {
  const url = new URL('https://api.currentsapi.services/v1/search');
  url.searchParams.set('keywords', query);
  url.searchParams.set('language', 'zh');
  url.searchParams.set('apiKey', apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return normalizeCurrents(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

async function archiveItems(env) {
  const base = env.ARCHIVE_BASE_URL || 'https://chunyu8866.github.io/MediaMonitoringDB';
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/data/news-archive.json`);
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.data?.items) ? body.data.items : [];
  } catch {
    return [];
  }
}

async function handleSearch(request, env, url) {
  let input;
  try {
    input = validateQuery(url.searchParams.get('q'), url.searchParams.get('range') || '24h');
  } catch (error) {
    return json(request, env, { error: error.message }, 400);
  }

  const runs = await Promise.all(
    SOURCES.map(async ([id, displayName, feedUrl]) => {
      try {
        const items = parseRss(await fetchText(feedUrl), id);
        return { id, displayName, status: 'ok', itemCount: items.length, errorCode: null, items };
      } catch (error) {
        return { id, displayName, status: 'error', itemCount: 0, errorCode: error.message || 'FETCH_ERROR', items: [] };
      }
    }),
  );
  if (env.CURRENTS_API_KEY) {
    try {
      const items = await fetchCurrents(input.query, env.CURRENTS_API_KEY);
      runs.push({ id: 'currents', displayName: 'Currents API（選配）', status: 'ok', itemCount: items.length, errorCode: null, items });
    } catch (error) {
      runs.push({ id: 'currents', displayName: 'Currents API（選配）', status: 'error', itemCount: 0, errorCode: error.message || 'FETCH_ERROR', items: [] });
    }
  } else {
    runs.push({ id: 'currents', displayName: 'Currents API（選配）', status: 'disabled', itemCount: 0, errorCode: null, items: [] });
  }

  const liveItems = runs.flatMap((run) => run.items);
  const archived = input.range === '7d' || liveItems.length === 0 ? await archiveItems(env) : [];
  const items = filterAndDedupe([...liveItems, ...archived], input.query, input.range).slice(0, 100);
  const enabledCount = runs.filter((run) => run.status !== 'disabled').length;
  const failures = runs.filter((run) => run.status === 'error').length;
  const stale = liveItems.length === 0 && archived.length > 0;
  const status = stale ? 'stale' : failures ? 'partial' : 'ok';
  const sourceCounts = Object.fromEntries(
    [...new Set(items.map((item) => item.source))].map((source) => [source, items.filter((item) => item.source === source).length]),
  );
  const data = {
    query: input.query,
    range: input.range,
    status,
    stale,
    metrics: calculateMetrics(items, input.range, Date.now(), enabledCount),
    timeline: timelineFor(items, input.range),
    sourceCounts,
    sources: runs.map(({ items: _items, ...source }) => source),
    items,
  };
  return json(request, env, envelope(data), 200, 120);
}

async function handleTrends(request, env) {
  try {
    const items = parseTrendsRss(await fetchText(TRENDS_URL));
    return json(
      request,
      env,
      envelope({ geo: 'TW', status: 'ok', stale: false, source: 'google-trends-rss', sourceUrl: TRENDS_URL, items }),
      200,
      600,
    );
  } catch {
    const base = env.ARCHIVE_BASE_URL || 'https://chunyu8866.github.io/MediaMonitoringDB';
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/data/trends.json`);
      const previous = await response.json();
      previous.data.status = 'stale';
      previous.data.stale = true;
      return json(request, env, previous, 200, 60);
    } catch {
      return json(request, env, { error: 'TRENDS_UNAVAILABLE' }, 503);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (!['GET', 'HEAD'].includes(request.method)) return json(request, env, { error: 'METHOD_NOT_ALLOWED' }, 405);
    const url = new URL(request.url);
    const cacheable = request.method === 'GET' && ['/api/search', '/api/trends'].includes(url.pathname);
    const origin = request.headers.get('Origin') || '';
    const localRequest = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cache = cacheable && !localRequest ? globalThis.caches?.default : null;
    if (cache) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    let response;
    if (url.pathname === '/api/search') response = await handleSearch(request, env, url);
    else if (url.pathname === '/api/trends') response = await handleTrends(request, env);
    if (response) {
      if (cache && response.ok) ctx?.waitUntil(cache.put(request, response.clone()));
      return response;
    }
    if (url.pathname === '/api/health') return json(request, env, envelope({ status: 'ok' }), 200, 60);
    return json(request, env, { error: 'NOT_FOUND' }, 404);
  },
};
