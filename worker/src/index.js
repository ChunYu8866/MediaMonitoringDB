import {
  calculateMetrics,
  filterAndDedupe,
  parseGoogleNewsRss,
  parseGoogleNewsMetadata,
  parseRss,
  parseTrendsRss,
  timelineFor,
  validateQuery,
} from './core.js';
import { NEWS_SOURCES } from './sources.js';

const TRENDS_URL = 'https://trends.google.com/trending/rss?geo=TW&hl=zh-TW';
const googleNewsUrl = (query) => {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'zh-TW');
  url.searchParams.set('gl', 'TW');
  url.searchParams.set('ceid', 'TW:zh-Hant');
  return url.toString();
};

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

async function fetchText(url, attempts = 2, timeoutMs = 5_000) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'zh-TW,zh;q=0.9',
          'User-Agent': 'MediaMonitoringDemo/1.0 (+https://chunyu8866.github.io/MediaMonitoringDB/)',
        },
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

  const officialRuns = await Promise.all(
    NEWS_SOURCES.filter((source) => source.rssUrl).map(async (source) => {
      try {
        const items = parseRss(await fetchText(source.rssUrl), source.id);
        return { id: source.id, displayName: source.displayName, status: 'ok', itemCount: items.length, errorCode: null, items };
      } catch (error) {
        return { id: source.id, displayName: source.displayName, status: 'error', itemCount: 0, errorCode: error.message || 'FETCH_ERROR', items: [] };
      }
    }),
  );
  let googleItems = [];
  let googleError = null;
  try {
    googleItems = parseGoogleNewsRss(await fetchText(googleNewsUrl(input.query), 1, 4_000), NEWS_SOURCES);
  } catch (error) {
    googleError = error.message || 'GOOGLE_NEWS_FETCH_ERROR';
  }
  const officialById = new Map(officialRuns.map((run) => [run.id, run]));
  const runs = NEWS_SOURCES.map((source) => {
    const official = officialById.get(source.id);
    const supplemental = googleItems.filter((item) => item.source === source.id);
    if (!official) {
      return {
        id: source.id,
        displayName: source.displayName,
        status: googleError ? 'error' : 'ok',
        itemCount: supplemental.length,
        errorCode: googleError,
        items: supplemental,
      };
    }
    if (official.status === 'error' && supplemental.length) {
      return { ...official, status: 'degraded', itemCount: supplemental.length, errorCode: official.errorCode, items: supplemental };
    }
    return { ...official, items: [...official.items, ...supplemental], itemCount: official.items.length + supplemental.length };
  });

  const liveItems = runs.flatMap((run) => run.items);
  const archived = await archiveItems(env);
  const items = filterAndDedupe([...liveItems, ...archived], input.query, input.range).slice(0, 100);
  const enabledCount = NEWS_SOURCES.length;
  const failures = runs.filter((run) => ['error', 'degraded'].includes(run.status)).length;
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
  return json(request, env, envelope(data));
}

async function handleTrends(request, env) {
  try {
    const items = parseTrendsRss(await fetchText(TRENDS_URL));
    return json(
      request,
      env,
      envelope({ geo: 'TW', status: 'ok', stale: false, source: 'google-trends-rss', sourceUrl: TRENDS_URL, items }),
      200,
      60,
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

async function handleTrendNews(request, env, url) {
  const query = String(url.searchParams.get('q') || '').trim();
  if (query.length < 1 || query.length > 100) return json(request, env, { error: 'INVALID_QUERY' }, 400);
  try {
    const items = parseGoogleNewsMetadata(await fetchText(googleNewsUrl(query), 2, 8_000), 10);
    return json(request, env, envelope({ query, source: 'google-news-rss', items }));
  } catch {
    return json(request, env, { error: 'TREND_NEWS_UNAVAILABLE' }, 503);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (!['GET', 'HEAD'].includes(request.method)) return json(request, env, { error: 'METHOD_NOT_ALLOWED' }, 405);
    const url = new URL(request.url);
    const cacheable = request.method === 'GET' && url.pathname === '/api/trends';
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
    else if (url.pathname === '/api/trend-news') response = await handleTrendNews(request, env, url);
    if (response) {
      if (cache && response.ok) ctx?.waitUntil(cache.put(request, response.clone()));
      return response;
    }
    if (url.pathname === '/api/health') return json(request, env, envelope({ status: 'ok' }), 200, 60);
    return json(request, env, { error: 'NOT_FOUND' }, 404);
  },
};
