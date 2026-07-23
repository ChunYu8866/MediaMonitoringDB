import {
  calculateMetrics,
  dedupeSnapshot,
  filterAndDedupe,
  parseGoogleNewsRss,
  parseRss,
  parseTrendsRss,
  timelineFor,
  validateQuery,
} from './core.js';
import { buildEntities, buildKeywords, buildTopics } from './analysis.js';
import { NEWS_SOURCES } from './sources.js';

const TRENDS_URL = 'https://trends.google.com/trending/rss?geo=TW&hl=zh-TW';
const SNAPSHOT_SCHEMA = '2.1.0';
const SNAPSHOT_KEY = 'snapshot';
const DAY_MS = 86_400_000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DATA_FILES = new Set(['meta', 'keywords', 'sources', 'recent', 'entities', 'topics', 'news-archive']);
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

async function readSnapshot(env) {
  try {
    const raw = await env.SNAPSHOT?.get(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const snapshotEnvelope = (data, generatedAt) => ({ schemaVersion: SNAPSHOT_SCHEMA, generatedAt, data });

// Cron 只即時抓官方 RSS（10 家），把 subrequest 控制在 Worker 免費層 50 上限內。
// 無官方 RSS 的來源交給合併的 Pages archive（Actions 以未被限流的 IP 補齊），
// 這些來源標記 viaPages，狀態依合併庫是否有近況決定，避免 Google News 對 Worker 限流。
async function fetchSourceItems(source) {
  if (!source.rssUrl) return { items: [], accessMode: 'google-news', ok: false, errorCode: null, viaPages: true };
  try {
    const items = parseRss(await fetchText(source.rssUrl), source.id);
    if (items.length) return { items, accessMode: 'official-rss', ok: true, errorCode: null, viaPages: false };
    return { items: [], accessMode: 'official-rss', ok: false, errorCode: 'NO_VALID_ITEMS', viaPages: false };
  } catch (error) {
    return { items: [], accessMode: 'official-rss', ok: false, errorCode: error.message || 'FETCH_ERROR', viaPages: false };
  }
}

/** 每 5 分鐘由 Cron 觸發：抓 24 家來源、與上一份快照合併成 7 天滾動庫、重算儀表板並寫入 KV。 */
async function buildSnapshot(env) {
  const now = Date.now();
  const generatedAt = new Date(now).toISOString();
  const previous = await readSnapshot(env);
  const previousSources = new Map(
    (previous?.files?.sources?.data?.sources ?? []).map((source) => [source.id, source]),
  );

  const runs = await Promise.all(
    NEWS_SOURCES.map(async (source) => ({ source, ...(await fetchSourceItems(source)) })),
  );
  const liveItems = runs.flatMap((run) => run.items);
  // 合併來源（依序去重時較新者優先）：
  //  1. Worker 本次即時抓取（最新，以官方 RSS 為主）
  //  2. 上一份 KV 快照（Worker 的 7 天滾動庫）
  //  3. GitHub Pages 靜態 archive（Actions 從未被限流的 IP 補齊 24 家，≤15 分鐘）
  // 第 3 項讓 Google News 對 Worker 限流時，缺 RSS 的來源仍有近況資料。
  const restored = previous?.files?.['news-archive']?.data?.items ?? [];
  const pagesArchive = await archiveItems(env);
  const cutoff = now - 7 * DAY_MS;
  const merged = dedupeSnapshot([...liveItems, ...restored, ...pagesArchive])
    .filter((item) => {
      const t = Date.parse(item.publishedAt);
      return t >= cutoff && t <= now + FUTURE_TOLERANCE_MS;
    })
    .map((item) => ({
      id: item.id,
      source: item.source,
      title: item.title,
      excerpt: item.excerpt || '',
      publishedAt: item.publishedAt,
      url: item.url,
      sentiment: item.sentiment ?? null,
    }));

  const recent24 = merged.filter((item) => Date.parse(item.publishedAt) >= now - DAY_MS);
  const recent24Count = (id) => recent24.filter((item) => item.source === id).length;
  const liveOrRecent = runs.filter((run) => run.ok || recent24Count(run.source.id) > 0).length;
  const status = liveOrRecent === runs.length ? 'ok' : liveOrRecent ? 'partial' : 'stale';
  const stale = liveItems.length === 0 && merged.length > 0;

  const keywords = buildKeywords(merged, now, NEWS_SOURCES.length);
  const entities = buildEntities(recent24);
  const topics = buildTopics(merged);
  const sources = runs.map((run) => {
    const itemCount = merged.filter((item) => item.source === run.source.id).length;
    const hasRecent = recent24Count(run.source.id) > 0;
    // ok＝Worker 即時抓到官方 RSS，或該來源由 Pages archive（Actions 補齊）有近況；
    // stale＝官方 RSS 本次失敗但合併庫仍有近況；error＝完全沒有資料。
    const sourceStatus = run.ok || (run.viaPages && hasRecent) ? 'ok' : hasRecent ? 'stale' : 'error';
    return {
      id: run.source.id,
      displayName: run.source.displayName,
      status: sourceStatus,
      lastAttemptAt: generatedAt,
      lastSuccessAt: sourceStatus === 'ok' ? generatedAt : previousSources.get(run.source.id)?.lastSuccessAt ?? null,
      lastCrawlAt: null,
      accessMode: run.accessMode,
      errorCode: sourceStatus === 'ok' ? null : run.errorCode,
      stale: sourceStatus !== 'ok',
      itemCount,
      dropped: {},
    };
  });

  const files = {
    'news-archive': snapshotEnvelope({ status, stale, items: merged }, generatedAt),
    recent: snapshotEnvelope({ items: merged.slice(0, 100) }, generatedAt),
    keywords: snapshotEnvelope({ stale, keywords }, generatedAt),
    entities: snapshotEnvelope({ stale, experimental: true, ...entities }, generatedAt),
    topics: snapshotEnvelope({ stale, experimental: true, topics }, generatedAt),
    sources: snapshotEnvelope({ sources }, generatedAt),
    meta: snapshotEnvelope(
      {
        status,
        lastFastAt: liveItems.length ? generatedAt : previous?.files?.meta?.data?.lastFastAt ?? null,
        lastDeepAt: topics.length ? generatedAt : null,
        methodVersion: 'news-heat-v3-24-sources-worker',
        scheduleDaysUntilPause: null,
        coverage: { keywordWindowHours: 24, trendBucketMinutes: 60, archiveDays: 7 },
        stateRestoreFailed: false,
      },
      generatedAt,
    ),
  };
  await env.SNAPSHOT.put(SNAPSHOT_KEY, JSON.stringify({ generatedAt, files }));
  return files;
}

async function handleData(request, env, url) {
  const name = url.searchParams.get('name') || '';
  if (!DATA_FILES.has(name)) return json(request, env, { error: 'NOT_FOUND' }, 404);
  const snapshot = await readSnapshot(env);
  const file = snapshot?.files?.[name];
  if (file) return json(request, env, file, 200, 30);
  return json(request, env, { error: 'SNAPSHOT_UNAVAILABLE' }, 503);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(buildSnapshot(env).catch(() => {}));
  },

  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (!['GET', 'HEAD'].includes(request.method)) return json(request, env, { error: 'METHOD_NOT_ALLOWED' }, 405);
    const url = new URL(request.url);
    const cacheable = request.method === 'GET' && ['/api/trends', '/api/data'].includes(url.pathname);
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
    else if (url.pathname === '/api/data') response = await handleData(request, env, url);
    if (response) {
      if (cache && response.ok) ctx?.waitUntil(cache.put(request, response.clone()));
      return response;
    }
    if (url.pathname === '/api/health') return json(request, env, envelope({ status: 'ok' }), 200, 60);
    return json(request, env, { error: 'NOT_FOUND' }, 404);
  },
};
